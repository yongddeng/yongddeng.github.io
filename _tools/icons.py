#!/usr/bin/env python3
"""Draw the programs' icons (assets/img), as Windows 98 sized its own: 16 for
lists and the tree, 48 for Large Icons (shown at 24). The 16s are pixel
drawings; the 48s are the same pictures drawn finer. PNG by hand, since there
is no PIL here.

Usage:
  python3 _tools/icons.py              # writes the ten PNGs
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
    "n": (0, 0, 128), "r": (176, 0, 0), "t": (0, 128, 128), "v": (176, 166, 204),
    "y": (184, 134, 11), "p": (128, 0, 128), "e": (30, 30, 30), "b": (24, 64, 45), "a": (27, 175, 122),
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


# ---- optimiser: a zig-zag down a ravine's contours to the ball at its bottom ----
def ellipse(g, cx, cy, rx, ry, c):
    for k in range(360):
        a = math.radians(k)
        g[round(cy + ry * math.sin(a))][round(cx + rx * math.cos(a))] = c


def line(g, x0, y0, x1, y1, c):
    n = max(abs(x1 - x0), abs(y1 - y0))
    for k in range(n + 1):
        g[round(y0 + (y1 - y0) * k / n)][round(x0 + (x1 - x0) * k / n)] = c


def optimiser16():
    g = canvas(16)
    box(g, 0, 1, 15, 14)
    ellipse(g, 9, 8, 5, 3, "v")
    ellipse(g, 9, 8, 2, 1, "v")
    path = [(1, 4), (4, 11), (6, 6), (8, 9), (9, 8)]
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        line(g, x0, y0, x1, y1, "n")
    rect(g, 9, 7, 2, 2, "r")
    return g


def optimiser48():
    g = canvas(48)
    box(g, 1, 4, 45, 43, shadow=True)
    for rx, ry in [(18, 12), (13, 8), (8, 5), (3, 2)]:
        ellipse(g, 27, 24, rx, ry, "v")
    # SGD across the ravine and along it, each swing smaller than the last
    path = [(4, 11), (10, 35), (15, 15), (19, 31), (22, 19), (25, 27), (27, 24)]
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        line(g, x0, y0, x1, y1, "n")
        line(g, x0 + 1, y0, x1 + 1, y1, "n")
    rect(g, 26, 22, 4, 4, "r")
    rect(g, 26, 22, 1, 1, "w")
    return g

# ---- scheduler: a batch, a bar a sequence, the shared system prompt in gold
# at its head, an answer's next token a black tick at its end, one a prompt
# chunk ----
def batch(g, x, rows, height, head, tick):
    for y, length, c in rows:
        rect(g, x, y, head, height, "y")
        rect(g, x + head, y, length, height, c)
        if c != "p":
            rect(g, x + head + length, y, tick, height, "k")


def scheduler16():
    g = canvas(16)
    box(g, 0, 1, 15, 14)
    batch(g, 2, [(3, 5, "n"), (6, 2, "t"), (9, 9, "p"), (12, 4, "n")], 2, 2, 1)
    return g


def scheduler48():
    g = canvas(48)
    box(g, 1, 4, 45, 43, shadow=True)
    batch(g, 4, [(8, 17, "n"), (14, 9, "t"), (20, 28, "p"), (26, 22, "n"), (32, 6, "t"), (38, 13, "n")], 4, 7, 2)
    return g


# ---- device: the editor's dark half, its lines in Dark+'s colours and the
# debugger's arrow at the one in play, beside the board, two GPUs over the
# CPU, a bus lit between ----
def code(g, x, rows, height):
    for y, indent, length, c in rows:
        rect(g, x + indent, y, length, height, c)


def device16():
    g = canvas(16)
    box(g, 0, 1, 15, 14)
    rect(g, 1, 2, 7, 12, "e")
    code(g, 2, [(4, 0, 4, "v"), (6, 1, 3, "t"), (8, 1, 4, "y"), (10, 0, 3, "v"), (12, 1, 4, "t")], 1)
    rect(g, 8, 2, 7, 12, "b")
    rect(g, 9, 3, 2, 3, "g")
    rect(g, 12, 3, 2, 3, "g")
    rect(g, 10, 9, 3, 3, "d")
    line(g, 11, 8, 11, 6, "t")
    return g


def device48():
    g = canvas(48)
    box(g, 1, 4, 45, 43, shadow=True)
    rect(g, 2, 5, 21, 38, "e")
    code(g, 6, [(9, 0, 9, "v"), (13, 3, 12, "t"), (17, 3, 8, "y"), (21, 0, 10, "v"), (25, 3, 12, "w"), (29, 3, 7, "t"), (33, 6, 10, "y"), (37, 3, 9, "v")], 2)
    for i in range(3):
        rect(g, 3 + i, 24 + i, 1, 4 - 2 * i, "y")
    rect(g, 23, 5, 22, 38, "b")
    for x in (26, 35):
        rect(g, x, 9, 7, 10, "g")
        for f in range(x + 1, x + 7, 2):
            rect(g, f, 10, 1, 8, "d")
    rect(g, 30, 29, 8, 8, "w")
    rect(g, 31, 30, 6, 6, "d")
    for y in (27, 38):
        rect(g, 28, y, 12, 1, "k")
    line(g, 34, 28, 29, 19, "t")
    line(g, 35, 28, 30, 19, "t")
    return g


# ---- sampler: a page of text, its lines the answer so far, the last ending
# in the draft's tokens, kept, aqua under them, one refused, red, and the
# caret where the next comes ----
def sampler16():
    g = canvas(16)
    box(g, 0, 1, 15, 14)
    for y, length in ((4, 10), (7, 12)):
        rect(g, 2, y, length, 1, "n")
    rect(g, 2, 10, 3, 1, "n")
    rect(g, 6, 10, 4, 1, "a")
    rect(g, 11, 10, 2, 1, "r")
    rect(g, 2, 12, 1, 2, "k")
    return g


def sampler48():
    g = canvas(48)
    box(g, 1, 4, 45, 43, shadow=True)
    for y, length in ((10, 30), (16, 36), (22, 24), (28, 33)):
        rect(g, 5, y, length, 2, "n")
    rect(g, 5, 34, 8, 2, "n")
    for x, length in ((15, 6), (23, 5)):
        rect(g, x, 34, length, 2, "n")
        rect(g, x, 37, length, 1, "a")
    rect(g, 30, 34, 6, 2, "r")
    rect(g, 39, 32, 1, 7, "k")
    return g


def main():
    x8 = sys.argv[2] if sys.argv[1:2] == ["--x8"] else None
    for name, grid in [("lil-16", lil16()), ("lil-48", lil48()), ("optimiser-16", optimiser16()), ("optimiser-48", optimiser48()),
                       ("scheduler-16", scheduler16()), ("scheduler-48", scheduler48()), ("device-16", device16()), ("device-48", device48()),
                       ("sampler-16", sampler16()), ("sampler-48", sampler48())]:
        png(os.path.join(OUT, name + ".png"), grid)
        if x8:
            png(os.path.join(x8, name + "-x8.png"), [[c for c in row for _ in range(8)] for row in grid for _ in range(8)])
        print(name)


if __name__ == "__main__":
    main()
