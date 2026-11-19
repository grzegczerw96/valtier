"""Soft window-light washes (white on transparent) blended with soft-light.

  python apps/web/scripts/gen-lights.py

light-wash.webp  : two slanted shafts with stepped (window-frame) edges — Home hero.
light-spot.webp  : one shaft from the top-left corner — Signature Moments stage.
Rendered small and heavily blurred: they are only ever shown scaled up and soft.
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures")
W, H = 960, 540


def shaft(polys, blur, alpha=255):
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon([(x * W, y * H) for x, y in p], fill=alpha)
    return m.filter(ImageFilter.GaussianBlur(blur))


def save(mask, name):
    img = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    img.putalpha(mask)
    p = os.path.join(OUT, name)
    img.save(p, "WEBP", quality=70, method=6)
    print(name, os.path.getsize(p) // 1024, "KB")


wash = shaft(
    [
        # left shaft with a stepped right edge (window mullions)
        [(0.0, 0.0), (0.36, 0.0), (0.33, 0.12), (0.43, 0.14), (0.38, 0.3), (0.29, 0.27), (0.25, 0.45), (0.22, 1.0), (0.0, 1.0)],
        # right shaft, wide at the bottom
        [(0.74, 0.0), (0.93, 0.0), (0.88, 0.52), (1.0, 0.46), (1.0, 1.0), (0.47, 1.0)],
    ],
    34,
)
base = Image.new("L", (W, H), 92)  # faint overall lift, like a lit room
wash = Image.composite(Image.new("L", (W, H), 255), base, wash)
save(wash, "light-wash.webp")

spot = shaft(
    [[(0.0, 0.0), (0.58, 0.0), (0.62, 0.08), (0.5, 0.1), (0.53, 0.2), (0.4, 0.22), (0.42, 0.34), (0.3, 0.38), (0.15, 1.0), (0.0, 1.0)]],
    40,
)
save(spot, "light-spot.webp")


# Paper grain for instant-photo mats (multiply): fine warm-grey noise, tileable.
import numpy as np
g = np.random.default_rng(7)
n = g.normal(0, 1, (256, 256))
for k in (1, 2):
    n += np.roll(n, k, 0) * 0.35 + np.roll(n, k, 1) * 0.35
n = (n - n.min()) / (n.max() - n.min())
v = (228 + (n - 0.5) * 34).clip(0, 255).astype("uint8")
paper = Image.fromarray(np.dstack([v, (v * 0.985).astype("uint8"), (v * 0.96).astype("uint8")]), "RGB")
p = os.path.join(OUT, "paper-grain.webp")
paper.save(p, "WEBP", quality=60, method=6)
print("paper-grain.webp", os.path.getsize(p) // 1024, "KB")
