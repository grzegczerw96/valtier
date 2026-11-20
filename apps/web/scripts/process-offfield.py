"""Off-Field media: turns the Pexels originals into public/media/off/*.

  cd <an empty dir> && python -E apps/web/scripts/process-offfield.py <source-dir> [only]

<source-dir> holds photos/<pexels-id>.jpg and video/<pexels-id>.mp4 (ids in MEDIA.md).
`only` limits the run to one group: photos | pieces | footer | video.
Needs Pillow, numpy, rembg 2.0.50 (BiRefNet) and ffmpeg on PATH. rembg lives in the
user site-packages, so run with `python -E` (not -I) from an empty working directory.
"""
import os, sys, subprocess
import numpy as np
from PIL import Image, ImageOps, ImageFilter, ImageEnhance

SRC = os.path.abspath(sys.argv[1])
ONLY = sys.argv[2] if len(sys.argv) > 2 else None
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "media", "off")
PH = os.path.join(SRC, "photos")
VID = os.path.join(SRC, "video")


def want(group):
    return ONLY in (None, group)


def load(i):
    return ImageOps.exif_transpose(Image.open(os.path.join(PH, f"{i}.jpg"))).convert("RGB")


def save(img, rel, q=72):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "WEBP", quality=q, method=6)
    print(f"{rel:34s} {img.size[0]}x{img.size[1]}  {os.path.getsize(path) // 1024} KB")


def crop_frac(img, box):
    W, H = img.size
    return img.crop((int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H)))


def fit_h(img, h):
    w = round(img.size[0] * h / img.size[1])
    return img.resize((w, h), Image.LANCZOS)


_session = None


def cutout(img):
    global _session
    from rembg import remove, new_session
    if _session is None:
        _session = new_session("birefnet-general")
    out = remove(img, session=_session, post_process_mask=False)
    a = np.array(out.split()[-1]).astype(np.float32)
    a[a < 10] = 0
    out.putalpha(Image.fromarray(a.astype(np.uint8)))
    return out


# --- stills -------------------------------------------------------------------
# Fashion rail: native aspect ratios, 1000 px tall (rail tiles are <= 691 px).
FASHION = [
    ("f01", 9573699, None),
    ("f02", 9573695, None),
    ("f03", 9573702, None),
    ("f04", 9573689, None),
    ("f05", 10220087, None),
    ("f06", 9573693, None),
    ("f07", 9573705, None),
    ("f08", 9573712, None),
    ("f09", 10220084, None),
]
# Appearances photos: cropped clear of sponsor boards, club crests and shirt text.
APPEAR = [
    ("a01", 39757695, (0.0, 0.31, 0.625, 0.95)),   # smoke over the pitch, left of the banners
    ("a02", 12153279, (0.42, 0.0, 1.0, 0.5)),      # the stands, away from the printed shirt and the backpack
    ("a03", 7594122, None),                        # red carpet
    ("a04", 30132631, (0.0, 0.0, 0.9, 1.0)),       # photographer at an event (shirt at the edge cut)
]

if want("photos"):
    # Hero print (514 x 668 window): Nico from Pexels 9573692, standing, hand on his glasses.
    hero = crop_frac(load(9573692), (0.545, 0.045, 1.0, 0.45))
    hero = ImageOps.fit(hero, (1028, 1336), Image.LANCZOS, centering=(0.5, 0.3))
    save(hero, "hero-print.webp", 74)
    for name, pid, box in FASHION:
        im = load(pid)
        if box:
            im = crop_frac(im, box)
        save(fit_h(im, 1000), f"fashion/{name}.webp", 70)
    for name, pid, box in APPEAR:
        im = load(pid)
        if box:
            im = crop_frac(im, box)
        save(fit_h(im, 1000), f"appear/{name}.webp", 70)

# --- eyewear "pieces" (cut-outs on a 2:1 canvas, like the reference's 1600x800) -----
PIECES = [
    # name, pexels id, colourway: (hue shift deg, saturation, brightness, tint rgb or None)
    ("p01", 10220082, None),  # (rows below the table line are cropped: see YMAX)
    ("p02", 10220085, (0, 1.0, 1.0, (168, 120, 236))),   # violet lenses
    ("p03", 10220089, (0, 1.0, 1.0, (238, 172, 26))),    # gold
    ("p04", 10220086, (0, 1.0, 0.92, (120, 128, 140))),  # smoke
    ("p05", 10220083, (0, 1.0, 1.0, (232, 132, 164))),   # rose
]


# Source rows below the glossy table line (reflections) are dropped before the cut-out.
YMAX = {10220082: 1060, 10220089: 1032}


def tint(img, rgb, amount=0.55):
    """Colour the mid-tones (lenses/metal) toward rgb while keeping highlights."""
    a = img.split()[-1]
    rgbim = img.convert("RGB")
    g = np.array(ImageOps.grayscale(rgbim)).astype(np.float32) / 255
    col = np.array(rgb, dtype=np.float32)[None, None, :] / 255
    base = np.array(rgbim).astype(np.float32) / 255
    # overlay-style: dark stays dark, mids pick up the tint, speculars stay white
    over = np.where(g[..., None] < 0.5, 2 * g[..., None] * col, 1 - 2 * (1 - g[..., None]) * (1 - col))
    mix = base * (1 - amount) + over * amount
    out = Image.fromarray(np.clip(mix * 255, 0, 255).astype(np.uint8), "RGB")
    out.putalpha(a)
    return out


if want("pieces"):
    for name, pid, cw in PIECES:
        src = load(pid)
        if pid in YMAX:
            src = src.crop((0, 0, src.size[0], YMAX[pid]))
        cut = cutout(src)
        bbox = cut.getbbox()
        cut = cut.crop(bbox)
        if cw:
            cut = tint(cut, cw[3])
            if cw[2] != 1.0:
                a = cut.split()[-1]
                cut = ImageEnhance.Brightness(cut.convert("RGB")).enhance(cw[2]).convert("RGBA")
                cut.putalpha(a)
        W, H = 960, 480
        c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        im = cut.copy()
        im.thumbnail((int(W * 0.94), int(H * 0.86)), Image.LANCZOS)
        c.alpha_composite(im, ((W - im.size[0]) // 2, (H - im.size[1]) // 2))
        save(c, f"pieces/{name}.webp", 80)

# --- footer portrait ------------------------------------------------------------
if want("footer"):
    im = load(9573695)
    cut = cutout(im)
    a = cut.split()[-1]
    g = ImageOps.grayscale(cut.convert("RGB"))
    g = ImageEnhance.Contrast(g).enhance(1.08)
    out = Image.merge("RGBA", (g, g, g, a))
    bbox = out.getbbox()
    out = out.crop((bbox[0], bbox[1], im.size[0], im.size[1]))  # keep the bottom/right frame edges
    out = out.resize((round(out.size[0] * 1200 / out.size[1]), 1200), Image.LANCZOS)
    # Square canvas, subject anchored bottom-right (same framing as footer-player.webp).
    sq = Image.new("RGBA", (1200, 1200), (0, 0, 0, 0))
    sq.alpha_composite(out, (1200 - out.size[0], 0))
    save(sq, "footer-portrait.webp", 78)


# --- video ----------------------------------------------------------------------
def ff(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


# name, source id, start s, duration s, crop (w:h:x:y in source px) or None, out w, out h[, crf]
CLIPS = [
    # Digital phones (9:16)
    ("phones/ph01", 8128031, 0.0, 7.0, None, 540, 960),
    ("phones/ph02", 9517666, 1.0, 6.5, "1080:1920:0:64", 540, 960),
    ("phones/ph03", 10349049, 6.2, 7.0, "1080:1920:0:64", 540, 960),
    ("phones/ph04", 36521302, 0.0, 7.5, "608:1080:780:0", 540, 960),
    ("phones/ph05", 34631716, 0.5, 6.0, None, 540, 960, 32),
    # Appearances / Features (16:9)
    ("appear/v01", 6878209, 2.0, 8.0, None, 1280, 720),
    ("appear/v02", 36521302, 0.0, 7.6, None, 1280, 720),
    ("appear/v03", 7586489, 3.0, 8.0, None, 1280, 720),
    ("appear/v04", 39239777, 2.0, 6.0, "1120:630:0:450", 1280, 720, 32),
]

CLIP_ONLY = os.environ.get("CLIP")
if want("video"):
    for name, vid, ss, dur, crop, w, h, *rest in CLIPS:
        if CLIP_ONLY and CLIP_ONLY not in name:
            continue
        crf = str(rest[0]) if rest else ("29" if h > w else "28")
        src = os.path.join(VID, f"{vid}.mp4")
        out = os.path.join(OUT, f"{name}.mp4")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        vf = (f"crop={crop}," if crop else "") + f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps=25,format=yuv420p"
        ff(["-ss", str(ss), "-t", str(dur), "-i", src, "-an", "-vf", vf, "-c:v", "libx264", "-preset", "slow",
            "-crf", crf, "-profile:v", "high", "-movflags", "+faststart", out])
        poster = os.path.join(OUT, f"{name}.webp")
        ff(["-i", out, "-frames:v", "1", "-c:v", "libwebp", "-quality", "70", poster])
        print(f"{name}.mp4  {os.path.getsize(out) // 1024} KB  poster {os.path.getsize(poster) // 1024} KB")
