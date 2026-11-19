"""Outlined name wordmarks (SVG) for the Home hero.

  python apps/web/scripts/gen-wordmarks.py

The hero background scrolls the athlete's names as giant soft-light masks, and the
top of the hero carries a small wordmark. Both are drawn from Audiowide (OFL, our
hero face) so they work as CSS mask-image without loading a font inside the SVG.
Needs fontTools + brotli.
"""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.join(os.path.dirname(__file__), "..")
FONT = os.path.join(ROOT, "..", "..", "node_modules", "@fontsource", "audiowide", "files", "audiowide-latin-400-normal.woff2")
OUT = os.path.join(ROOT, "public", "svg")


DISPLAY = os.path.join(ROOT, "..", "..", "packages", "ds", "src", "assets", "fonts", "display.woff2")


def instance(path, **axes):
    f = TTFont(path)
    if "fvar" in f:
        from fontTools.varLib import instancer
        have = {a.axisTag for a in f["fvar"].axes}
        f = instancer.instantiateVariableFont(f, {k: v for k, v in axes.items() if k in have})
    return f


def wordmark(text, name, tracking=0.04, fill="#292929", font=None):
    f = font or TTFont(FONT)
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    upm = f["head"].unitsPerEm
    x = 0
    paths = []
    xmin, ymin, xmax, ymax = 1e9, 1e9, -1e9, -1e9
    for ch in text:
        g = cmap.get(ord(ch))
        if g is None:
            continue
        glyph = gs[g]
        if ch != " ":
            bp = BoundsPen(gs)
            glyph.draw(bp)
            if bp.bounds:
                b = bp.bounds
                xmin, ymin = min(xmin, x + b[0]), min(ymin, b[1])
                xmax, ymax = max(xmax, x + b[2]), max(ymax, b[3])
            pen = SVGPathPen(gs)
            glyph.draw(pen)
            paths.append((x, pen.getCommands()))
        x += glyph.width + tracking * upm
    w, h = xmax - xmin, ymax - ymin
    body = "".join(
        f'<path transform="translate({px - xmin:.1f} {ymax:.1f}) scale(1 -1)" d="{d}" fill="{fill}"/>' for px, d in paths
    )
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}">{body}</svg>'
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"{name}.svg")
    with open(p, "w", encoding="utf8") as fh:
        fh.write(svg)
    print(name, f"{w:.0f}x{h:.0f}", f"aspect {w / h:.3f}", os.path.getsize(p) // 1024, "KB")


if __name__ == "__main__":
    wordmark("NICO", "word-nico", tracking=0.06)
    wordmark("VALTIER", "word-valtier", tracking=0.06)
    # Top-of-hero wordmark: condensed display face, heavy (like a jersey nameplate).
    wordmark("NICO VALTIER", "wordmark", tracking=0.075, fill="currentColor", font=instance(DISPLAY, wght=800, wdth=50))
