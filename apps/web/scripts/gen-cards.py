"""Procedural "signature moment" trading cards for the Home page.

  python apps/web/scripts/gen-cards.py

Takes existing photos from public/media (Pexels, see MEDIA.md), grades them into the
Wolves purple, adds a glow, gold dust and a bevelled metallic gold frame with
chamfered notches. Output: public/media/cards/card-01..05.webp (640x938, the aspect
of the reference cards). Needs Pillow + numpy.
"""
import os
import numpy as np
from PIL import Image, ImageOps, ImageFilter, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "media")
OUT = os.path.join(ROOT, "cards")
W, H = 640, 938
R = 26  # corner radius

# (source, zoom, vertical anchor of the subject box)
CARDS = [
    ("career.webp", 1.25, 0.18),
    ("records/r10.webp", 1.35, 0.12),
    ("reels/reel-02.webp", 1.3, 0.10),
    ("records/r16.webp", 1.0, 0.06),
    ("reels/reel-03.webp", 1.3, 0.12),
]


def rng(i):
    return np.random.default_rng(1800 + i)


_session = None


def subject_mask(im):
    global _session
    from rembg import remove, new_session
    if _session is None:
        _session = new_session("isnet-general-use")
    return remove(im, session=_session, only_mask=True, post_process_mask=True)


def photo(path, zoom, anchor):
    src = ImageOps.exif_transpose(Image.open(os.path.join(ROOT, path))).convert("RGB")
    m = subject_mask(src)
    bx = m.point(lambda v: 255 if v > 128 else 0).getbbox() or (0, 0, *src.size)
    # Crop around the subject: subject height fills the card / zoom, top anchored.
    sh = (bx[3] - bx[1])
    ch = min(src.size[1], sh / zoom * 1.0 + sh * 0.0)
    ch = max(ch, src.size[1] * 0.45)
    cw = ch * W / H
    cx = (bx[0] + bx[2]) / 2
    top = max(0, bx[1] - ch * anchor)
    left = min(max(0, cx - cw / 2), max(0, src.size[0] - cw))
    box = (int(left), int(top), int(left + cw), int(top + ch))
    im = src.crop(box).resize((W, H), Image.LANCZOS)
    mk = m.crop(box).resize((W, H), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255
    k = np.asarray(mk.filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)[..., None] / 255
    # Background: heavy blur, crushed and pushed into violet.
    bg = np.asarray(im.filter(ImageFilter.GaussianBlur(18))).astype(np.float32) / 255
    bl = bg @ np.array([0.299, 0.587, 0.114], np.float32)
    bg = bl[..., None] * np.array([0.36, 0.2, 0.62], np.float32) * 0.85 + np.array([0.05, 0.02, 0.1], np.float32)
    a = a * k + bg * (1 - k)
    # Contrast + purple split-tone (shadows violet, highlights warm).
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    a = np.clip((a - 0.5) * 1.18 + 0.52, 0, 1)
    shadow = np.array([0.30, 0.14, 0.55], np.float32)
    high = np.array([1.0, 0.92, 0.78], np.float32)
    tone = shadow[None, None] * (1 - lum[..., None]) + high[None, None] * lum[..., None]
    a = a * 0.72 + tone * a * 0.5
    return a


def glow_and_dust(a, i):
    g = rng(i)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # Purple rim light from the top corners + warm burst low left.
    for cx, cy, rad, col, k in [(W * 0.05, H * 0.08, 380, (0.55, 0.3, 1.0), 0.55), (W * 0.98, H * 0.18, 340, (0.62, 0.34, 1.0), 0.5), (W * 0.1, H * 0.92, 260, (1.0, 0.72, 0.25), 0.45)]:
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / rad
        f = np.clip(1 - d, 0, 1) ** 2 * k
        a = a + f[..., None] * np.array(col, np.float32)
    # Light streaks (diagonal).
    streak = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(streak)
    for _ in range(7):
        x0 = g.uniform(-W * 0.3, W * 0.6)
        y0 = g.uniform(0, H * 0.7)
        L = g.uniform(160, 420)
        d.line([(x0, y0), (x0 + L, y0 - L * 0.35)], fill=int(g.uniform(70, 160)), width=int(g.uniform(1, 3)))
    streak = np.asarray(streak.filter(ImageFilter.GaussianBlur(1.6))).astype(np.float32) / 255
    a = a + streak[..., None] * np.array([0.75, 0.5, 1.0], np.float32)
    # Gold dust.
    dust = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(dust)
    for _ in range(900):
        x, y = g.uniform(0, W), g.uniform(0, H) ** 1.0
        if g.random() < 0.55:
            y = g.uniform(0, H * 0.45)
        r = g.choice([0.6, 0.9, 1.3, 2.0], p=[0.5, 0.3, 0.15, 0.05])
        d.ellipse([x - r, y - r, x + r, y + r], fill=int(g.uniform(90, 255)))
    dust = np.asarray(dust.filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255
    a = a + dust[..., None] * np.array([1.0, 0.78, 0.35], np.float32) * 0.9
    return np.clip(a, 0, 1)


def window_poly(inset):
    """Inner window: chamfered rectangle with a deeper right-hand notch and a thicker bottom-left foot."""
    t, l, r, b = 22 + inset, 22 + inset, W - 22 - inset, H - 22 - inset
    nr = W - 44 - inset  # right notch line
    foot = H - 58 - inset
    c = 18
    return [
        (l + c, t), (r - c, t), (r, t + c),
        (r, H * 0.2), (nr, H * 0.2 + 22), (nr, H * 0.69 - 22), (r, H * 0.69),
        (r, b - c), (r - c, b),
        (W * 0.32, b), (W * 0.32 - 26, foot), (l + c, foot), (l, foot - c),
        (l, t + c),
    ]


def gold(i):
    g = rng(i + 50)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = (xx * 0.35 + yy) / (H + W * 0.35)
    bands = 0.55 + 0.25 * np.sin(u * 22 + 1.3) + 0.15 * np.sin(u * 57 + 0.4) + 0.08 * np.sin(u * 131)
    brushed = np.asarray(Image.fromarray((g.random((H, W)) * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(0)).resize((W, H))).astype(np.float32) / 255
    brushed = np.asarray(Image.fromarray((brushed * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((0, 0)) if False else ImageFilter.BoxBlur(3))).astype(np.float32) / 255
    v = np.clip(bands + (brushed - 0.5) * 0.18, 0, 1.2)
    dark = np.array([0.42, 0.25, 0.02], np.float32)
    mid = np.array([0.86, 0.62, 0.16], np.float32)
    lite = np.array([1.0, 0.93, 0.62], np.float32)
    col = np.where(v[..., None] < 0.6, dark + (mid - dark) * (v[..., None] / 0.6), mid + (lite - mid) * np.clip((v[..., None] - 0.6) / 0.5, 0, 1))
    return col


def mask_from_poly(poly, blur=0):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    if blur:
        m = m.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(m).astype(np.float32) / 255


def card(i, path, zoom, anchor):
    a = glow_and_dust(photo(path, zoom, anchor), i)
    frame = gold(i)
    outer = Image.new("L", (W, H), 0)
    ImageDraw.Draw(outer).rounded_rectangle([0, 0, W - 1, H - 1], R, fill=255)
    outer = np.asarray(outer).astype(np.float32) / 255
    win = mask_from_poly(window_poly(0))
    # Bevel: light inner edge + dark outer edge of the window and of the card.
    edge_in = np.clip(mask_from_poly(window_poly(-5), 2.2) - win, 0, 1)
    edge_out = np.clip(outer - np.asarray(Image.fromarray((outer * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9))).astype(np.float32) / 255, 0, 1)
    shade = 1 + edge_in[..., None] * 0.55 - edge_out[..., None] * 0.35
    frame = np.clip(frame * shade, 0, 1)
    # Inner glow of gold onto the photo.
    halo = np.clip(mask_from_poly(window_poly(-2), 14) - mask_from_poly(window_poly(10), 14), 0, 1)
    a = np.clip(a + halo[..., None] * np.array([0.9, 0.6, 0.15], np.float32) * 0.5, 0, 1)
    rgb = a * win[..., None] + frame * (1 - win[..., None])
    out = np.dstack([rgb, outer])
    img = Image.fromarray((out * 255).astype(np.uint8), "RGBA")
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"card-{i + 1:02d}.webp")
    img.save(p, "WEBP", quality=80, method=6)
    print(p, os.path.getsize(p) // 1024, "KB")


if __name__ == "__main__":
    for i, (path, zoom, anchor) in enumerate(CARDS):
        card(i, path, zoom, anchor)
