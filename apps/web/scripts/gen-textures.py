"""Procedural, seamless textures for the site (no third-party imagery).

  python -I apps/web/scripts/gen-textures.py

Writes into apps/web/public/textures/:
  pebble.webp  480px tile  - football-leather pebble grain (Voronoi domes)
  grass.webp   512px tile  - fine turf grain, shown at 170px
  light.webp   1440x810    - soft diagonal light shaft (alpha), used with soft-light blend
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(18)


def pebble(size=480, cells=70):
    """Seamless Voronoi pebble grain: one jittered seed per grid cell, wrap-around neighbours."""
    g = size / cells
    jitter = rng.uniform(0.15, 0.85, (cells, cells, 2))
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) + 0.5
    gx, gy = (xx // g).astype(int), (yy // g).astype(int)
    f1 = np.full((size, size), 1e9, np.float32)
    f2 = np.full((size, size), 1e9, np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cx, cy = gx + dx, gy + dy
            j = jitter[cy % cells, cx % cells]
            px = (cx + j[..., 0]) * g
            py = (cy + j[..., 1]) * g
            d = np.hypot(xx - px, yy - py)
            f2 = np.where(d < f1, f1, np.minimum(f2, d))
            f1 = np.minimum(f1, d)
    edge = np.clip((f2 - f1) / (g * 0.85), 0, 1)          # 0 in grooves, 1 at cell centre
    dome = np.sqrt(edge)                                   # rounded pebble height
    # light from the top-left: emboss via gradient of the height map (wraps -> seamless)
    hy = (np.roll(dome, -1, 0) - np.roll(dome, 1, 0)) * 0.5
    hx = (np.roll(dome, -1, 1) - np.roll(dome, 1, 1)) * 0.5
    light = np.clip(0.5 - (hx + hy) * 5.0, 0, 1)
    v = 0.18 + 0.62 * dome * (0.45 + 0.55 * light)
    v *= np.clip(edge / 0.09, 0.12, 1)                           # crisp dark grooves
    # low-frequency mottling so the tile does not read as a grid
    lf = rng.normal(0, 1, (8, 8))
    lf = np.array(Image.fromarray(((lf - lf.min()) / np.ptp(lf) * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC)) / 255.0
    v *= 0.82 + 0.3 * lf
    v += rng.normal(0, 0.035, v.shape)
    img = np.clip(v, 0, 1)
    # match the reference histogram roughly: mean ~72/255, high contrast
    img = (img - img.mean()) / (img.std() + 1e-6) * 64 + 72
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "L").save(os.path.join(OUT, "pebble.webp"), quality=58, method=6)


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
