"""Procedural floodlit football field for the Influence section (replaces a stock photo).

Camera stands just behind the near sideline at the 50, eye ~1.5 m up, looking across the
field. The ground is ray-cast per pixel (2x supersampled), so turf grain, mowing stripes,
painted lines and numerals all foreshorten correctly. Then: floodlight pool, fog into the
page base (#2D2D2D) toward the horizon, distance blur and a dark grade.

  python apps/web/scripts/gen-field.py  ->  public/media/influence-field.webp (1440x1078)
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import gaussian_filter, map_coordinates

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "media", "influence-field.webp")
W, H, S = 1440, 1078, 2                      # output size, supersampling
FONT = "C:/Windows/Fonts/ROCKB.TTF"          # slab serif, close to painted field numerals
BASE = np.array([45, 45, 45], np.float32)    # page base colour the image dissolves into
rng = np.random.default_rng(50)

w, h = W * S, H * S
f = 1.0 * w                                   # focal length (px) ~ 53 deg horizontal FOV
cx, cy = w / 2, h / 2
theta = np.arctan(0.02 * h / f)               # slight downward pitch: horizon at 48% height
cam_h = 1.7                                   # yards
ZS = 5.55                                     # near sideline distance (yards, across-field axis)

v, u = np.mgrid[0:h, 0:w].astype(np.float32)
x = (u + 0.5 - cx) / f
y = (v + 0.5 - cy) / f
dy = -y * np.cos(theta) - np.sin(theta)
dz = -y * np.sin(theta) + np.cos(theta)
ground = dy < -1e-4
t = np.where(ground, cam_h / np.maximum(-dy, 1e-4), 1e4)
X = t * x                                     # along the sideline (yard lines are X = const)
Z = t * dz                                    # away from the camera
Z = np.minimum(Z, 400)

# ---------------- turf ----------------
def screen_noise(sig_x, sig_y):
    n = gaussian_filter(rng.standard_normal((h, w)).astype(np.float32), (sig_y, sig_x))
    return n / (n.std() + 1e-6)

# Blade grain whose size follows the ground footprint: near = coarse vertical blades,
# far = fine, squashed streaks. Blend a few precomputed scales by distance.
scales = [(1.3, 3.4, 9.0), (1.1, 2.0, 14.0), (1.0, 1.1, 22.0), (0.9, 0.6, 40.0), (0.7, 0.4, 1e9)]  # (sx, sy) in supersampled px
grain = np.zeros((h, w), np.float32)
prev_z, prev_n = 0.0, None
weights_total = np.zeros((h, w), np.float32)
for sx, sy, zmax in scales:
    n = screen_noise(sx, sy) * 0.7 + screen_noise(sx * 2.2, sy * 2.2) * 0.3
    centre = (prev_z + min(zmax, 80)) / 2
    wgt = np.exp(-((Z - centre) / max(min(zmax, 80) - prev_z, 4)) ** 2)
    grain += n * wgt
    weights_total += wgt
    prev_z = zmax if zmax < 1e8 else prev_z
grain /= np.maximum(weights_total, 1e-4)
grain /= grain.std() + 1e-6

def world_noise(scale_yd, octaves=3):
    """Low-frequency mottling sampled in world space (so it foreshortens)."""
    acc = np.zeros((h, w), np.float32)
    amp, sc = 1.0, scale_yd
    for _ in range(octaves):
        g = gaussian_filter(rng.standard_normal((256, 256)).astype(np.float32), 3, mode="wrap")
        g /= g.std()
        gi = (X / sc * 256 / 8) % 256
        gj = (Z / sc * 256 / 8) % 256
        acc += amp * map_coordinates(g, [gj.ravel(), gi.ravel()], order=1, mode="grid-wrap").reshape(h, w)
        amp *= 0.5
        sc /= 2.2
    return acc / acc.std()

mottle = world_noise(9.0)
stripes = np.where((np.floor((X + 2.5) / 5.0) % 2) == 0, 1.0, 0.9)  # mowing bands between yard lines
turf_lum = np.clip(1.0 + 0.48 * grain + 0.08 * mottle, 0.12, None)
turf = np.stack([50 * turf_lum, 80 * turf_lum, 24 * turf_lum], -1) * stripes[..., None]
# a few lighter dry tips
turf += (np.clip(grain - 1.8, 0, None) * 18)[..., None] * np.array([1.0, 1.0, 0.6])

# ---------------- paint ----------------
paint = np.zeros((h, w), np.float32)
LW = 0.12                                                     # 4" lines, in yards
field = (Z >= ZS) & (Z <= ZS + 53.33)
def band(a, lo, hi):
    return ((a >= lo) & (a <= hi)).astype(np.float32)

paint = np.maximum(paint, band(Z, ZS - 0.17, ZS + 0.17))      # near sideline (wide border)
for k in range(-50, 51, 5):                                   # yard lines every 5 yards
    paint = np.maximum(paint, band(X, k - LW / 2, k + LW / 2) * field)
for k in range(-50, 51):                                      # 1-yard ticks: sideline + inbounds
    if k % 5 == 0:
        continue
    for z0, z1 in ((ZS + 0.45, ZS + 1.15), (ZS + 23.3, ZS + 23.9), (ZS + 29.4, ZS + 30.0)):
        paint = np.maximum(paint, band(X, k - LW / 2, k + LW / 2) * band(Z, z0, z1))

# Numerals: drawn into a world-space canvas (100 px / yard), sampled through the projection.
PX = 100
nx0, nx1, nz0, nz1 = -26.0, 26.0, ZS + 5.0, ZS + 53.0
NZ0, NW, ND = ZS + 9.6, 2.2, 6.2   # near numerals: base, width, depth (yards)
canvas = Image.new("L", (int((nx1 - nx0) * PX), int((nz1 - nz0) * PX)), 0)
d = ImageDraw.Draw(canvas)
font = ImageFont.truetype(FONT, int(2.0 * PX * 1.36))
def numeral(txt, x_centre, z_base, flip=False):
    """2-yard-tall digit standing on z_base, readable from the near (or far) sideline."""
    tile = Image.new("L", (int(3 * PX), int(3 * PX)), 0)
    td = ImageDraw.Draw(tile)
    bb = td.textbbox((0, 0), txt, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    tile = tile.resize((tw + 4, th + 4))
    ImageDraw.Draw(tile).text((2 - bb[0], 2 - bb[1]), txt, font=font, fill=255)
    tile = tile.resize((int(NW * PX), int(ND * PX)), Image.LANCZOS)  # stretched in depth so it reads upright once foreshortened
    if not flip:
        tile = tile.transpose(Image.FLIP_TOP_BOTTOM)  # canvas rows run away from the camera
    px = int((x_centre - nx0) * PX - tile.width / 2)
    pz = int((z_base - nz0) * PX)
    canvas.paste(255, (px, pz), tile)

for yard, X0 in ((50, 0), (40, -10), (40, 10), (30, -20), (30, 20)):
    a, b = str(yard)
    numeral(a, X0 - 1.65, NZ0)
    numeral(b, X0 + 1.65, NZ0)
    numeral(b, X0 - 1.65, ZS + 53.33 - 8.0, flip=True)         # far side, upside down to us
    numeral(a, X0 + 1.65, ZS + 53.33 - 8.0, flip=True)
cv = np.asarray(canvas, np.float32) / 255.0
ci = (X - nx0) * PX
cj = (Z - nz0) * PX
inside = (ci >= 0) & (ci < cv.shape[1] - 1) & (cj >= 0) & (cj < cv.shape[0] - 1)
num = np.zeros((h, w), np.float32)
num[inside] = map_coordinates(cv, [cj[inside], ci[inside]], order=1)
paint = np.maximum(paint, num)

# painted grass: paint sits on blades, so it takes the grain and frays at the edges
paint *= np.clip(0.86 + 0.14 * grain, 0.45, 1.0)
paint *= (np.clip(grain, -3, 3) > -2.5)
line_col = np.array([206, 210, 200], np.float32) * (0.92 + 0.08 * np.clip(grain, -2, 2))[..., None]
img = turf * (1 - paint[..., None]) + line_col * paint[..., None]


# ---------------- light ----------------
def g2(a, b, sa, sb):
    return np.exp(-(a / sa) ** 2 - (b / sb) ** 2)

pool = 0.30 + 0.80 * g2(X, Z - (ZS + 12), 15, 11)
img *= pool[..., None]
# lateral vignette in screen space (floodlights from behind the camera)
sxn = (u / w - 0.5) * 2
img *= (1 - 0.38 * np.clip(np.abs(sxn) ** 2.2, 0, 1))[..., None]

# outside the near sideline: dark worn turf/track
outside = Z < ZS - 0.17
img = np.where(outside[..., None], img * 0.3 + BASE * 0.78, img)

# fog into the page base toward the horizon (and above it)
fog = 1 - np.exp(-np.clip(Z - ZS - 8, 0, None) / 34.0)
fog = np.where(ground, fog, 1.0)
img = img * (1 - fog[..., None]) + BASE * fog[..., None]
# soft dark band right at the horizon (stadium haze), then flat base above
hz = cy - f * np.tan(theta)
haze = np.exp(-((v - hz) / (0.035 * h)) ** 2)
img = img * (1 - 0.12 * haze[..., None]) + BASE * 0.12 * haze[..., None]
# bottom fade to base
bot = np.clip((v / h - 0.9) / 0.1, 0, 1) ** 1.5
img = img * (1 - bot[..., None]) + BASE * bot[..., None]

# ---------------- depth of field ----------------
inv = 1.0 / np.maximum(Z, 0.1) - 1.0 / (ZS + 10)
coc = np.where(inv > 0, inv * 14, -inv * 110) * S   # px; near side stays crisp, distance goes soft
coc = np.where(ground, coc, 0)
coc = np.clip(coc, 0, 9 * S)
levels = [0, 1.2 * S, 2.6 * S, 4.8 * S, 9.0 * S]
stack = [img] + [np.stack([gaussian_filter(img[..., c], s) for c in range(3)], -1) for s in levels[1:]]
out = np.zeros_like(img)
for i in range(len(levels) - 1):
    lo, hi = levels[i], levels[i + 1]
    m = (coc >= lo) & (coc <= hi)
    tt = ((coc - lo) / (hi - lo))[..., None]
    mix = stack[i] * (1 - tt) + stack[i + 1] * tt
    out = np.where(m[..., None], mix, out)
out = np.where((coc > levels[-1])[..., None], stack[-1], out)

# ---------------- grade + downsample ----------------
lum = out.mean(-1, keepdims=True)
out = lum + (out - lum) * 0.92                                   # a touch less saturated
out = BASE + (out - BASE) * 1.06
res = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB").resize((W, H), Image.LANCZOS)
# fine film grain so the flat base matches the rest of the page
a = np.asarray(res, np.float32) + rng.normal(0, 1.4, (H, W, 1))
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB").save(OUT, quality=72, method=6)
print("wrote", os.path.normpath(OUT))
