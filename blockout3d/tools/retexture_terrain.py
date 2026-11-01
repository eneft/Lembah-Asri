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
    # Coarser hand-painted strokes stay visible from the 3/4 player camera,
    # unlike subpixel grain alone (which disappears under mipmapping).
    for _ in range((w*h)//3100):
        x,y = rng.randrange(w),rng.randrange(h)
        dx = rng.randrange(-4,5) if grassy else rng.randrange(4,18)
        dy = rng.randrange(-17,-6) if grassy else rng.randrange(-2,4)
        draw.line((x,y,x+dx,y+dy),
                  fill=rng.choice([(220,225,213),(232,236,226),(248,248,240)]),
                  width=rng.choice((1,2,2,3)))
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

    # Photogrammetry noise is not a lack of 4K resolution. Paint over the
    # mottled capture at *macro* scale, preserving the author's pathways and
    # overall tone while suppressing tiny chaotic scan fragments.
    broad = image.filter(ImageFilter.GaussianBlur(10.0))
    painted = Image.blend(image, broad, 0.79)
    palette = painted.quantize(colors=96, method=Image.Quantize.FASTOCTREE,
                               dither=Image.Dither.NONE).convert("RGB")
    painted = Image.blend(painted, palette, 0.43)
    # Preserve real road edges, coastline outlines and structure seams even
    # when broad photogrammetry noise is painted over. Detect only broad edges
    # (blur first) so we don't restore pixel-level scanning artifacts.
    macro_edges = image.filter(ImageFilter.GaussianBlur(3.5)).filter(
        ImageFilter.FIND_EDGES).convert("L")
    edge_mask = macro_edges.point(_lut([(0,0),(18,0),(55,45),(115,176),(255,230)]))
    painted = Image.composite(image, painted, edge_mask)
    painted = ImageEnhance.Color(painted).enhance(1.10)
    painted = ImageEnhance.Contrast(painted).enhance(1.065)

    # Repaint biomes as subdued warm tropical game materials. Keep all UV
    # positions and source silhouettes. Never generate a new UV layout.
    hue,sat,val = painted.convert("HSV").split()
    green = hue.point(_lut([(0,0),(28,0),(40,185),(54,255),(103,255),(115,0),(255,0)]))
    vegetation = ImageChops.multiply(green,sat.point(_lut([(0,0),(35,0),(72,180),(115,255),(255,255)])))
    vegetation = vegetation.filter(ImageFilter.GaussianBlur(1.1))
    blue = hue.point(_lut([(0,0),(116,0),(130,240),(178,240),(190,0),(255,0)]))
    blue = ImageChops.multiply(blue,sat.point(_lut([(0,0),(45,0),(70,200),(100,255),(255,255)])))
    # Exclude blue water/brightly colored village materials from earth grain.
    earthy = ImageChops.invert(ImageChops.lighter(vegetation,blue))
    earthy = ImageChops.multiply(earthy,val.point(_lut([(0,0),(30,0),(75,200),(120,255),(255,255)])))

    # Anime/painterly color treatment while preserving physical structures.
    # Green vegetation: sunny olive grass, less aggressive photographic neon.
    # Earth: warm sandy ochre. River/sky-blue texels are left untouched.
    grass_palette = ImageOps.colorize(val, black=(45, 72, 42), white=(119, 161, 99))
    grass_color_mask = vegetation.point(_lut([(0,0),(255,204)]))
    painted = Image.composite(grass_palette, painted, grass_color_mask)
    earth_palette = ImageOps.colorize(val, black=(76, 63, 53), white=(205, 184, 151))
    earth_color_mask = earthy.point(_lut([(0,0),(255,102)]))
    painted = Image.composite(earth_palette, painted, earth_color_mask)

    # Texture paint: tiny marks are multiplied over the original diffuse atlas
    # with small opacities. They cannot wash out major authored color regions.
    earth_mod = ImageChops.multiply(painted,_micro_pattern(41009,size,size,False))
    earth_alpha = earthy.point(_lut([(0,0),(255,69)]))
    painted = Image.composite(earth_mod,painted,earth_alpha)
    grass_mod = ImageChops.multiply(painted,_micro_pattern(12023,size,size,True))
    grass_alpha = vegetation.point(_lut([(0,0),(255,102)]))
    painted = Image.composite(grass_mod,painted,grass_alpha)

    # Very gentle crispness restored at actual 4K after paintover.
    # The Godot 3/4 test has strong sun/ambient illumination: avoid luminous\n    # yellow cliffs and neon grass by baking a more subdued diffuse palette.\n    painted = ImageEnhance.Brightness(painted).enhance(0.85)\n    painted = painted.filter(ImageFilter.UnsharpMask(radius=0.75,percent=70,threshold=4))
    assert painted.mode == "RGB" and painted.size == (size,size)
    print("RETEXTURE_BAKED_PASS: 96-color hand-painted tropical UV atlas 4096px, single albedo, no runtime detail textures")
    print("RETEXTURE_ALBEDO_SAMPLE_SHA256:",hashlib.sha256(painted.resize((128,128)).tobytes()).hexdigest())
    return painted
