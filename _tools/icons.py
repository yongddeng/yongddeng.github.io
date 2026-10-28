#!/usr/bin/env python3
"""Draw the programs' icons (assets/img), as Windows 98 sized its own: 16 for
lists and the tree, 48 for Large Icons (shown at 24). The 16s are pixel
drawings; the 48s are the same pictures drawn finer. PNG by hand, since there
is no PIL here.

Usage:
  python3 _tools/icons.py              # writes the four PNGs
  python3 _tools/icons.py --x8 <dir>   # and copies eight times over, to look at
"""
import math
import os
import struct
import sys
import zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "img")
PAL = {
    ".": None, "k": (0, 0, 0), "w": (255, 255, 255), "g": (192, 192, 192), "d": (128, 128, 128),
    "n": (0, 0, 128), "r": (176, 0, 0), "t": (0, 128, 128), "T": (0, 74, 74), "l": (223, 223, 223),
}


def png(path, grid):
    h, w = len(grid), len(grid[0])
    raw = b""
    for row in grid:
        raw += b"\x00" + b"".join(bytes(PAL[c] + (255,)) if PAL[c] else b"\x00\x00\x00\x00" for c in row)
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(data)


def canvas(n):
    return [["."] * n for _ in range(n)]


def rect(g, x, y, w, h, c):
    for j in range(y, y + h):
        for i in range(x, x + w):
            g[j][i] = c


def box(g, x0, y0, x1, y1, fill="w", shadow=False):
    # a black outline around a fill, and Windows 98's grey shadow under the right and bottom edges
    rect(g, x0, y0, x1 - x0 + 1, y1 - y0 + 1, "k")
    rect(g, x0 + 1, y0 + 1, x1 - x0 - 1, y1 - y0 - 1, fill)
    if shadow:
        rect(g, x1 + 1, y0 + 1, 1, y1 - y0 + 1, "d")
        rect(g, x0 + 1, y1 + 1, x1 - x0 + 1, 1, "d")


# ---- quincunx: pegs in a triangle, a ball on its way down, the bins below ----
def quincunx16():
    g = canvas(16)
    box(g, 1, 0, 14, 15)
    for x, y in [(7, 3), (5, 5), (9, 5), (3, 7), (7, 7), (11, 7)]:
        rect(g, x, y, 2, 1, "n")
    rect(g, 9, 9, 1, 1, "r")
    for x, y, h in [(3, 14, 1), (5, 12, 3), (7, 11, 4), (9, 12, 3), (11, 14, 1)]:
        rect(g, x, y, 2, h, "t")
    return g


def quincunx48():
    g = canvas(48)
    box(g, 4, 1, 42, 45, shadow=True)
    rect(g, 5, 2, 37, 2, "l")
    # five rows of pegs, 6 apart, the last row over the bins' walls
    for r in range(5):
        for k in range(r + 1):
            x = round(23 + (k - r / 2) * 6)
            rect(g, x, 7 + 5 * r, 2, 2, "n")
    # the ball, between rows 2 and 3, right of centre
    rect(g, 26, 19, 3, 3, "r")
    # six bins of Bin(5, 1/2), 1 : 5 : 10 : 10 : 5 : 1, their walls under the last row's pegs
    for k, h in enumerate([2, 7, 14, 14, 7, 2]):
        x = 6 + 6 * k
        rect(g, x, 44 - h, 5, h, "t")
        rect(g, x + 4, 44 - h, 1, h, "T")
    for k in range(1, 6):
        rect(g, 5 + 6 * k, 36, 1, 8, "g")
    return g


# ---- lil: a walk between its two envelopes, about the axis ----
def lil16():
    g = canvas(16)
    box(g, 0, 1, 15, 13)
    rect(g, 1, 7, 14, 1, "g")
    red = [(1, 6), (2, 5), (3, 5), (4, 4), (5, 4), (6, 4), (7, 3), (8, 3), (9, 3), (10, 3), (11, 3), (12, 2), (13, 2), (14, 2)]
    for x, y in red:
        g[y][x] = "r"
        g[14 - y][x] = "r"
    walk = [(1, 7), (2, 6), (3, 7), (3, 8), (4, 9), (5, 8), (5, 7), (6, 8), (7, 9), (7, 10), (8, 9), (8, 8), (9, 7), (10, 6), (10, 5),
            (11, 6), (12, 5), (12, 4), (13, 5), (14, 4), (14, 3)]
    for x, y in walk:
        g[y][x] = "n"
    return g


def lil48():
    g = canvas(48)
    box(g, 1, 5, 45, 42, shadow=True)
    axis = 24
    rect(g, 2, axis, 43, 1, "g")
    # the envelope widens as √t does, from 3 pixels off the axis to 16
    env = {x: round(3 + 13 * math.sqrt((x - 2) / 42)) for x in range(2, 45)}
    # the walk as a share of the envelope: up to touch it, down near the far side, up to touch it again,
    # with a pixel of jitter so it reads as steps
    shape = lambda x: 0.98 * math.sin((x - 2) / 42 * 2.6 * math.pi) * (0.55 + 0.45 * (x - 2) / 42)
    jitter = [0, 1, 0, -1, 1, 0, 0, -1, 1, 1, 0, -1, 0, 1, -1, 0, 1, 0, 0, -1, 1, 0, -1, 0, 1, 1, -1, 0, 0, 1, -1, 1, 0, 0, -1, 1, 0, 1, 0, -1, 0, 1, 0]
    prev = None
    for x in range(2, 45):
        g[axis - env[x]][x] = "r"
        g[axis + env[x]][x] = "r"
        y = axis - max(-env[x] + 1, min(env[x] - 1, round(shape(x) * env[x]) + jitter[x - 2]))
        lo, hi = (y, y) if prev is None else (min(prev, y), max(prev, y))
        for j in range(lo, hi + 1):
            g[j][x] = "n"
        prev = y
    return g


def main():
    x8 = sys.argv[2] if sys.argv[1:2] == ["--x8"] else None
    for name, grid in [("quincunx-16", quincunx16()), ("quincunx-48", quincunx48()), ("lil-16", lil16()), ("lil-48", lil48())]:
        png(os.path.join(OUT, name + ".png"), grid)
        if x8:
            png(os.path.join(x8, name + "-x8.png"), [[c for c in row for _ in range(8)] for row in grid for _ in range(8)])
        print(name)


if __name__ == "__main__":
    main()
