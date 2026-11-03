#!/usr/bin/env python3
"""Photograph device.exe's render as it opens, for the still that stands in
behind its canvas while the shaders compile (assets/img/device-poster.webp).
Taken at the window's own size and at the render's pixel ratio, 1.5, its
labels, readings and timeline hidden, as they are drawn over it live. Run it
with the site served, after the scene changes:

  bundle exec jekyll serve
  uv run --with playwright --with pillow python3 _tools/poster.py
"""
import io
import os
import tempfile

from PIL import Image
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "img", "device-poster.webp")
OVER = ".trn-tags, .trn-crumbs, .trn-hud, .trn-hint, .trn-time { opacity: 0 !important; }"

# a fresh profile, so that no saved session reopens or resizes a window
with sync_playwright() as p, tempfile.TemporaryDirectory() as profile:
    ctx = p.chromium.launch_persistent_context(profile, channel="chrome", headless=False,
                                               viewport={"width": 1600, "height": 1000}, device_scale_factor=1.5)
    page = ctx.new_page()
    page.goto("http://localhost:4000/d/device")
    page.wait_for_function("getComputedStyle(document.querySelector('.trn-gl')).visibility === 'visible'")
    # the camera settled and the light eased
    page.wait_for_timeout(3000)
    page.add_style_tag(content=OVER)
    shot = page.locator(".trn-gl").screenshot()
    ctx.close()

Image.open(io.BytesIO(shot)).save(OUT, "WEBP", quality=80, method=6)
print(OUT, os.path.getsize(OUT), "bytes")
