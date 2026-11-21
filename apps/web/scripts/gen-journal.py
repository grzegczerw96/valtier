"""Journal field art: die-cut stickers, depth maps and the paper backdrop.

  python -I apps/web/scripts/gen-journal.py

Everything is built from media already in public/media (Pexels, see MEDIA.md) or
drawn here from the site's own OFL fonts — no new stock. Output:
  public/media/journal/*.webp     stickers, recoloured cut-outs, depth maps (*-depth.webp)
  public/textures/paper.webp      dark paper fibre, screened over the purple field
Needs Pillow, numpy, scipy, fontTools + brotli (for the woff2 fonts).
"""
import os
import math
import tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageChops
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
MEDIA = os.path.join(HERE, "..", "public", "media")
OUT = os.path.join(MEDIA, "journal")
TEX = os.path.join(HERE, "..", "public", "textures")
NM = os.path.join(HERE, "..", "..", "..", "node_modules")
os.makedirs(OUT, exist_ok=True)

BONE = (244, 239, 230)
INK = (23, 18, 32)
PURPLE = (44, 19, 82)
RICH = (79, 43, 171)
GOLD = (212, 162, 74)
GOLD_HI = (242, 199, 102)


def save(img, name, q=84, folder=OUT):
    p = os.path.join(folder, name)
    img.save(p, "WEBP", quality=q, method=6)
    print(f"{name:28s} {img.size[0]:5d}x{img.size[1]:<5d} {os.path.getsize(p) // 1024:4d} KB")


def src(path, mode="RGBA"):
    return Image.open(os.path.join(MEDIA, path)).convert(mode)


# ---------------------------------------------------------------- fonts
_tmp = tempfile.mkdtemp(prefix="vjournal-")


def font_file(rel, **axes):
    """woff2 -> static ttf (variable axes pinned) in a temp dir, for Pillow."""
    from fontTools.ttLib import TTFont
    key = os.path.basename(rel) + "".join(f"-{k}{v}" for k, v in sorted(axes.items()))
    out = os.path.join(_tmp, key + ".ttf")
    if not os.path.exists(out):
        f = TTFont(os.path.join(NM, rel))
        if "fvar" in f and axes:
            from fontTools.varLib import instancer
            have = {a.axisTag for a in f["fvar"].axes}
            f = instancer.instantiateVariableFont(f, {k: v for k, v in axes.items() if k in have})
        f.flavor = None
        f.save(out)
    return out


HERO = font_file("@fontsource/audiowide/files/audiowide-latin-400-normal.woff2")
WIDE = font_file("@fontsource-variable/saira/files/saira-latin-wdth-normal.woff2", wdth=100, wght=800)
NARROW = font_file("@fontsource-variable/saira/files/saira-latin-wdth-normal.woff2", wdth=62, wght=800)
MONO = font_file("@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2")


def F(path, size):
    return ImageFont.truetype(path, int(size))


def text_mask(size, items):
    """items: (xy_center, text, font, tracking_px) -> L mask of the canvas size."""
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    for (cx, cy), txt, fnt, tr in items:
        widths = [d.textlength(ch, font=fnt) for ch in txt]
        total = sum(widths) + tr * (len(txt) - 1)
        x = cx - total / 2
        asc, desc = fnt.getmetrics()
        for ch, w in zip(txt, widths):
            d.text((x, cy - (asc - desc) / 2 - desc * 0.15), ch, font=fnt, fill=255, anchor="ls" if False else None)
            x += w + tr
    return m


# ---------------------------------------------------------------- helpers
def grow(alpha, r):
    """Round dilation of an L mask by r px (distance transform)."""
    a = np.asarray(alpha) > 127
    if r <= 0:
        return Image.fromarray((a * 255).astype(np.uint8))
    dist = ndimage.distance_transform_edt(~a)
    m = np.clip((r + 0.75 - dist) / 1.5, 0, 1)
    return Image.fromarray((m * 255).astype(np.uint8))


def pad(img, p):
    out = Image.new("RGBA", (img.width + 2 * p, img.height + 2 * p), (0, 0, 0, 0))
    out.alpha_composite(img, (p, p))
    return out


def sticker(img, border, edge=(214, 206, 196)):
    """Die-cut sticker: art over a rounded white backing that follows its silhouette."""
    img = pad(img, border + 6)
    a = img.getchannel("A")
    # close small gaps so the backing reads as one cut
    closed = grow(a, border).filter(ImageFilter.GaussianBlur(border * 0.35)).point(lambda v: 255 if v > 110 else 0)
    back = grow(closed, 1).filter(ImageFilter.GaussianBlur(0.8))
    base = Image.new("RGBA", img.size, BONE + (0,))
    base.putalpha(back)
    rim = Image.new("RGBA", img.size, edge + (0,))
    ring = ImageChops.subtract(back, grow(closed, -1) if False else closed.filter(ImageFilter.MinFilter(3)))
    rim.putalpha(ring.point(lambda v: int(v * 0.55)))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(base)
    out.alpha_composite(rim)
    out.alpha_composite(img)
    bbox = out.getchannel("A").point(lambda v: 255 if v > 6 else 0).getbbox()
    return out.crop(bbox)


def depth_from_alpha(a, bulge_at=None, bulge_r=0.25, lum=None, lum_w=0.12):
    a = np.asarray(a)
    m = Image.fromarray(a)
    acc = np.zeros(a.shape, np.float32)
    s = max(a.shape) / 1000
    for r, w in ((4, 0.25), (14, 0.3), (40, 0.3), (90, 0.15)):
        acc += np.asarray(m.filter(ImageFilter.GaussianBlur(r * s))).astype(np.float32) / 255 * w
    acc = np.clip(acc, 0, 1) ** 0.75
    d = 0.2 + 0.75 * acc
    if lum is not None:
        L = np.asarray(lum.convert("L").filter(ImageFilter.GaussianBlur(3 * s))).astype(np.float32) / 255
        d += lum_w * (L - 0.5)
    if bulge_at:
        H, W = a.shape
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        bx, by = bulge_at
        d += 0.18 * np.exp(-(((xx - bx * W) / (bulge_r * W)) ** 2 + ((yy - by * H) / (bulge_r * H)) ** 2))
    d = np.clip(d, 0, 1) * (a > 4)
    return Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.5 * s)).convert("RGB")


def gradient(size, stops, angle=90):
    """Linear gradient fill; stops = [(t, rgb)], angle in degrees (90 = top->bottom)."""
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    a = math.radians(angle)
    t = (xx / max(w, 1)) * math.cos(a) + (yy / max(h, 1)) * math.sin(a)
    t = (t - t.min()) / max(t.max() - t.min(), 1e-6)
    out = np.zeros((h, w, 3), np.float32)
    ts = [s[0] for s in stops]
    for c in range(3):
        out[..., c] = np.interp(t, ts, [s[1][c] for s in stops])
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def metal(mask, stops=((0, GOLD_HI), (0.45, (250, 226, 160)), (0.55, GOLD), (1, (140, 96, 34))), angle=100, bevel=6):
    """Bevelled metallic fill inside an L mask."""
    w, h = mask.size
    fill = gradient((w, h), stops, angle).convert("RGBA")
    # emboss: light from top-left
    m = np.asarray(mask.filter(ImageFilter.GaussianBlur(bevel))).astype(np.float32) / 255
    gy, gx = np.gradient(m)
    shade = np.clip(0.5 + (-gx - gy) * bevel * 2.2, 0, 1)
    f = np.asarray(fill).astype(np.float32)
    f[..., :3] *= (0.72 + 0.6 * shade)[..., None]
    out = Image.fromarray(f.clip(0, 255).astype(np.uint8))
    out.putalpha(mask)
    return out


def solid(mask, rgb):
    out = Image.new("RGBA", mask.size, rgb + (0,))
    out.putalpha(mask)
    return out


def shield_path(x0, y0, w, h, n=48):
    """The Wolves crest silhouette (crest.svg), sampled to a polygon."""
    def cub(p0, p1, p2, p3):
        return [((1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0],
                 (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1]) for t in np.linspace(0, 1, n)]
    pts = [(61, 4), (108, 18), (108, 56)]
    pts += cub((108, 56), (108, 86), (88, 106), (61, 118))
    pts += cub((61, 118), (34, 106), (14, 86), (14, 56))
    pts += [(14, 18)]
    return [(x0 + (px - 14) / 94 * w, y0 + (py - 4) / 114 * h) for px, py in pts]


def scale_poly(poly, k, cx, cy):
    return [(cx + (x - cx) * k, cy + (y - cy) * k) for x, y in poly]


# ---------------------------------------------------------------- pieces
def whole_ball():
    """football.webp is cut by the frame at the bottom (and keeps two tee prongs).
    A ball is point-symmetric about its centre, so find the centre where the ball best
    matches its own 180° turn and fill the missing cap from the turned copy."""
    im = src("football.webp")
    W, H = im.size
    cut = np.asarray(im).copy()
    cut[H - 34:, :, 3] = 0  # drop the tee prongs and the frame-cut rim
    pad_ = 220
    cw, ch = W + 2 * pad_, H + 2 * pad_
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.alpha_composite(Image.fromarray(cut), (pad_, pad_))
    A0 = np.asarray(canvas.getchannel("A")).astype(np.float32) / 255
    # coarse-to-fine search of the symmetry centre on a downsampled mask
    s = 4
    small = A0[::s, ::s]
    hs, ws = small.shape
    valid = np.zeros_like(small)
    valid[(pad_) // s:(pad_ + H - 40) // s, (pad_) // s:(pad_ + W) // s] = 1

    def score(cx, cy):
        # 180° turn about (cx, cy): (x, y) -> (2cx - x, 2cy - y)
        yy, xx = np.mgrid[0:hs, 0:ws]
        tx, ty = np.round(2 * cx - xx).astype(int), np.round(2 * cy - yy).astype(int)
        ok = (tx >= 0) & (tx < ws) & (ty >= 0) & (ty < hs)
        t = np.zeros_like(small)
        t[ok] = small[ty[ok], tx[ok]]
        both = valid * (t > 0) * 1.0
        both[ok] *= valid[ty[ok], tx[ok]]
        inter = (np.minimum(small, t) * both).sum()
        union = (np.maximum(small, t) * both).sum() + 1e-6
        return inter / union

    ys, xs = np.nonzero(small > 0.5)
    best = (score(xs.mean(), ys.mean()), xs.mean(), ys.mean())
    for step in (6, 3, 1, 0.5):
        _, bx, by = best
        for dx in np.arange(-4, 5) * step:
            for dy in np.arange(-4, 5) * step:
                sc = score(bx + dx, by + dy)
                if sc > best[0]:
                    best = (sc, bx + dx, by + dy)
    cx, cy = best[1] * s, best[2] * s
    turned = canvas.rotate(180, Image.BICUBIC, center=(cx, cy))
    base = np.asarray(canvas).astype(np.float32)
    fill = np.asarray(turned).astype(np.float32)
    # feathered seam; the filled cap is the ball's underside, so it sits in shadow
    wa = ndimage.gaussian_filter(base[..., 3] / 255, 4)[..., None] * (base[..., 3:4] > 0)
    yy = np.arange(ch, dtype=np.float32)[:, None, None]
    shade = np.clip(0.62 - (yy - (pad_ + H - 60)) / 260, 0.38, 0.62)
    rgb = base[..., :3] * wa + fill[..., :3] * shade * (1 - wa)
    alpha = np.maximum(base[..., 3], fill[..., 3])
    out = Image.fromarray(np.dstack([rgb, alpha]).clip(0, 255).astype(np.uint8))
    return out.crop(out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())


def huddle():
    """Leather ball with the magazine's name printed across it (+ depth)."""
    ball = whole_ball()
    W, H = ball.size
    k = 2
    ball = ball.resize((W * k, H * k), Image.LANCZOS)
    W, H = ball.size
    # darken toward a black leather like a promo ball
    arr = np.asarray(ball).astype(np.float32)
    lum = arr[..., :3].mean(-1, keepdims=True)
    arr[..., :3] = lum * np.array([0.42, 0.36, 0.40]) + arr[..., :3] * 0.18
    ball = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
    # printed name, bent along the ball's curve
    word = "HUDDLE"
    fnt = F(WIDE, H * 0.16)
    layer = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(layer)
    widths = [d.textlength(c, font=fnt) for c in word]
    track = H * 0.03
    total = sum(widths) + track * (len(word) - 1)
    cx, cy = W * 0.47, H * 0.55
    x = cx - total / 2
    for c, w in zip(word, widths):
        t = (x + w / 2 - cx) / (total / 2)
        g = Image.new("L", (int(w * 2), int(H * 0.3)), 0)
        ImageDraw.Draw(g).text((w / 2, H * 0.02), c, font=fnt, fill=255)
        g = g.rotate(-t * 9, Image.BICUBIC)
        layer.paste(255, (int(x - w / 2), int(cy - H * 0.13 + (t * t) * H * 0.035)), g)
        x += w + track
    layer = ImageChops.multiply(layer, ball.getchannel("A"))
    ink = Image.new("RGBA", (W, H), BONE + (0,))
    ink.putalpha(layer.point(lambda v: int(v * 0.92)))
    ball.alpha_composite(ink)
    bbox = ball.getchannel("A").getbbox()
    ball = ball.crop(bbox)
    save(ball, "huddle.webp")
    save(depth_from_alpha(ball.getchannel("A"), (0.5, 0.5), 0.3), "huddle-depth.webp", 80)


def depth_for(path, name, bulge=None, lum_w=0.1):
    im = src(path)
    save(depth_from_alpha(im.getchannel("A"), bulge, 0.22, lum=im, lum_w=lum_w), name, 80)


def chrome_pair():
    """Home's gold pair re-plated in chrome for the Blur PE entry (same depth map, cropped together)."""
    im = src("home/partner-cleat.webp")
    dep = src("home/partner-cleat-depth.webp", "RGB")
    arr = np.asarray(im).astype(np.float32)
    lum = arr[..., :3] @ np.array([0.3, 0.55, 0.15])
    lum = (lum / 255) ** 0.9
    chrome = np.stack([lum * 228 + 14, lum * 232 + 16, lum * 242 + 22], -1)
    # sharpen the reflections into chrome bands
    band = 0.5 + 0.5 * np.sin(lum * 9.0)
    chrome *= (0.78 + 0.32 * band)[..., None]
    arr[..., :3] = chrome
    out = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
    bbox = out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    m = 24
    bbox = (max(0, bbox[0] - m), max(0, bbox[1] - m), min(out.width, bbox[2] + m), min(out.height, bbox[3] + m))
    save(out.crop(bbox), "blur-pe.webp")
    save(dep.crop(bbox), "blur-pe-depth.webp", 80)


def wordmark_rumble():
    W, H = 1400, 660
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    f1 = F(HERO, 300)
    f2 = F(HERO, 210)
    for txt, fnt, y in (("RUMBLE", f1, 40), ("NIGHT", f2, 350)):
        tw = d.textlength(txt, font=fnt)
        d.text(((W - tw) / 2, y), txt, font=fnt, fill=255)
    # slant like a fight-night logo
    m = m.transform(m.size, Image.AFFINE, (1, 0.18, -60, 0, 1, 0), Image.BICUBIC)
    outline = grow(m, 14)
    art = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    art.alpha_composite(solid(outline, INK))
    art.alpha_composite(metal(m, ((0, (255, 236, 170)), (0.5, GOLD_HI), (0.52, GOLD), (1, (120, 72, 20))), 90, 5))
    # purple lightning bar behind
    bar = Image.new("L", (W, H), 0)
    ImageDraw.Draw(bar).polygon([(120, 300), (1290, 262), (1260, 352), (90, 380)], fill=255)
    bar = ImageChops.subtract(bar, outline)
    art = Image.alpha_composite(solid(bar, RICH), art)
    save(sticker(art.crop(art.getchannel("A").getbbox()), 26), "rumble.webp")


def numeral(txt, name, ratio):
    W = 1200
    H = int(W / ratio)
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    fnt = F(WIDE, H * 0.92)
    tw = d.textlength(txt, font=fnt)
    bb = d.textbbox((0, 0), txt, font=fnt)
    d.text(((W - tw) / 2, (H - (bb[3] - bb[1])) / 2 - bb[1]), txt, font=fnt, fill=255)
    m = m.transform(m.size, Image.AFFINE, (1, 0.14, -H * 0.07, 0, 1, 0), Image.BICUBIC)
    art = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    art.alpha_composite(solid(grow(m, 10), (92, 58, 18)))
    art.alpha_composite(metal(m, angle=95, bevel=9))
    art = art.crop(art.getchannel("A").getbbox())
    save(art, name)


def jersey18():
    W, H = 1000, 1060
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    fnt = F(NARROW, 900)
    bb = d.textbbox((0, 0), "18", font=fnt)
    top = H - (bb[3] - bb[1]) - 30
    d.text(((W - (bb[2] - bb[0])) / 2 - bb[0], top - bb[1]), "18", font=fnt, fill=255)
    name = Image.new("L", (W, H), 0)
    dn = ImageDraw.Draw(name)
    f2 = F(NARROW, 120)
    nb = dn.textbbox((0, 0), "VALTIER", font=f2)
    tw = dn.textlength("VALTIER", font=f2) + 6 * 14
    x = (W - tw) / 2
    for ch in "VALTIER":
        dn.text((x, top - 34 - nb[3]), ch, font=f2, fill=255)
        x += dn.textlength(ch, font=f2) + 14
    art = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    art.alpha_composite(solid(grow(m, 22), GOLD))
    art.alpha_composite(solid(grow(m, 12), BONE))
    art.alpha_composite(metal(m, ((0, (120, 82, 220)), (0.5, RICH), (1, PURPLE)), 95, 8))
    art.alpha_composite(solid(grow(name, 8), PURPLE))
    art.alpha_composite(solid(name, BONE))
    save(sticker(art.crop(art.getchannel("A").getbbox()), 24), "jersey-18.webp")


def star(cx, cy, r, rot=-90):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * 0.45
        a = math.radians(rot + i * 36)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def two_star():
    S = 1000
    art = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    disc = Image.new("L", (S, S), 0)
    ImageDraw.Draw(disc).ellipse([40, 40, S - 40, S - 40], fill=255)
    art.alpha_composite(metal(disc, ((0, GOLD_HI), (1, (150, 100, 30))), 120, 10))
    inner = Image.new("L", (S, S), 0)
    ImageDraw.Draw(inner).ellipse([90, 90, S - 90, S - 90], fill=255)
    art.alpha_composite(metal(inner, ((0, (96, 62, 190)), (1, PURPLE)), 110, 6))
    stars = Image.new("L", (S, S), 0)
    ds = ImageDraw.Draw(stars)
    ds.polygon(star(355, 470, 150), fill=255)
    ds.polygon(star(645, 470, 150), fill=255)
    art.alpha_composite(solid(grow(stars, 8), INK))
    art.alpha_composite(metal(stars, angle=100, bevel=7))
    t = Image.new("L", (S, S), 0)
    dt = ImageDraw.Draw(t)
    for txt, size, y in (("TWO-STAR", 96, 640), ("RECRUIT", 64, 760)):
        fnt = F(WIDE, size)
        tw = dt.textlength(txt, font=fnt)
        dt.text(((S - tw) / 2, y), txt, font=fnt, fill=255)
    art.alpha_composite(solid(t, BONE))
    save(sticker(art, 22), "two-star.webp")


def crest_pa():
    """College crest: Port Alder shield + ribbon."""
    W, H = 1300, 980
    art = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh = shield_path(W / 2 - 330, 30, 660, 800)
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon(sh, fill=255)
    art.alpha_composite(metal(m, ((0, (250, 240, 226)), (1, (196, 186, 172))), 110, 8))
    m2 = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m2).polygon(scale_poly(sh, 0.86, W / 2, 430), fill=255)
    art.alpha_composite(metal(m2, ((0, (34, 96, 88)), (1, (10, 46, 44))), 110, 6))
    t = Image.new("L", (W, H), 0)
    dt = ImageDraw.Draw(t)
    fnt = F(HERO, 330)
    tw = dt.textlength("PA", font=fnt)
    dt.text(((W - tw) / 2, 200), "PA", font=fnt, fill=255)
    art.alpha_composite(solid(grow(t, 10), INK))
    art.alpha_composite(metal(t, angle=100, bevel=6))
    # ribbon
    rb = Image.new("L", (W, H), 0)
    ImageDraw.Draw(rb).polygon([(40, 700), (W - 40, 700), (W - 110, 790), (W - 40, 880), (40, 880), (110, 790)], fill=255)
    art.alpha_composite(solid(grow(rb, 8), INK))
    art.alpha_composite(metal(rb, ((0, (226, 112, 64)), (1, (166, 62, 34))), 90, 5))
    rt = Image.new("L", (W, H), 0)
    drt = ImageDraw.Draw(rt)
    f2 = F(WIDE, 96)
    txt = "PORT ALDER"
    tw = drt.textlength(txt, font=f2) + 9 * 10
    x = (W - tw) / 2
    for ch in txt:
        drt.text((x, 728), ch, font=f2, fill=255)
        x += drt.textlength(ch, font=f2) + 10
    art.alpha_composite(solid(rt, BONE))
    save(sticker(art.crop(art.getchannel("A").getbbox()), 26), "crest-pa.webp")


def wolves_plate():
    W, H = 1500, 760
    art = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    plate = Image.new("L", (W, H), 0)
    ImageDraw.Draw(plate).rounded_rectangle([20, 60, W - 20, H - 60], 90, fill=255)
    art.alpha_composite(metal(plate, ((0, GOLD_HI), (1, (150, 100, 30))), 100, 8))
    inner = Image.new("L", (W, H), 0)
    ImageDraw.Draw(inner).rounded_rectangle([46, 86, W - 46, H - 86], 70, fill=255)
    art.alpha_composite(metal(inner, ((0, (98, 60, 196)), (1, PURPLE)), 100, 5))
    # crest on the left (from crest.svg)
    cs = Image.new("L", (W, H), 0)
    sh = shield_path(70, 20, 560, 680)
    ImageDraw.Draw(cs).polygon(sh, fill=255)
    art.alpha_composite(solid(grow(cs, 14), BONE))
    art.alpha_composite(metal(cs, ((0, GOLD_HI), (1, GOLD)), 110, 6))
    cs2 = Image.new("L", (W, H), 0)
    ImageDraw.Draw(cs2).polygon(scale_poly(sh, 0.86, 350, 330), fill=255)
    art.alpha_composite(metal(cs2, ((0, (107, 63, 209)), (1, PURPLE)), 110, 4))
    # faceted wolf head (crest.svg coordinates)
    def P(pts):
        return [(70 + (x - 14) / 94 * 560, 20 + (y - 4) / 114 * 680) for x, y in pts]
    dh = ImageDraw.Draw(art)
    dh.polygon(P([(38, 34), (49, 47), (61, 43), (73, 47), (84, 34), (82, 58), (74, 74), (61, 88), (48, 74), (40, 58)]), fill=BONE)
    dh.polygon(P([(61, 43), (73, 47), (82, 58), (74, 74), (61, 88)]), fill=(211, 200, 186))
    dh.polygon(P([(45, 56), (55, 59), (52, 63)]), fill=PURPLE)
    dh.polygon(P([(77, 56), (67, 59), (70, 63)]), fill=PURPLE)
    dh.polygon(P([(56, 72), (66, 72), (61, 79)]), fill=PURPLE)
    dh.polygon(P([(38, 34), (49, 47), (44, 49)]), fill=(158, 109, 233))
    dh.polygon(P([(84, 34), (73, 47), (78, 49)]), fill=(158, 109, 233))
    t = Image.new("L", (W, H), 0)
    dt = ImageDraw.Draw(t)
    for txt, size, y in (("NORTHMARK", 150, 210), ("WOLVES", 205, 360)):
        fnt = F(NARROW, size)
        dt.text((690, y), txt, font=fnt, fill=255)
    art.alpha_composite(solid(t, BONE))
    save(sticker(art.crop(art.getchannel("A").getbbox()), 24), "wolves-plate.webp")


def arena99():
    card = src("cards/card-02.webp")
    W, H = card.size
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    fnt = F(WIDE, 260)
    d.text((W - 330, 40), "99", font=fnt, fill=255)
    card.alpha_composite(solid(grow(m, 10), INK))
    card.alpha_composite(metal(m, angle=95, bevel=6))
    t = Image.new("L", (W, H), 0)
    dt = ImageDraw.Draw(t)
    f2 = F(HERO, 54)
    txt = "PIXEL ARENA"
    tw = dt.textlength(txt, font=f2)
    dt.rounded_rectangle([(W - tw) / 2 - 26, H - 150, (W + tw) / 2 + 26, H - 70], 18, fill=255)
    card.alpha_composite(solid(t, INK))
    t2 = Image.new("L", (W, H), 0)
    ImageDraw.Draw(t2).text(((W - tw) / 2, H - 146), txt, font=f2, fill=255)
    card.alpha_composite(metal(t2, angle=95, bevel=3))
    c = Image.new("L", (W, H), 0)
    ImageDraw.Draw(c).text((W - 250, 300), "CLUB", font=F(NARROW, 84), fill=255)
    card.alpha_composite(solid(grow(c, 6), INK))
    card.alpha_composite(solid(c, BONE))
    save(card, "arena-99.webp")


def cutout_sticker(path, name, crop=None, max_side=1100, border=18, gray=False):
    im = src(path)
    if crop:
        W, H = im.size
        im = im.crop((int(crop[0] * W), int(crop[1] * H), int(crop[2] * W), int(crop[3] * H)))
    bbox = im.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    im = im.crop(bbox)
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    a = im.getchannel("A").point(lambda v: 0 if v < 40 else v)
    im.putalpha(a)
    save(sticker(im, border), name)


def editorial():
    im = src("off/fashion/f04.webp", "RGB")
    g = ImageOps.autocontrast(ImageOps.grayscale(im), cutoff=1)
    save(g.convert("RGB"), "editorial.webp", 80)


def paper():
    """Dark paper fibre (mean ~16/255), screened at .3 over the purple field."""
    rng = np.random.default_rng(1818)
    W, H = 1440, 960
    base = rng.normal(0, 1, (H // 8, W // 8)).astype(np.float32)
    mott = np.asarray(Image.fromarray(((base - base.min()) / np.ptp(base) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(18))).astype(np.float32) / 255
    grain = rng.normal(0, 1, (H, W)).astype(np.float32)
    grain = ndimage.gaussian_filter(grain, 0.7)
    fib = np.zeros((H, W), np.float32)
    for _ in range(2600):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        L = rng.uniform(6, 40)
        a = rng.uniform(0, math.pi)
        n = int(L)
        xs = (x + np.cos(a) * np.arange(n)).astype(int) % W
        ys = (y + np.sin(a) * np.arange(n)).astype(int) % H
        fib[ys, xs] += rng.uniform(0.3, 1)
    fib = ndimage.gaussian_filter(fib, 0.6)
    specks = (rng.random((H, W)) > 0.99965).astype(np.float32)
    specks = ndimage.gaussian_filter(specks, 0.7) * 6
    fine = ndimage.gaussian_filter(rng.normal(0, 1, (H, W)).astype(np.float32), 1.6)
    v = 12 + 14 * mott + 16 * grain + 22 * fine + 9 * fib + 38 * specks
    img = Image.fromarray(np.clip(v, 0, 255).astype(np.uint8)).convert("RGB")
    save(img, "paper.webp", 50, TEX)


def main():
    huddle()
    depth_for("cleats/c07.webp", "harbor-king-depth.webp", (0.45, 0.5))
    depth_for("cleats/c01.webp", "ember-18-depth.webp", (0.45, 0.5))
    depth_for("cleats/cleat-gold.webp", "gold-pe-depth.webp", (0.45, 0.5))
    depth_for("home/partner-halo.webp", "halo-depth.webp", (0.5, 0.55), 0.06)
    depth_for("gloves.webp", "plunge-depth.webp", (0.5, 0.45), 0.1)
    chrome_pair()
    wordmark_rumble()
    numeral("#2", "num-2.webp", 494 / 320)
    numeral("#9", "num-9.webp", 492 / 394)
    jersey18()
    two_star()
    crest_pa()
    wolves_plate()
    arena99()
    cutout_sticker("influence-player.webp", "player-sticker.webp")
    cutout_sticker("home/partner-volta.webp", "volta-sticker.webp", border=20)
    cutout_sticker("hero/portrait.webp", "portrait-sticker.webp", crop=(0.22, 0.0, 0.78, 1.0), border=20)
    cutout_sticker("footer-player.webp", "back-sticker.webp", border=20)
    editorial()
    paper()


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        for name in sys.argv[1:]:
            globals()[name]()
    else:
        main()
