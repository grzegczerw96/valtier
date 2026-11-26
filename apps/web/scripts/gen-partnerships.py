"""Partnerships page art: campaign key art and pack shots for the fictional partners.

  python -E apps/web/scripts/gen-partnerships.py [name ...]

No new stock. Every frame is built from media already in public/media (Pexels, see
MEDIA.md) plus the site's own OFL fonts: duotoned campaign posters with the partner's
typographic wordmark, and studio pack shots of existing cut-outs (cleats, frames,
headphones, FORGE boxes, the PIXEL ARENA card) on a lit sweep.
Output: public/media/partners/*.webp
Needs Pillow, numpy, fontTools + brotli (woff2 -> ttf for Pillow).
"""
import math
import os
import random
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
MEDIA = os.path.join(HERE, "..", "public", "media")
OUT = os.path.join(MEDIA, "partners")
NM = os.path.join(HERE, "..", "..", "..", "node_modules")
os.makedirs(OUT, exist_ok=True)

BONE = (244, 239, 230)
INK = (23, 18, 32)
SAND = (211, 200, 186)
GOLD = (212, 162, 74)

_tmp = tempfile.mkdtemp(prefix="vpartners-")


def font_file(rel, **axes):
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
DISPLAY = font_file("@fontsource-variable/saira/files/saira-latin-wdth-normal.woff2", wdth=50, wght=800)
WIDE = font_file("@fontsource-variable/saira/files/saira-latin-wdth-normal.woff2", wdth=100, wght=800)
BODY = font_file("@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2", wght=800)
LIGHT = font_file("@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2", wght=300)
MONO = font_file("@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2")


def F(path, size):
    return ImageFont.truetype(path, max(8, int(size)))


def save(img, name, q=80):
    p = os.path.join(OUT, name)
    img.convert("RGB").save(p, "WEBP", quality=q, method=6)
    print(f"{name:26s} {img.size[0]:5d}x{img.size[1]:<5d} {os.path.getsize(p) // 1024:4d} KB")


def src(path, mode="RGB"):
    return Image.open(os.path.join(MEDIA, path)).convert(mode)


def grain(img, amt=7, seed=18):
    rng = np.random.default_rng(seed)
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    n = rng.normal(0, amt, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(a + n, 0, 255).astype(np.uint8))


def duotone(img, dark, light, mid=None, gamma=1.0):
    g = np.asarray(ImageOps.autocontrast(ImageOps.grayscale(img), cutoff=1)).astype(np.float32) / 255
    g = g ** gamma
    d, l = np.array(dark, np.float32), np.array(light, np.float32)
    if mid is None:
        out = d + (l - d) * g[..., None]
    else:
        m = np.array(mid, np.float32)
        t = g[..., None]
        out = np.where(t < 0.5, d + (m - d) * (t * 2), m + (l - m) * ((t - 0.5) * 2))
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def vignette(img, k=0.55):
    w, h = img.size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    m = 1 - k * np.clip(r - 0.35, 0, 1) ** 1.6
    a = np.asarray(img.convert("RGB")).astype(np.float32) * m[..., None]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def sweep(size, top, bottom, light=(0.5, 0.38), glow=0.35):
    """Studio backdrop: vertical gradient + a soft key light."""
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = (yy / h)[..., None]
    base = np.array(top, np.float32) * (1 - t) + np.array(bottom, np.float32) * t
    lx, ly = light
    r = np.sqrt(((xx / w - lx) / 0.55) ** 2 + ((yy / h - ly) / 0.5) ** 2)
    base *= (1 + glow * np.exp(-r ** 2 * 2.2))[..., None]
    return Image.fromarray(base.clip(0, 255).astype(np.uint8))


def text_w(d, s, f, tracking=0):
    return d.textlength(s, font=f) + tracking * max(0, len(s) - 1)


def draw_text(d, xy, s, f, fill, tracking=0, anchor="ls"):
    x, y = xy
    if not tracking:
        d.text((x, y), s, font=f, fill=fill, anchor=anchor)
        return
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill, anchor=anchor)
        x += d.textlength(ch, font=f) + tracking


def fit_font(path, s, width, start=400, tracking_em=0.0):
    size = start
    probe = ImageDraw.Draw(Image.new("L", (8, 8)))
    while size > 10:
        f = F(path, size)
        if text_w(probe, s, f, tracking_em * size) <= width:
            return f
        size -= 2
    return F(path, 10)


def shadow_under(canvas, obj, xy, strength=0.5, blur=30, dy=24, squash=0.18):
    """Contact shadow: the object's alpha squashed onto the floor below it."""
    a = obj.getchannel("A")
    w, h = obj.size
    flat = a.resize((w, max(2, int(h * squash))))
    sh = Image.new("RGBA", (w + blur * 4, flat.size[1] + blur * 4), (0, 0, 0, 0))
    m = Image.new("L", sh.size, 0)
    m.paste(flat, (blur * 2, blur * 2))
    m = m.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * strength))
    sh.putalpha(m)
    canvas.alpha_composite(sh, (int(xy[0] - blur * 2), int(xy[1] + h - flat.size[1] / 2 - blur * 2 + dy)))


def footer_line(d, w, h, color, f=None, text="NICO VALTIER  ·  18"):
    f = f or F(MONO, h * 0.022)
    draw_text(d, (w * 0.05, h * 0.95), text, f, color, tracking=h * 0.006)


# ---------------------------------------------------------------- posters
def poster(name, photo, size, dark, light, mark, mark_font, *, mid=None, centering=(0.5, 0.4), mark_pos="bottom",
           tag=None, mark_color=None, tracking=0.0, gamma=1.0, upper=True, flip=False):
    w, h = size
    ph = ImageOps.fit(src(photo), size, Image.LANCZOS, centering=centering)
    if flip:
        ph = ImageOps.mirror(ph)
    img = vignette(duotone(ph, dark, light, mid, gamma), 0.45).convert("RGBA")
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = mark.upper() if upper else mark
    f = fit_font(mark_font, s, w * 0.9, int(h * 0.4), tracking)
    mc = mark_color or light
    bb = d.textbbox((0, 0), s, font=f)
    tw = text_w(d, s, f, tracking * f.size)
    x = (w - tw) / 2
    if mark_pos == "bottom":
        y = h * 0.86
    elif mark_pos == "top":
        y = h * 0.08 + (bb[3] - bb[1])
    else:
        y = h * 0.5 + (bb[3] - bb[1]) / 2
    draw_text(d, (x, y), s, f, mc, tracking=tracking * f.size)
    if tag:
        tf = F(MONO, max(14, h * 0.024))
        tt = text_w(d, tag, tf, h * 0.008)
        ty = y + h * 0.05 if mark_pos != "bottom" else y - (bb[3] - bb[1]) - h * 0.035
        draw_text(d, ((w - tt) / 2, ty), tag, tf, mc, tracking=h * 0.008)
    footer_line(d, w, h, (*mc[:3], 170))
    img.alpha_composite(layer)
    save(grain(img), name)


def packshot(name, size, items, top, bottom, mark=None, mark_font=DISPLAY, mark_color=None, tag=None, light=(0.5, 0.38),
             tag_color=None, floor=0.72):
    """items: [(path, height_frac, cx_frac, rotation, floor_frac?)] cut-outs placed on the floor line."""
    w, h = size
    img = sweep(size, top, bottom, light).convert("RGBA")
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if mark:
        f = fit_font(mark_font, mark, w * 0.94, int(h * 0.5))
        bb = d.textbbox((0, 0), mark, font=f)
        tw = d.textlength(mark, font=f)
        d.text(((w - tw) / 2, h * 0.47 + (bb[3] - bb[1]) / 2), mark, font=f, fill=mark_color, anchor="ls")
    img.alpha_composite(layer)
    for it in items:
        path, hf, cx, rot = it[:4]
        fl = it[4] if len(it) > 4 else floor
        obj = src(path, "RGBA")
        bbox = obj.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
        obj = obj.crop(bbox)
        th = int(h * hf)
        obj = obj.resize((max(1, int(obj.width * th / obj.height)), th), Image.LANCZOS)
        if rot:
            obj = obj.rotate(rot, Image.BICUBIC, expand=True)
        x = int(w * cx - obj.width / 2)
        y = int(h * fl - obj.height)
        shadow_under(img, obj, (x, y), 0.55, int(h * 0.02), int(h * 0.012))
        img.alpha_composite(obj, (x, y))
    d = ImageDraw.Draw(img)
    if tag:
        tf = F(MONO, h * 0.024)
        tt = text_w(d, tag, tf, h * 0.008)
        draw_text(d, ((w - tt) / 2, h * 0.9), tag, tf, tag_color or mark_color, tracking=h * 0.008)
    save(grain(img, 5), name)


def flatlay(name, size, items, bg, seed=4, tag=None, tag_color=INK):
    """Top-down table: cut-outs scattered with drop shadows on a paper-ish surface."""
    w, h = size
    rng = np.random.default_rng(seed)
    base = np.array(bg, np.float32)[None, None, :] * (1 + rng.normal(0, 0.018, (h, w, 1)))
    img = vignette(Image.fromarray(base.clip(0, 255).astype(np.uint8)), 0.35).convert("RGBA")
    for path, hf, cx, cy, rot in items:
        obj = src(path, "RGBA")
        obj = obj.crop(obj.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox())
        th = int(h * hf)
        obj = obj.resize((max(1, int(obj.width * th / obj.height)), th), Image.LANCZOS).rotate(rot, Image.BICUBIC, expand=True)
        sh = Image.new("RGBA", obj.size, (0, 0, 0, 0))
        sh.putalpha(obj.getchannel("A").point(lambda v: int(v * 0.42)).filter(ImageFilter.GaussianBlur(h * 0.012)))
        x, y = int(w * cx - obj.width / 2), int(h * cy - obj.height / 2)
        img.alpha_composite(sh, (x + int(h * 0.012), y + int(h * 0.02)))
        img.alpha_composite(obj, (x, y))
    if tag:
        d = ImageDraw.Draw(img)
        draw_text(d, (w * 0.05, h * 0.94), tag, F(MONO, h * 0.022), tag_color, tracking=h * 0.006)
    save(grain(img, 5), name)


# ---------------------------------------------------------------- the partners
def northline():
    packshot("northline-key.webp", (1500, 1000), [("home/partner-cleat.webp", 0.62, 0.5, 0, 0.8)],
             (58, 30, 104), (20, 12, 34), mark="NORTHLINE", mark_color=(255, 255, 255, 34), tag="THE VALTIER 18 SIGNATURE",
             tag_color=(240, 228, 212))
    flatlay("northline-table.webp", (1500, 1000), [
        ("cleats/c03.webp", 0.34, 0.24, 0.3, 14), ("cleats/c07.webp", 0.34, 0.62, 0.26, -9),
        ("cleats/c01.webp", 0.34, 0.4, 0.68, -4), ("cleats/cleat-gold.webp", 0.36, 0.78, 0.64, 11),
    ], (226, 219, 207), tag="NORTHLINE LAB  ·  CONCEPT ROUND 03")
    poster("northline-camp.webp", "records/r10.webp", (800, 1050), (26, 14, 48), (214, 196, 255), "NORTHLINE", DISPLAY,
           mid=(108, 74, 162), centering=(0.5, 0.35), tag="BUILT IN HARBOR CITY")


def kestrel():
    poster("kestrel-key.webp", "records/r06.webp", (800, 1050), (6, 40, 46), (186, 244, 226), "Kestrel", LIGHT,
           mid=(20, 120, 118), centering=(0.5, 0.45), mark_pos="top", tag="HYDRATE LIKE 18", upper=False, tracking=-0.02)
    poster("kestrel-sideline.webp", "records/r15.webp", (800, 1050), (8, 30, 40), (232, 250, 240), "Kestrel", LIGHT,
           mid=(32, 104, 120), centering=(0.5, 0.5), tag="SIDELINE SCIENCE", upper=False, tracking=-0.02)


def fennick():
    poster("fennick-key.webp", "off/appear/a03.webp", (1500, 1000), (40, 6, 14), (255, 214, 196), "FENNICK COLA", DISPLAY,
           mid=(190, 34, 40), centering=(0.5, 0.5), mark_pos="center", tag="RED CARPET, ICE COLD")
    poster("fennick-tailgate.webp", "off/appear/a02.webp", (800, 1050), (30, 8, 18), (255, 230, 214), "FENNICK", DISPLAY,
           mid=(176, 30, 44), centering=(0.5, 0.4), tag="TAILGATE CRASHERS")


def forge():
    packshot("forge-shelf.webp", (1500, 1000), [("home/partner-forge.webp", 0.6, 0.5, 0, 0.82)],
             (240, 228, 212), (196, 182, 164), mark="FORGE", mark_color=(44, 22, 82, 26), tag="THE 18 PACK  ·  SEASON OPENER",
             tag_color=(44, 22, 82))


def volta():
    packshot("volta-frames.webp", (1500, 1000), [
        ("off/pieces/p01.webp", 0.2, 0.28, -4, 0.62), ("off/pieces/p03.webp", 0.2, 0.72, 5, 0.62),
        ("off/pieces/p02.webp", 0.24, 0.5, 0, 0.8)],
        (236, 232, 226), (186, 178, 168), mark="VOLTA", mark_font=HERO, mark_color=(23, 18, 32, 20), tag="VALTIER 18 EDITION",
        tag_color=INK)
    packshot("volta-portrait.webp", (1000, 1250), [("home/partner-volta.webp", 0.9, 0.52, 0, 1.0)],
             (255, 176, 84), (196, 72, 40), mark="VOLTA", mark_font=HERO, mark_color=(255, 255, 255, 60), light=(0.4, 0.3))


def rooster():
    poster("rooster-key.webp", "records/r16.webp", (800, 1050), (46, 14, 6), (255, 222, 150), "ROOSTER ROW", HERO,
           mid=(214, 96, 28), centering=(0.5, 0.35), tag="TENDERS FOR THE CREW")


def halo():
    packshot("halo-studio.webp", (1000, 1250), [("home/partner-halo.webp", 0.56, 0.5, -6, 0.74)],
             (64, 40, 120), (18, 12, 32), mark="HALO", mark_font=MONO, mark_color=(255, 255, 255, 26), tag="HALO STUDIO  ·  18 EDITION",
             tag_color=(226, 214, 255))
    poster("halo-session.webp", "off/appear/v02.webp", (1500, 1000), (14, 10, 28), (230, 220, 255), "HALO AUDIO", MONO,
           mid=(96, 70, 170), centering=(0.5, 0.5), mark_pos="top", tag="PRE-GAME PLAYLIST  ·  LIVE", tracking=0.12)


def atlas():
    poster("atlas-key.webp", "records/r13.webp", (1500, 1000), (24, 30, 22), (246, 226, 178), "atlas & co", BODY,
           mid=(178, 120, 48), centering=(0.5, 0.6), mark_pos="top", tag="THE HOME TEAM", upper=False, tracking=-0.03)


def meridian():
    poster("meridian-field.webp", "influence-field.webp", (1500, 1000), (6, 14, 30), (214, 232, 255), "Meridian Bank", BODY,
           mid=(40, 88, 150), centering=(0.5, 0.7), mark_pos="top", tag="MERIDIAN BANK FIELD  ·  NORTHMARK", upper=False,
           tracking=-0.03)


def arena():
    packshot("arena-card.webp", (1000, 1250), [("journal/arena-99.webp", 0.7, 0.5, -4, 0.84)],
             (30, 18, 60), (8, 6, 16), mark="99", mark_font=HERO, mark_color=(156, 120, 255, 40), tag="PIXEL ARENA  ·  99 CLUB",
             tag_color=(214, 200, 255), light=(0.5, 0.45))


def slice_():
    poster("slice-key.webp", "reels/reel-04.webp", (800, 1050), (40, 10, 4), (255, 236, 196), "CORNER SLICE", DISPLAY,
           mid=(222, 92, 32), centering=(0.5, 0.35), tag="GAME DAY  ·  ONE DAY")


def bravura():
    poster("bravura-key.webp", "off/fashion/f02.webp", (800, 1050), (12, 10, 10), (244, 236, 222), "Bravura", LIGHT,
           mid=(120, 108, 96), centering=(0.5, 0.4), mark_pos="top", tag="FALL 26  ·  THE LEAGUE EDIT", upper=False,
           tracking=-0.04)


def nocturne():
    poster("nocturne-key.webp", "off/appear/v01.webp", (1500, 1000), (6, 8, 22), (190, 206, 255), "NOCTURNE", WIDE,
           mid=(40, 52, 120), centering=(0.5, 0.5), mark_pos="top", tag="RECOVERY STARTS AT NIGHT", tracking=0.2)


def light():
    """Window-light wash for the page (soft-light over sand): two bright panes split by
    a diagonal mullion shadow, heavily blurred, white on transparent."""
    w, h = 1440, 810
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.polygon([(0, 0), (500, 0), (430, 180), (560, 150), (330, 560), (180, 810), (0, 810)], fill=255)
    d.polygon([(860, 0), (1440, 0), (1440, 810), (560, 810), (920, 420), (900, 330)], fill=255)
    d.polygon([(1180, 0), (1440, 0), (1440, 300)], fill=150)
    m = m.filter(ImageFilter.GaussianBlur(46))
    img = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    img.putalpha(m)
    p = os.path.join(HERE, "..", "public", "textures", "light-window.webp")
    img.save(p, "WEBP", quality=70, method=6)
    print("light-window.webp", os.path.getsize(p) // 1024, "KB")


def thumbs():
    """240px-tall strip thumbnails for every still / poster listed in content/partnerships.ts."""
    import re
    ts = open(os.path.join(HERE, "..", "src", "content", "partnerships.ts"), encoding="utf8").read()
    paths = set(re.findall(r"img\('([^']+)'", ts))
    for call in re.findall(r"clip\(([^)]*)\)", ts):
        q = re.findall(r"'([^']+)'", call)
        if not q or not q[0].endswith(".mp4"):
            continue
        poster = next((x for x in q[1:] if x.endswith(".webp")), q[0][:-4] + ".webp")
        paths.add(poster)
    tdir = os.path.join(OUT, "t")
    os.makedirs(tdir, exist_ok=True)
    total = 0
    for p in sorted(paths):
        im = src(p)
        th = 240
        im = im.resize((max(1, round(im.width * th / im.height)), th), Image.LANCZOS)
        name = p.rsplit(".", 1)[0].replace("/", "-") + ".webp"
        im.save(os.path.join(tdir, name), "WEBP", quality=72, method=6)
        total += os.path.getsize(os.path.join(tdir, name))
    print(f"thumbs: {len(paths)} files, {total // 1024} KB")


ALL = {
    "northline": northline, "kestrel": kestrel, "fennick": fennick, "forge": forge, "volta": volta, "rooster": rooster,
    "halo": halo, "atlas": atlas, "meridian": meridian, "arena": arena, "slice": slice_, "bravura": bravura,
    "nocturne": nocturne, "thumbs": thumbs, "light": light,
}

if __name__ == "__main__":
    random.seed(18)
    for k in sys.argv[1:] or ALL:
        ALL[k]()
