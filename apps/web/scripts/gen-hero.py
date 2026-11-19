"""Home hero assets for the WebGL depth portrait.

  python apps/web/scripts/gen-hero.py <source-image> <lens-spec> [--cutout]

<source-image>  photo (or RGBA cut-out) of the athlete facing the camera.
<lens-spec>     lens shapes in source-image UV, "cx,cy,rx,ry[,rot];..." (ellipses;
                one per lens or one for a visor).
--cutout        remove the background with rembg (isnet-general-use) first.

Writes public/media/hero/:
  portrait.webp        1600x1151 RGBA, subject centred, feet off the bottom edge
  portrait-depth.webp  grey depth (white = near): dome from the silhouette + head bulge
  portrait-lens.webp   R = lens mask, G = gloss streak (screen-blended in the shader)
and prints the lens centre to paste into content/home.ts (hero.portrait.lensCenter).
"""
import os, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "media", "hero")
W, H = 1600, 1151


def cutout(img):
    from rembg import remove, new_session
    return remove(img.convert("RGB"), session=new_session("isnet-general-use"), post_process_mask=True)


def place(src):
    """Fit the subject so it spans ~92% of the canvas height, centred, cropped at the bottom."""
    bbox = src.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox() or (0, 0, *src.size)
    sub = src.crop(bbox)
    scale = (H * 1.02) / sub.size[1]
    sub = sub.resize((max(1, round(sub.size[0] * scale)), max(1, round(sub.size[1] * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    x = (W - sub.size[0]) // 2
    y = round(H * 0.06)
    canvas.alpha_composite(sub, (x, y))
    return canvas, (bbox, scale, x, y)


def to_canvas(u, v, src_size, geo):
    (bx0, by0, _, _), scale, x, y = geo
    return ((u * src_size[0] - bx0) * scale + x) / W, ((v * src_size[1] - by0) * scale + y) / H


def depth_from_alpha(a, head):
    m = Image.fromarray(a)
    acc = np.zeros(a.shape, np.float32)
    for r, w in ((6, 0.2), (18, 0.3), (48, 0.3), (110, 0.2)):
        acc += np.asarray(m.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255 * w
    acc = np.clip(acc, 0, 1) ** 0.8
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    hx, hy, hr = head
    bulge = np.exp(-(((xx - hx) / (hr * 1.0)) ** 2 + ((yy - hy) / (hr * 1.25)) ** 2))
    d = np.clip(0.18 + 0.62 * acc + 0.28 * bulge, 0, 1) * (a.astype(np.float32) / 255 > 0.02)
    d = np.asarray(Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)))
    return d


def lens_maps(specs, geo, src_size):
    mask = Image.new("L", (W, H), 0)
    gloss = Image.new("L", (W, H), 0)
    dm, dg = ImageDraw.Draw(mask), ImageDraw.Draw(gloss)
    cx_all, cy_all = [], []
    for s in specs:
        u, v, ru, rv, *rot = s
        cu, cv = to_canvas(u, v, src_size, geo)
        rx = ru * src_size[0] * geo[1]
        ry = rv * src_size[1] * geo[1]
        cx, cy = cu * W, cv * H
        cx_all.append(cu); cy_all.append(cv)
        ang = math.radians(rot[0]) if rot else 0
        pts = [(cx + rx * math.cos(t) * math.cos(ang) - ry * math.sin(t) * math.sin(ang), cy + rx * math.cos(t) * math.sin(ang) + ry * math.sin(t) * math.cos(ang)) for t in np.linspace(0, 2 * math.pi, 96)]
        dm.polygon(pts, fill=255)
        # Gloss: a diagonal streak across the upper part of the lens.
        dg.polygon([(cx - rx * 0.9, cy - ry * 0.1), (cx - rx * 0.35, cy - ry * 0.95), (cx - rx * 0.05, cy - ry * 0.95), (cx - rx * 0.6, cy + ry * 0.1)], fill=200)
        dg.polygon([(cx + rx * 0.1, cy + ry * 0.2), (cx + rx * 0.45, cy - ry * 0.5), (cx + rx * 0.58, cy - ry * 0.5), (cx + rx * 0.22, cy + ry * 0.25)], fill=120)
    mask = mask.filter(ImageFilter.GaussianBlur(1.5))
    gloss = Image.fromarray(np.minimum(np.asarray(gloss.filter(ImageFilter.GaussianBlur(10))), np.asarray(mask))).convert("L")
    img = Image.merge("RGB", (mask, gloss, Image.new("L", (W, H), 0)))
    return img, (sum(cx_all) / len(cx_all), sum(cy_all) / len(cy_all))


def main():
    src_path, spec = sys.argv[1], sys.argv[2]
    specs = [tuple(float(x) for x in s.split(",")) for s in spec.split(";") if s.strip()]
    src = ImageOps.exif_transpose(Image.open(src_path)).convert("RGBA")
    if "--cutout" in sys.argv:
        src = cutout(src)
    canvas, geo = place(src)
    os.makedirs(OUT, exist_ok=True)
    canvas.save(os.path.join(OUT, "portrait.webp"), "WEBP", quality=82, method=6)
    a = np.asarray(canvas.getchannel("A"))
    lens, (lu, lv) = lens_maps(specs, geo, src.size)
    head = (lu * W, lv * H, 0.16 * W)
    d = depth_from_alpha(a, head)
    Image.fromarray(d).save(os.path.join(OUT, "portrait-depth.webp"), "WEBP", quality=85)
    lens.save(os.path.join(OUT, "portrait-lens.webp"), "WEBP", quality=90)
    for f in ("portrait.webp", "portrait-depth.webp", "portrait-lens.webp"):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB")
    print(f"lensCenter: [{lu:.4f}, {lv:.4f}]")


if __name__ == "__main__":
    main()
