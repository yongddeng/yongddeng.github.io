#!/usr/bin/env python3
"""Measure rendered line counts of post paragraphs.

Usage:
  python3 _tools/measure.py <post.md>              # paragraphs over the ceiling
  python3 _tools/measure.py <post.md> --all        # every prose paragraph
  python3 _tools/measure.py <post.md> <pattern>    # paragraphs containing pattern
"""
import re
import sys

CHARS_PER_LINE = 131
CEILING = 5.12


def rendered_length(p: str) -> int:
    s = re.sub(r"<!--.*?-->", "", p, flags=re.S)
    s = re.sub(r"\$[^$]+\$", "X", s)
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
    s = s.replace("_", "").replace("*", "")
    return len(re.sub(r"\s+", " ", s).strip())


def paragraphs(path: str):
    text = open(path).read()
    text = re.sub(r"{% comment %}.*?{% endcomment %}", "", text, flags=re.S)
    for p in text.split("\n\n"):
        p = p.strip()
        # drop leading full-line comments (e.g. "<!-- P1: ... -->" markers)
        while p.startswith("<!--") and "-->\n" in p:
            p = p.split("-->\n", 1)[1].lstrip()
        if not p or p.startswith(("- <", "#", ">", "---", "<p", "<!--", "{%", "!")):
            continue
        if rendered_length(p) < 200:
            continue
        yield p


def main():
    path = sys.argv[1]
    arg = sys.argv[2] if len(sys.argv) > 2 else None
    for p in paragraphs(path):
        lines = rendered_length(p) / CHARS_PER_LINE
        if arg == "--all" or (arg and arg in p) or (not arg and lines > CEILING):
            print(f"[{lines:.2f}] {p[:90]}")


if __name__ == "__main__":
    main()
