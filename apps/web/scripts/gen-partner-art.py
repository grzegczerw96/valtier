"""Partnership visuals for the Home page.

  python apps/web/scripts/gen-partner-art.py [<pexels-dir>]

With <pexels-dir> (holding photos/<id>.jpg, see MEDIA.md) the cleat comes from
Pexels 27299906 (full pair, marks removed, gilded) instead of cleats/cleat-gold, and it builds
home/partner-halo.webp (white headphones, Pexels 3394666) and
home/partner-volta.webp (profile in sunglasses, Pexels 34198837; chest patch
painted out) as rembg (BiRefNet) cut-outs.

home/partner-cleat.webp (+ -depth): the gold Northline cleat (cut-out from
  media/cleats/cleat-gold.webp) on a transparent 16:9 canvas, inside the same
  bounds the reference uses for its 3D product shot, with a depth map for the
  WebGL parallax slide.
home/partner-forge.webp: three FORGE protein-bar boxes in perspective with Nico on
  the fronts (procedural packaging, photos from media/records), transparent.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "media")
OUT = os.path.join(ROOT, "home")
FONTS = os.path.join(os.path.dirname(__file__), "..", "..", "..", "node_modules")
os.makedirs(OUT, exist_ok=True)


def save(img, name, q=82):
    p = os.path.join(OUT, name)
    img.save(p, "WEBP", quality=q, method=6)
    print(name, img.size, os.path.getsize(p) // 1024, "KB")


def depth_from_alpha(a, bulge_at=None, bulge_r=0.25):
    m = Image.fromarray(a)
    acc = np.zeros(a.shape, np.float32)
    for r, w in ((4, 0.25), (14, 0.3), (40, 0.3), (90, 0.15)):
        acc += np.asarray(m.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255 * w
    acc = np.clip(acc, 0, 1) ** 0.75
    d = 0.2 + 0.75 * acc
    if bulge_at:
        H, W = a.shape
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        bx, by = bulge_at
        d += 0.18 * np.exp(-(((xx - bx * W) / (bulge_r * W)) ** 2 + ((yy - by * H) / (bulge_r * H)) ** 2))
    d = np.clip(d, 0, 1) * (a > 4)
    return Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.5))


def cleat_source(src_dir):
    """Full pair of cleats from Pexels 27299906: BiRefNet cut-out clipped below the
    collar line (drops the ball behind), maker marks diffused away."""
    from rembg import remove, new_session
    im = Image.open(os.path.join(src_dir, "photos", "27299906.jpg")).convert("RGB")
    W0, H0 = im.size
    # Inpaint the swooshes / print: dark pixels in these boxes are filled by diffusion.
    boxes = [(1450, 1500, 2000, 2250), (1500, 1700, 1580, 1850), (1940, 1330, 2110, 1580), (760, 2400, 1060, 2550), (1700, 2150, 2040, 2440)]
    arr = np.asarray(im).astype(np.float32)
    lum = arr @ np.array([0.3, 0.59, 0.11], np.float32)
    mask = np.zeros(lum.shape, bool)
    for x0, y0, x1, y1 in boxes:
        mask[y0:y1, x0:x1] |= lum[y0:y1, x0:x1] < 110
    m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
    mk = np.asarray(m) > 0
    fill = arr.copy()
    fill[mk] = np.nan
    # Diffusion: repeatedly average known neighbours into the hole.
    for _ in range(220):
        pad = np.pad(fill, ((1, 1), (1, 1), (0, 0)), mode="edge")
        nb = np.stack([pad[:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, :-2], pad[1:-1, 2:]])
        avg = np.nanmean(nb, axis=0)
        upd = np.isnan(fill) & ~np.isnan(avg)
        fill[upd] = avg[upd]
        fill[mk] = np.where(np.isnan(avg[mk]), fill[mk], 0.6 * fill[mk] + 0.4 * avg[mk])
    fill = np.nan_to_num(fill, nan=200)
    im = Image.fromarray(fill.clip(0, 255).astype(np.uint8))
    out = remove(im, session=new_session("birefnet-general"), post_process_mask=True)
    keep = Image.new("L", (W0, H0), 0)
    ImageDraw.Draw(keep).polygon([(0, 1700), (796, 1700), (1000, 1731), (1206, 1625), (1300, 1537), (1412, 1462), (1525, 1362), (1600, 1287),
        (1650, 1225), (1675, 1187), (1725, 1181), (1812, 1225), (1875, 1269), (1950, 1350), (2037, 1450), (2087, 1550), (2125, 1650),
        (2150, 1750), (2160, 1810), (W0, 1810), (W0, H0), (0, H0)], fill=255)
    a = np.minimum(np.asarray(out.getchannel("A")), np.asarray(keep.filter(ImageFilter.GaussianBlur(2))))
    out.putalpha(Image.fromarray(a))
    return out.crop(out.getbbox())


def cleat(src_dir=None):
    W, H = 1600, 900
    if src_dir:
        src = cleat_source(src_dir)
    else:
        src = Image.open(os.path.join(ROOT, "cleats", "cleat-gold.webp")).convert("RGBA")
        src = src.crop(src.getbbox())
    l, t, r, b = 0.279, 0.174, 0.267, 0.2
    bw, bh = int(W * (1 - l - r)), int(H * (1 - t - b))
    s = min(bw / src.size[0], bh / src.size[1])
    src = src.resize((int(src.size[0] * s), int(src.size[1] * s)), Image.LANCZOS)
    src = src.filter(ImageFilter.UnsharpMask(1.2, 60, 2))
    # Metallic grade: luminance through a gold ramp with a contrast S-curve.
    arr = np.asarray(src).astype(np.float32) / 255
    lum = arr[..., :3] @ np.array([0.3, 0.59, 0.11], np.float32)
    lo, hi = np.percentile(lum[arr[..., 3] > 0.5], [3, 99])
    k = np.clip((lum - lo) / max(1e-3, hi - lo), 0, 1)
    k = k * k * (3 - 2 * k)
    if src_dir:
        k = k ** 2.1  # the pink pair is uniformly light: push its mid-tones into the gold
    stops = np.array([[0.16, 0.08, 0.01], [0.55, 0.33, 0.05], [0.86, 0.64, 0.2], [1.0, 0.88, 0.52], [1.0, 0.98, 0.86]], np.float32)
    pos = np.linspace(0, 1, len(stops))
    rgb = np.stack([np.interp(k, pos, stops[:, c]) for c in range(3)], -1)
    src = Image.fromarray((np.dstack([rgb, arr[..., 3]]) * 255).clip(0, 255).astype(np.uint8), "RGBA")
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(src, (int(W * l + (bw - src.size[0]) / 2), int(H * t + (bh - src.size[1]) / 2)))
    save(canvas, "partner-cleat.webp", 86)
    save(depth_from_alpha(np.asarray(canvas.getchannel("A")), (0.5, 0.45), 0.2).convert("RGB"), "partner-cleat-depth.webp", 80)


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def box_face(w, h, photo, base, accent, name, sub):
    face = Image.new("RGB", (w, h), base)
    ph = ImageOps.fit(Image.open(photo).convert("RGB"), (w, int(h * 0.62)), Image.LANCZOS, centering=(0.5, 0.25))
    # duotone the photo into the box colour
    g = np.asarray(ImageOps.grayscale(ph)).astype(np.float32) / 255
    c0, c1 = np.array(base, np.float32) / 255 * 0.35, np.array(accent, np.float32) / 255
    duo = (c0 + (c1 - c0) * g[..., None]) * 255
    face.paste(Image.fromarray(duo.clip(0, 255).astype(np.uint8)), (0, int(h * 0.2)))
    d = ImageDraw.Draw(face)
    disp = os.path.join(FONTS, "@fontsource", "audiowide", "files", "audiowide-latin-400-normal.woff")
    f1 = font(disp, int(w * 0.22))
    f2 = font(disp, int(w * 0.045))
    d.rectangle([0, 0, w, int(h * 0.2)], fill=accent)
    tw = d.textlength(name, font=f1)
    d.text(((w - tw) / 2, int(h * 0.02)), name, fill=base, font=f1)
    d.rectangle([0, int(h * 0.82), w, h], fill=base)
    sw = d.textlength(sub, font=f2)
    d.text(((w - sw) / 2, int(h * 0.86)), sub, fill=accent, font=f2)
    d.text((int(w * 0.06), int(h * 0.74)), "18", fill=accent, font=font(disp, int(w * 0.14)))
    return face


def quad(img, pts, size):
    """Warp img into the quadrilateral pts (tl, bl, br, tr) on a canvas of size."""
    W, H = size
    # PIL QUAD maps output->input; solve via perspective coefficients.
    def coeffs(pa, pb):
        A = []
        for (x, y), (u, v) in zip(pa, pb):
            A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
            A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        A = np.array(A, np.float64)
        B = np.array(pb, np.float64).reshape(8)
        return np.linalg.solve(A, B)
    w, h = img.size
    src = [(0, 0), (0, h), (w, h), (w, 0)]
    c = coeffs(pts, src)
    out = img.convert("RGBA").transform((W, H), Image.PERSPECTIVE, tuple(c), Image.BICUBIC)
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    out.putalpha(mask)
    return out


def forge():
    """Three box fronts fanned out (centre one in front), each with a drop shadow."""
    W, H = 1800, 1300
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fw, fh = 560, 860
    boxes = [  # photo, base, accent, x offset, rotation, y offset
        ("records/r10.webp", (44, 22, 82), (242, 199, 102), -430, 7, 70),
        ("reels/reel-02.webp", (79, 43, 171), (240, 228, 212), 430, -7, 70),
        ("career.webp", (28, 18, 46), (212, 162, 74), 0, 0, 0),
    ]
    for ph, base, acc, dx, rot, dy in boxes:
        face = box_face(fw, fh, os.path.join(ROOT, ph), base, acc, "FORGE", "PROTEIN BAR  ·  18 G")
        # bevel: light left edge, dark right edge (a box, not a card)
        f = np.asarray(face).astype(np.float32)
        ramp = np.linspace(1.12, 0.78, fw)[None, :, None]
        face = Image.fromarray(np.clip(f * ramp, 0, 255).astype(np.uint8))
        face = face.convert("RGBA").rotate(rot, Image.BICUBIC, expand=True)
        sh = Image.new("RGBA", face.size, (0, 0, 0, 0))
        sh.putalpha(face.getchannel("A").point(lambda v: int(v * 0.55)).filter(ImageFilter.GaussianBlur(28)))
        x = int(W / 2 + dx - face.size[0] / 2)
        y = int(H / 2 + dy - face.size[1] / 2)
        canvas.alpha_composite(sh, (x + 18, y + 36))
        canvas.alpha_composite(face, (x, y))
    bbox = canvas.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    save(canvas.crop(bbox), "partner-forge.webp", 84)


def rembg_cut(img, hole_seed=None):
    from rembg import remove, new_session
    out = remove(img.convert("RGB"), session=new_session("birefnet-general"), post_process_mask=True)
    a = np.asarray(out.getchannel("A")).astype(np.float32)
    a[a < 10] = 0
    if hole_seed:
        # Backdrop enclosed by the object (e.g. inside a headband): flood the
        # near-white region from the seed on the source photo and clear it.
        rgb = np.asarray(img.convert("RGB")).astype(np.int16)
        white = (rgb.min(axis=2) > 249) & (rgb.max(axis=2) - rgb.min(axis=2) < 4)
        m = Image.fromarray((white * 255).astype(np.uint8)).copy()  # own buffer: floodfill writes in place
        ImageDraw.floodfill(m, hole_seed, 128)
        hole = Image.fromarray(((np.asarray(m) == 128) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1))
        a *= 1 - np.asarray(hole).astype(np.float32) / 255
    out.putalpha(Image.fromarray(a.astype(np.uint8)))
    return out.crop(out.getbbox())


def halo(src_dir):
    im = Image.open(os.path.join(src_dir, "photos", "3394666.jpg")).convert("RGB")
    cut = rembg_cut(im, hole_seed=(im.size[0] // 2, int(im.size[1] * 0.45)))
    cut.thumbnail((1400, 1400), Image.LANCZOS)
    save(cut, "partner-halo.webp", 86)


def volta(src_dir):
    im = Image.open(os.path.join(src_dir, "photos", "34198837.jpg")).convert("RGB")
    W, H = im.size
    # Paint out the printed chest patch with shirt fabric from just left of it.
    box = (int(0.772 * W), int(0.752 * H), W, int(0.897 * H))
    w, h = box[2] - box[0], box[3] - box[1]
    patch = im.crop((box[0] - w - 20, box[1], box[0] - 20, box[3]))
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rectangle([18, 18, w - 18, h - 18], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(14))
    im.paste(patch, box[:2], m)
    cut = rembg_cut(im)
    cut.thumbnail((1500, 1500), Image.LANCZOS)
    save(cut, "partner-volta.webp", 86)


if __name__ == "__main__":
    import sys
    cleat(sys.argv[1] if len(sys.argv) > 1 else None)
    forge()
    if len(sys.argv) > 1:
        halo(sys.argv[1])
        volta(sys.argv[1])
