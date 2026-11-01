#!/usr/bin/env python3
"""Bake an artistically cleaned texture atlas from the user's original GLB.

No geometry/UV modification, no runtime detail textures, no extra shader
sampling. The source is a photogrammetric atlas with noisy vegetation/roads.
This paintover softens capture noise, restores coherent warm tropical colors,
and bakes high-frequency fine soil/grass strokes into ONE albedo JPEG.

Painted texels stay exactly on the existing UV islands. The source GLB is
never modified; only the derived Web GLB receives this authored diffuse atlas.
"""
from __future__ import annotations

import hashlib
import random
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps

TARGET_SIZE = 4096


def _lut(points):
    """Linear palette-curve utility for Pillow's per-channel image.point."""
    output = []
    for x in range(256):
        y = points[0][1]
        for (a, y0), (b, y1) in zip(points, points[1:]):
            if a <= x <= b:
                y = y0 + (y1 - y0) * (x - a) / max(1, b-a)
                break
            if x > points[-1][0]:
                y = points[-1][1]
        output.append(max(0, min(255, round(y))))
    return output


def _micro_pattern(seed: int, w: int, h: int, grassy: bool) -> Image.Image:
    """Seamless pixel-scale paint grain, not a repeated large tile."""
    rng = random.Random(seed)
    luminance = Image.frombytes("L", (w, h), rng.randbytes(w*h))
    # Fine grain is downweighted after art-direction color smoothing.
    luminance = luminance.filter(ImageFilter.GaussianBlur(0.38))
    # neutral modulation from 89%-100% to avoid introducing new biome colors
    tonal = luminance.point(_lut([(0,227),(127,242),(255,255)]))
    rgb = Image.merge("RGB", (tonal,tonal,tonal))
    # Tiny grass blades / dry-earth streaks, baked once into the atlas.
    # More saturated color is already in the underlying original atlas.
    draw = ImageDraw.Draw(rgb)
    count = (w*h)//350 if grassy else (w*h)//520
    shades = [(220,226,212),(231,236,225),(244,247,239),(255,255,249)] if grassy else [(225,219,209),(235,231,222),(247,244,235),(253,250,243)]
    for _ in range(count):
        x = rng.randrange(w)
        y = rng.randrange(h)
        if grassy:
            dx,dy = rng.randrange(-2,3), rng.randrange(-4,-1)
        else:
            dx,dy = rng.randrange(0,3), rng.randrange(0,2)
        draw.line((x,y,x+dx,y+dy),fill=rng.choice(shades),width=1)
    return rgb


def bake_painterly_albedo(image: Image.Image, size: int = TARGET_SIZE) -> Image.Image:
    """Conserve macro painted pathways while cleaning photogrammetry aliasing.

    One canonical image in, one crisp baked RGB atlas out. The procedural
    strokes are generated in UV texture space rather than sampled per frame.
    """
    if image.width != size or image.height != size:
        image = image.convert("RGB").resize((size,size),Image.Resampling.LANCZOS)
    else:
        image = image.convert("RGB")

    # Remove JPEG capture mottling and speckle without destroying paths.
    # Moderate smoothing is followed by baked fine texel-scale brush details.
    smoothed = image.filter(ImageFilter.GaussianBlur(1.65))
    painted = Image.blend(image,smoothed,0.63)
    painted = Image.blend(painted,ImageOps.posterize(painted,7),0.15)
    painted = ImageEnhance.Color(painted).enhance(1.065)
    painted = ImageEnhance.Contrast(painted).enhance(1.035)

    # Color-based semantic masks work WITH the original photogrammetry UV
    # islands; no blind recolor of buildings, coastline, dirt paths or river.
    hue,sat,val = painted.convert("HSV").split()
    green = hue.point(_lut([(0,0),(34,0),(48,180),(64,255),(103,255),(115,0),(255,0)]))
    vegetation = ImageChops.multiply(green,sat.point(_lut([(0,0),(35,0),(72,180),(115,255),(255,255)])))
    vegetation = vegetation.filter(ImageFilter.GaussianBlur(1.1))
    blue = hue.point(_lut([(0,0),(116,0),(130,240),(178,240),(190,0),(255,0)]))
    blue = ImageChops.multiply(blue,sat.point(_lut([(0,0),(45,0),(70,200),(100,255),(255,255)])))
    # Exclude blue water/brightly colored village materials from earth grain.
    earthy = ImageChops.invert(ImageChops.lighter(vegetation,blue))
    earthy = ImageChops.multiply(earthy,val.point(_lut([(0,0),(30,0),(75,200),(120,255),(255,255)])))

    # Texture paint: tiny marks are multiplied over the original diffuse atlas
    # with small opacities. They cannot wash out major authored color regions.
    earth_mod = ImageChops.multiply(painted,_micro_pattern(41009,size,size,False))
    earth_alpha = earthy.point(_lut([(0,0),(255,69)]))
    painted = Image.composite(earth_mod,painted,earth_alpha)
    grass_mod = ImageChops.multiply(painted,_micro_pattern(12023,size,size,True))
    grass_alpha = vegetation.point(_lut([(0,0),(255,102)]))
    painted = Image.composite(grass_mod,painted,grass_alpha)

    # Very gentle crispness restored at actual 4K after paintover.
    painted = painted.filter(ImageFilter.UnsharpMask(radius=0.60,percent=45,threshold=4))
    assert painted.mode == "RGB" and painted.size == (size,size)
    print("RETEXTURE_BAKED_PASS: painterly UV atlas 4096px, single albedo, no runtime detail textures")
    print("RETEXTURE_ALBEDO_SAMPLE_SHA256:",hashlib.sha256(painted.resize((128,128)).tobytes()).hexdigest())
    return painted
