"""Partnership visuals for the Home page.

  python apps/web/scripts/gen-partner-art.py

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


def cleat():
    W, H = 1600, 900
    src = Image.open(os.path.join(ROOT, "cleats", "cleat-gold.webp")).convert("RGBA")
    src = src.crop(src.getbbox())
    l, t, r, b = 0.279, 0.174, 0.267, 0.2
    bw, bh = int(W * (1 - l - r)), int(H * (1 - t - b))
    s = min(bw / src.size[0], bh / src.size[1])
    src = src.resize((int(src.size[0] * s), int(src.size[1] * s)), Image.LANCZOS)
    src = src.filter(ImageFilter.UnsharpMask(1.2, 60, 2))
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


if __name__ == "__main__":
    cleat()
    forge()
