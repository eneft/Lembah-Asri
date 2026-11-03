#!/usr/bin/env python3
"""Classify the screenshot of the actual WebGL canvas, not the colored HUD."""
from PIL import Image
from statistics import pstdev
from pathlib import Path
p=Path("/tmp/lembah-terrain-chromium/canvas.png")
if not p.is_file():
    raise SystemExit("V7.8 CHROMIUM FAIL: canvas screenshot unavailable")
im=Image.open(p).convert("RGB").resize((96,54))
pixels=list(im.getdata())
lum=[sum(rgb)/3 for rgb in pixels]
std=pstdev(lum)
unique=len(set(pixels))
lmin,lmax=min(lum),max(lum)
print(f"V7.8 CHROMIUM CANVAS: color_count={unique}, luma_std={std:.2f}, min={lmin:.1f}, max={lmax:.1f}")
# A static Godot clear-color frame has virtually no color variance;
# the island, avatar and roofs must vary the image substantially.
if unique<90 or std<7 or lmax-lmin<24:
    raise SystemExit("V7.8 CHROMIUM FAIL: blank or uniform-color rendered canvas")
print("V7.8 CHROMIUM VISUAL PASS: actual game canvas contains distinct 3D pixels")
