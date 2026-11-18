"""Builds the design-system webfonts from Fontsource OFL sources.

  python -I packages/ds/scripts-build-fonts.py <source-dir>

Saira is instanced to wdth=50 (the only width the system uses) with wght 400-800,
Hanken Grotesk to wght 400-800; everything is subset to Latin + Polish.
"""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "src", "assets", "fonts")
BASIC = "0020-007E,00A0-00FF,0152-0153,2013-2014,2018-201E,2022,2026,20AC,2122,2190-2193,2212,00D7"
EXT = "0104-0107,0118-0119,0141-0144,015A-015B,0179-017C"


def unis(spec):
    out = []
    for part in spec.split(","):
        a = part.split("-")
        out += range(int(a[0], 16), int(a[-1], 16) + 1)
    return out


def build(src, dst, ranges, limits=None):
    f = TTFont(os.path.join(SRC, src), lazy=False)
    if limits:
        f = instancer.instantiateVariableFont(f, limits)
        f = TTFont(_roundtrip(f), lazy=False)
    o = subset.Options()
    o.flavor = "woff2"
    o.layout_features = ["kern", "liga", "calt", "tnum", "lnum", "case"]
    o.name_IDs = ["*"]
    s = subset.Subsetter(o)
    s.populate(unicodes=unis(ranges))
    s.subset(f)
    f.flavor = "woff2"
    p = os.path.join(OUT, dst)
    f.save(p)
    print(dst, round(os.path.getsize(p) / 1024, 1), "KB")


def _roundtrip(f):
    import io
    b = io.BytesIO()
    f.flavor = None
    f.save(b)
    b.seek(0)
    return b


build("saira-latin-wdth-normal.woff2", "display.woff2", BASIC, {"wdth": 50, "wght": (400, 800)})
build("saira-latin-ext-wdth-normal.woff2", "display-ext.woff2", EXT, {"wdth": 50, "wght": (400, 800)})
build("hanken-grotesk-latin-wght-normal.woff2", "body.woff2", BASIC, {"wght": (400, 800)})
build("hanken-grotesk-latin-ext-wght-normal.woff2", "body-ext.woff2", EXT, {"wght": (400, 800)})
build("ibm-plex-mono-latin-500-normal.woff2", "mono.woff2", BASIC)
build("ibm-plex-mono-latin-ext-500-normal.woff2", "mono-ext.woff2", EXT)
build("audiowide-latin-400-normal.woff2", "hero.woff2", BASIC)
