"""Generates stand-in media so the page runs before real photography is dropped in.

  python -I apps/web/scripts/gen-placeholders.py [--force]

Existing files are kept unless --force is passed, so real assets are never overwritten.
"""
import os, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "media")
FORCE = "--force" in sys.argv
rng = np.random.default_rng(7)


def out(rel):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def save(img, rel, q=72):
    p = out(rel)
    if os.path.exists(p) and not FORCE:
        return
    img.save(p, quality=q, method=6)
    print("wrote", rel, os.path.getsize(p) // 1024, "KB")


def font(size):
    for f in ["C:/Windows/Fonts/arialbd.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def stadium(w, h, hue=(79, 43, 171), label=None):
    """Blurry floodlit-stadium abstraction: dark gradient, light blobs, bokeh."""
    y = np.linspace(0, 1, h)[:, None]
    base = np.zeros((h, w, 3), np.float32)
    top = np.array([20, 16, 32], np.float32)
    bot = np.array(hue, np.float32) * 0.55
    base[:] = top + (bot - top) * (y ** 1.2)[..., None]
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(60):
        x, yy, r = rng.uniform(0, w), rng.uniform(0, h * 0.55), rng.uniform(w * 0.01, w * 0.05)
        c = tuple(int(v) for v in (rng.uniform(180, 255), rng.uniform(160, 230), rng.uniform(200, 255))) + (int(rng.uniform(40, 120)),)
        d.ellipse([x - r, yy - r, x + r, yy + r], fill=c)
    img = img.filter(ImageFilter.GaussianBlur(w * 0.012))
    d = ImageDraw.Draw(img, "RGBA")
    # field band + yard lines
    d.rectangle([0, h * 0.72, w, h], fill=(26, 70, 38, 230))
    for i in range(-3, 14):
        x0 = w * (i / 10)
        d.line([(x0, h * 0.72), (x0 - w * 0.08, h)], fill=(230, 230, 230, 90), width=max(2, w // 300))
    if label:
        d.text((w * 0.04, h * 0.05), label, fill=(244, 239, 230, 120), font=font(max(14, w // 28)))
    return img


def football(w=600, h=377):
    img = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy, rx, ry = w, h, w * 0.92, h * 0.86
    # leather body with radial shading
    yy, xx = np.mgrid[0 : h * 2, 0 : w * 2]
    nx, ny = (xx - cx) / rx, (yy - cy) / ry
    inside = nx ** 2 + ny ** 2 <= 1
    shade = np.clip(1 - (nx + 0.35) ** 2 * 0.5 - (ny + 0.45) ** 2 * 0.7, 0.25, 1)
    grain = rng.normal(0, 0.06, shade.shape)
    col = np.stack([128 * shade + 30 * grain * 255 / 255, 58 * shade, 38 * shade], -1)
    arr = np.zeros((h * 2, w * 2, 4), np.uint8)
    arr[..., :3] = np.clip(col + grain[..., None] * 40, 0, 255).astype(np.uint8)
    arr[..., 3] = inside * 255
    img = Image.fromarray(arr, "RGBA")
    d = ImageDraw.Draw(img)
    d.line([(cx - rx * 0.92, cy), (cx + rx * 0.92, cy)], fill=(70, 30, 20, 255), width=6)
    d.line([(cx - rx * 0.3, cy - ry * 0.52), (cx + rx * 0.3, cy - ry * 0.52)], fill=(245, 240, 232, 255), width=10)
    for i in range(8):
        x = cx - rx * 0.26 + i * rx * 0.074
        d.line([(x, cy - ry * 0.62), (x, cy - ry * 0.42)], fill=(245, 240, 232, 255), width=9)
    for s in (-1, 1):
        d.line([(cx + s * rx * 0.62, cy - ry * 0.55), (cx + s * rx * 0.66, cy + ry * 0.55)], fill=(240, 236, 228, 230), width=12)
    return img.resize((w, h), Image.LANCZOS)


def blob(w, h, fill, label):
    """Generic cut-out stand-in: soft-edged rounded shape on transparency."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([w * 0.12, h * 0.18, w * 0.88, h * 0.86], radius=int(min(w, h) * 0.22), fill=fill)
    d.text((w * 0.2, h * 0.45), label, fill=(20, 16, 25, 200), font=font(max(14, w // 14)))
    return img


def cleat(w=528, h=472, c=(200, 40, 50)):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(w * .06, h * .62), (w * .3, h * .32), (w * .52, h * .22), (w * .62, h * .3), (w * .95, h * .62), (w * .9, h * .74), (w * .1, h * .74)], fill=c + (255,))
    d.polygon([(w * .3, h * .32), (w * .52, h * .22), (w * .58, h * .44), (w * .36, h * .5)], fill=(245, 240, 232, 255))
    d.rectangle([w * .08, h * .72, w * .92, h * .78], fill=(230, 230, 235, 255))
    for i in range(6):
        x = w * (.15 + i * .13)
        d.polygon([(x, h * .78), (x + w * .04, h * .78), (x + w * .02, h * .88)], fill=(210, 210, 220, 255))
    return img


if __name__ == "__main__":
    save(stadium(1600, 900, label=None), "hero-poster.webp", 62)
    save(stadium(780, 1400, label=None), "hero-poster-phone.webp", 62)
    save(stadium(938, 1386, (180, 80, 40), "CAREER"), "career.webp")
    for i in range(16):
        hue = [(79, 43, 171), (40, 90, 160), (150, 60, 60), (60, 120, 80)][i % 4]
        save(stadium(304 * 2, 405 * 2, hue, f"R{i + 1:02d}"), f"records/r{i + 1:02d}.webp", 66)
    field = stadium(1440, 1078, (30, 110, 50))
    save(field, "influence-field.webp", 62)
    save(blob(660, 660, (108, 74, 162, 255), "PLAYER"), "influence-player.webp")
    save(football(), "football.webp", 80)
    save(blob(1079, 1071, (235, 235, 240, 255), "GLOVES"), "gloves.webp")
    palette = [(200, 40, 50), (40, 40, 60), (108, 74, 162), (200, 200, 210), (170, 175, 185), (240, 240, 240), (212, 162, 74), (40, 130, 200), (150, 150, 170), (235, 235, 240)]
    for i, c in enumerate(palette):
        save(cleat(c=c), f"cleats/c{i + 1:02d}.webp", 80)
    save(cleat(c=(212, 162, 74)), "cleats/cleat-gold.webp", 80)
    for i in range(9):
        save(stadium(438, 856, [(79, 43, 171), (40, 90, 160), (150, 60, 60)][i % 3], f"REEL {i + 1}"), f"reels/reel-{i + 1:02d}.webp", 64)
    save(blob(900, 1200, (40, 120, 220, 255), "PLAYER"), "footer-player.webp")
