"""Procedural, seamless textures for the site (no third-party imagery).

  python -I apps/web/scripts/gen-textures.py

Writes into apps/web/public/textures/:
  pebble.webp  480px tile  - football-leather pebble grain (dark rounded pebbles, light seams)
  grass.webp   512px tile  - fine turf grain, shown at 170px
  light.webp   1440x810    - soft diagonal light shaft (alpha), used with soft-light blend
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(18)


def pebble(size=480, cells=72):
    """Seamless football-leather pebble grain, matched to the reference's tile statistics
    (measured through its screen blend on sand): dark, rounded pebbles separated by thin
    light seams, ~8px apart, mean ~73/255 with a long bright tail (skew ~1.1). Pebbles are
    rounded with the Apollonius trick: the seam is where f1/f2 (nearest / second-nearest
    seed distance) approaches 1, whose level sets are circles, so corners fill in."""
    rng.uniform(size=(70, 70, 2)); rng.normal(size=(8, 8)); rng.normal(size=(480, 480))  # keep grass/light draws as before
    r = np.random.default_rng(1818)
    g = size / cells
    jitter = r.uniform(0.12, 0.88, (cells, cells, 2))
    tone = r.uniform(0.94, 1.06, (cells, cells))            # per-pebble variation
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) + 0.5
    # periodic domain warp (integer periods keep the tile seamless): rows of pebbles flow and curve
    tau = 2 * np.pi / size
    wx = xx + 2.2 * np.sin(tau * 2 * yy + 1.3) + 1.0 * np.sin(tau * 5 * (xx + yy) + 0.4)
    wy = yy + 2.2 * np.sin(tau * 3 * xx + 0.2) + 1.0 * np.sin(tau * 4 * (xx - yy) + 2.1)
    gx, gy = np.floor(wx / g).astype(int), np.floor(wy / g).astype(int)
    # anisotropic metric: pebbles ~14% longer along the 35deg diagonal, like the reference's flow
    ca, sa, k = np.cos(0.61), np.sin(0.61), 1.14
    f1 = np.full((size, size), 1e9, np.float32)
    f2 = np.full((size, size), 1e9, np.float32)
    own = np.ones((size, size), np.float32)
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            cx, cy = gx + dx, gy + dy
            j = jitter[cy % cells, cx % cells]
            ex, ey = wx - (cx + j[..., 0]) * g, wy - (cy + j[..., 1]) * g
            u, v_ = ex * ca + ey * sa, -ex * sa + ey * ca
            d = np.hypot(u / k, v_)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            own = np.where(closer, tone[cy % cells, cx % cells], own)
            f1 = np.minimum(f1, d)
    ratio = f1 / f2
    e = 1 - ratio                                            # 0 on the seam, rising toward the seed
    t = np.clip(e / 0.3, 0, 1)
    h = t * t * (3 - 2 * t)                                  # flat-topped pebble with a rounded shoulder
    seam = 1 - h
    # shade the shoulders: light from the upper-left catches each pebble's upper-left rim
    hy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    hx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    nx, ny, nz = -hx * 2.4, -hy * 2.4, np.ones_like(h)
    nl = (nx * -0.62 + ny * -0.62 + nz * 0.48) / np.sqrt(nx * nx + ny * ny + 1)
    flat = 0.48
    lit = np.clip((nl - flat) / (1 - flat), 0, 1) ** 1.2      # rim highlight (0 on flat tops)
    def smooth_noise(n):
        a = r.normal(0, 1, (n, n))
        a = np.tile(a, (3, 3))                                   # wrap so the bicubic resize stays seamless
        big = np.array(Image.fromarray(((a - a.min()) / np.ptp(a) * 255).astype(np.uint8)).resize((size * 3, size * 3), Image.BICUBIC)) / 255.0
        return big[size:2 * size, size:2 * size]
    lf, mf = smooth_noise(6), smooth_noise(24)                   # broad mottling, seam-to-seam variation
    v = 0.07 * own + (0.35 * lit + 0.7 * seam ** 1.8) * (0.8 + 0.2 * lf + 0.08 * mf * own) + r.normal(0, 0.018, (size, size))
    # soften the seams a touch (the reference reads soft, not etched); np.roll keeps the blur seamless
    sig = 0.3
    kern = np.exp(-0.5 * (np.arange(-2, 3) / sig) ** 2); kern /= kern.sum()
    for ax in (0, 1):
        v = sum(w * np.roll(v, o, ax) for o, w in zip(range(-2, 3), kern))
    # map to the reference's measured quantiles (1/10/25/50/75/90/99th: 11/18/29/52/105/162/232)
    q = np.percentile(v, [0, 1, 10, 25, 50, 75, 90, 99, 100])
    target = [3, 11, 18, 29, 52, 105, 162, 232, 252]
    img = np.interp(v, q, target)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "L").save(os.path.join(OUT, "pebble.webp"), quality=62, method=6)


def grass(size=512, blades=26000, display=170, target_std=13.0):
    """Fine turf grain: a 512px tile shown at 170 CSS px (like a 3x asset), so the browser
    averages it into a soft, even grain. Contrast is set on the *displayed* tile (std ~13 at
    170px, about 60% of the reference's ~21), mean kept at 78 so the multiply darkening -
    i.e. the page tone - is unchanged."""
    big = Image.new("L", (size * 3, size * 3), 72)
    d = ImageDraw.Draw(big)
    for _ in range(blades):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        ang = rng.normal(-np.pi / 2, 0.6)
        ln = rng.uniform(4, 13)
        c = int(np.clip(rng.normal(88, 34), 20, 200))
        for ox in (0, size, 2 * size):
            for oy in (0, size, 2 * size):
                x0, y0 = x + ox, y + oy
                d.line([(x0, y0), (x0 + np.cos(ang) * ln, y0 + np.sin(ang) * ln)], fill=c, width=1)
    tile = big.crop((size, size, 2 * size, 2 * size)).filter(ImageFilter.GaussianBlur(0.6))
    a = np.asarray(tile, np.float32)
    a -= a.mean()
    shown = np.asarray(Image.fromarray(a + 128).resize((display, display), Image.BOX), np.float32)
    a = a * (target_std / (shown.std() + 1e-6)) + 78
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "L").save(os.path.join(OUT, "grass.webp"), quality=70, method=6)


def light(w=1440, h=810):
    """Window-light shaft: a soft diagonal band + a hot spot, white on transparent."""
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.polygon([(w * 0.18, -10), (w * 0.52, -10), (w * 0.78, h + 10), (w * 0.34, h + 10)], fill=210)
    d.polygon([(w * 0.6, -10), (w * 0.74, -10), (w * 0.98, h + 10), (w * 0.84, h + 10)], fill=120)
    m = m.filter(ImageFilter.GaussianBlur(70))
    hot = Image.new("L", (w, h), 0)
    ImageDraw.Draw(hot).ellipse([w * 0.3, h * 0.05, w * 0.7, h * 0.6], fill=150)
    hot = hot.filter(ImageFilter.GaussianBlur(120))
    a = np.clip(np.asarray(m, np.float32) + np.asarray(hot, np.float32), 0, 255).astype(np.uint8)
    rgba = np.dstack([np.full((h, w), 236, np.uint8)] * 3 + [a])
    Image.fromarray(rgba, "RGBA").resize((w // 2, h // 2), Image.BICUBIC).save(os.path.join(OUT, "light.webp"), quality=70, method=6)


if __name__ == "__main__":
    import sys
    only = set(sys.argv[1:]) or {"pebble", "grass", "light"}
    for name in ("pebble", "grass", "light"):
        if name in only:
            {"pebble": pebble, "grass": grass, "light": light}[name]()
    for f in sorted(os.listdir(OUT)):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB")
