"""Turns the downloaded Pexels originals into the site's media set.

  python apps/web/scripts/process-media.py <source-dir>

<source-dir> holds photos/<pexels-id>.jpg and video/<pexels-id>.mp4 (see MEDIA.md for the
id -> slot mapping). Needs Pillow, numpy, rembg (cut-outs) and ffmpeg on PATH.
All media is under the Pexels licence (free use, modification allowed, no attribution).
"""
import os, sys, subprocess, colorsys
import numpy as np
from PIL import Image, ImageOps, ImageFilter

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "media")
PH = os.path.join(SRC, "photos")


def p(i):
    return os.path.join(PH, f"{i}.jpg")


def save(img, rel, q=72):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "WEBP", quality=q, method=6)
    print(f"{rel:32s} {img.size[0]}x{img.size[1]}  {os.path.getsize(path) // 1024} KB")


def cover(src, w, h, focus=(0.5, 0.5)):
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    return ImageOps.fit(im, (w, h), Image.LANCZOS, centering=focus)


_session = None


def cutout(img, crop=None):
    """Background removal (rembg isnet), then trim to the subject's bounding box."""
    global _session
    from rembg import remove, new_session
    if _session is None:
        _session = new_session("isnet-general-use")
    if crop:
        W, H = img.size
        img = img.crop((int(crop[0] * W), int(crop[1] * H), int(crop[2] * W), int(crop[3] * H)))
    out = remove(img, session=_session, post_process_mask=True)
    a = np.array(out.split()[-1])
    a[a < 12] = 0
    out.putalpha(Image.fromarray(a))
    bbox = out.getbbox()
    return out.crop(bbox) if bbox else out


def fit_canvas(img, w, h, pad=0.04, anchor="center"):
    """Contain a cut-out inside a transparent w x h canvas."""
    img = img.copy()
    img.thumbnail((int(w * (1 - 2 * pad)), int(h * (1 - 2 * pad))), Image.LANCZOS)
    c = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = (w - img.size[0]) // 2
    y = (h - img.size[1]) // 2 if anchor == "center" else h - img.size[1]
    c.paste(img, (x, y), img)
    return c


def clean_helmet(img):
    """Removes third-party marks from the helmet cut-out: the maker's red lettering
    on the bumper, the flag sticker and a stray strap spike (coords on 1079x1071)."""
    a = np.array(img).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    reddish = (r - np.maximum(g, b)) > 14
    bumper = np.zeros(r.shape, bool); bumper[280:840, 160:275] = True
    m = reddish & bumper
    m = np.array(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    a[m & bumper, :3] = (230, 227, 222)
    flag = np.zeros(r.shape, bool); flag[565:750, 295:425] = True
    loud = flag & ((reddish) | ((r > 150) & (g > 120) & (b < 120)))
    loud = np.array(Image.fromarray((loud * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    a[loud & flag, :3] = (22, 22, 26)
    a[100:270, 330:440, 3] = 0
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
    return out.filter(ImageFilter.SMOOTH) if False else out


def _grain_inpaint(a, mask, radius=4, seed=18):
    """Inpaints the RGB of `a` (uint8 RGBA array) under `mask`, then re-adds film grain
    measured around the hole so the patch doesn't read as a smooth smear."""
    import cv2
    mask8 = mask.astype(np.uint8) * 255
    rgb = cv2.inpaint(np.ascontiguousarray(a[..., :3]), mask8, radius, cv2.INPAINT_TELEA).astype(np.float32)
    ring = (cv2.dilate(mask8, np.ones((9, 9), np.uint8)) > 0) & ~mask & (a[..., 3] > 200)
    lum = a[..., :3].astype(np.float32).mean(-1)
    hp = lum - cv2.GaussianBlur(lum, (0, 0), 1.6)
    soft = cv2.GaussianBlur(lum, (0, 0), 3)
    edge = np.hypot(cv2.Sobel(soft, cv2.CV_32F, 1, 0), cv2.Sobel(soft, cv2.CV_32F, 0, 1))
    flat = ring & (edge < 40)  # grain only, not the edges of nearby parts
    sigma = float(hp[flat].std()) if flat.any() else 0.0
    noise = np.random.default_rng(seed).normal(0, sigma, mask.shape).astype(np.float32)
    noise = noise - cv2.GaussianBlur(noise, (0, 0), 1.6) * 0.3
    rgb[mask] += noise[mask][:, None]
    out = a.copy()
    out[mask, :3] = np.clip(rgb[mask], 0, 255).astype(np.uint8)
    return out


def clean_footer_player(img):
    """Paints out the helmet maker's marks on the footer cut-out: the light "VICIS"
    lettering on the dark rear bumper and the small square badge on the shell beside
    it (coords on the 1200x1200 footer canvas; the jersey "7" is just a number)."""
    import cv2
    a = np.array(img.convert("RGBA"))
    lum = a[..., :3].astype(np.int16).mean(-1)
    bg = cv2.medianBlur(lum.astype(np.uint8), 15).astype(np.int16)
    yy, xx = np.mgrid[: a.shape[0], : a.shape[1]]
    # Lettering: anything clearly lighter than the dark bumper band around it.
    word = (xx >= 374) & (xx <= 444) & (yy >= 139) & (yy <= 160)
    letters = word & (lum > np.minimum(bg, 70) + 22)
    # Badge: darker strokes on the light shell, left of the strap (strap edge ~x = 466 + .4 (y - 112)).
    badge = (xx >= 448) & (yy >= 128) & (yy <= 161) & (xx <= 463 + 0.4 * (yy - 112))
    strokes = badge & (lum < bg - 18) & (bg > 95)
    m = (letters | strokes).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=2) > 0
    m &= (word | badge) & (a[..., 3] > 0)
    return Image.fromarray(_grain_inpaint(a, m), "RGBA")


def footer_clean():
    """Re-applies clean_footer_player to the published footer-player.webp (no source
    photo needed): python apps/web/scripts/process-media.py - footer_clean"""
    path = os.path.join(OUT, "footer-player.webp")
    save(clean_footer_player(Image.open(path)), "footer-player.webp", 78)


def drop_tee(img):
    """Removes the bright orange kicking tee under the ball and re-trims."""
    arr = np.array(img).astype(np.float32) / 255.0
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    mx, mn = arr[..., :3].max(-1), arr[..., :3].min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    orange = (r > 0.7) & (g > 0.25) & (g < 0.75) & (b < 0.35) & (sat > 0.55)
    rows = np.where(orange.any(1))[0]
    out = np.array(img)
    if rows.size:
        cut = int(np.percentile(rows, 15))
        out[cut:, :, 3] = 0
    out[orange, 3] = 0
    im = Image.fromarray(out, "RGBA")
    return im.crop(im.getbbox())


def recolor(img, hue_shift=0.0, sat=1.0, val=1.0, gold=False):
    """Hue-rotate the coloured parts of a cut-out (greys stay grey), or gild it."""
    arr = np.array(img).astype(np.float32) / 255.0
    rgb, a = arr[..., :3], arr[..., 3:]
    mx, mn = rgb.max(-1), rgb.min(-1)
    v = mx
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6.0
    if gold:
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        lum = np.clip((lum - 0.15) / 0.8, 0, 1) ** 0.85
        gold_lo, gold_hi = np.array([0.36, 0.22, 0.05]), np.array([1.0, 0.86, 0.45])
        out = gold_lo + (gold_hi - gold_lo) * lum[..., None]
        out += np.clip(lum - 0.85, 0, 1)[..., None] * 1.2
        return Image.fromarray((np.clip(np.concatenate([out, a], -1), 0, 1) * 255).astype(np.uint8), "RGBA")
    h = (h + hue_shift) % 1.0
    s = np.clip(s * sat, 0, 1)
    v = np.clip(v * val, 0, 1)
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    P, Q, T = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    choices = [(v, T, P), (Q, v, P), (P, v, T), (P, Q, v), (T, P, v), (v, P, Q)]
    out = np.zeros_like(rgb)
    for k, (cr, cg, cb) in enumerate(choices):
        m = i == k
        out[..., 0][m], out[..., 1][m], out[..., 2][m] = cr[m], cg[m], cb[m]
    return Image.fromarray((np.clip(np.concatenate([out, a], -1), 0, 1) * 255).astype(np.uint8), "RGBA")


def photos():
    save(cover(p(16545258), 938, 1386, (0.55, 0.45)), "career.webp", 70)
    records = [274577, 39619539, 1476171, 16545262, 263731, 13141525, 159549, 264305,
               13141532, 16545275, 35911832, 159662, 13883304, 13141521, 1349531, 32057260]
    for n, i in enumerate(records, 1):
        save(cover(p(i), 608, 810), f"records/r{n:02d}.webp", 64)
    reels = [31853532, 34722017, 13141528, 32116679, 31853539, 37234656, 10799811, 13141533, 26707860]
    for n, i in enumerate(reels, 1):
        save(cover(p(i), 438, 856), f"reels/reel-{n:02d}.webp", 62)
    # Field: dark the sky/stands down so the purple headline reads, keep the turf + yard line.
    field = cover(p(36573287), 1440, 1078, (0.5, 0.95))
    arr = np.array(field).astype(np.float32)
    ramp = np.linspace(0.35, 1.0, arr.shape[0])[:, None, None]
    save(Image.fromarray(np.clip(arr * ramp * 0.82, 0, 255).astype(np.uint8)), "influence-field.webp", 62)


def cutouts():
    save(fit_canvas(cutout(Image.open(p(159515)).convert("RGB")), 660, 900, 0.01), "influence-player.webp", 78)
    # Player sits in the left half: the footer slides the cut-out right by up to 45% of its width.
    fp = cutout(Image.open(p(39170961)).convert("RGB"), crop=(0.18, 0.12, 0.82, 1.0))
    fp.thumbnail((640, 1200), Image.LANCZOS)
    canvas = Image.new("RGBA", (1200, 1200), (0, 0, 0, 0))
    canvas.paste(fp, (230, 1200 - fp.size[1]), fp)
    save(clean_footer_player(canvas), "footer-player.webp", 78)
    ball = cutout(Image.open(p(26707860)).convert("RGB"), crop=(0.05, 0.25, 0.95, 0.72))
    save(fit_canvas(drop_tee(ball), 600, 377, 0.02), "football.webp", 80)
    save(clean_helmet(fit_canvas(cutout(Image.open(p(13141533)).convert("RGB"), crop=(0.25, 0.25, 1.0, 0.8)), 1079, 1071, 0.03)), "gloves.webp", 78)

    # Bases without prominent third-party marks; colourways are hue rotations of them.
    bases = [32573999, 32574015, 32574010]
    cut = [fit_canvas(cutout(Image.open(p(i)).convert("RGB")), 528, 472, 0.03) for i in bases]
    variants = [
        cut[0],                                   # red / black
        recolor(cut[1], 0.36, 1.15),              # mint -> violet
        cut[2],                                   # turquoise soles
        recolor(cut[0], 0.62, 1.0),               # red -> royal blue
        cut[1],                                   # mint
        recolor(cut[2], 0.28, 1.1),               # turquoise -> purple
        recolor(cut[0], 0.12, 1.1),               # red -> amber
        recolor(cut[1], 0.52, 1.2),               # mint -> magenta
        recolor(cut[2], -0.12, 0.9),              # turquoise -> lime
        recolor(cut[0], 0.45, 0.9),               # red -> teal
    ]
    for n, v in enumerate(variants, 1):
        save(v, f"cleats/c{n:02d}.webp", 80)
    save(recolor(cut[1], gold=True), "cleats/cleat-gold.webp", 82)


# Grade: the source is backlit and washes out under the CRT brightening; pull it
# toward the reference's darker, punchier look.
GRADE = "eq=brightness=-0.09:contrast=1.22:saturation=1.25:gamma=0.82"


def video():
    src = os.path.join(SRC, "video", "5423490.mp4")
    out = os.path.join(OUT, "hero.mp4")
    common = ["-an", "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "slow", "-profile:v", "high"]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf", f"scale=1280:-2,fps=25,{GRADE}", "-crf", "27", *common, out], check=True)
    out_p = os.path.join(OUT, "hero-phone.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf", f"crop=ih*9/16:ih:(iw-ih*9/16)*0.55:0,scale=540:960,fps=25,{GRADE}", "-crf", "28", *common, out_p], check=True)
    for f in (out, out_p):
        print(os.path.basename(f), os.path.getsize(f) // 1024, "KB")
    # posters: first frame, so the swap from image to video is seamless
    tmp = os.path.join(SRC, "frame.png")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf", GRADE, "-vframes", "1", tmp], check=True)
    fr = Image.open(tmp).convert("RGB")
    save(ImageOps.fit(fr, (1600, 900), Image.LANCZOS), "hero-poster.webp", 60)
    save(ImageOps.fit(fr, (780, 1386), Image.LANCZOS, centering=(0.55, 0.5)), "hero-poster-phone.webp", 60)


if __name__ == "__main__":
    which = sys.argv[2:] or ["photos", "video", "cutouts"]
    for step in which:
        globals()[step]()
