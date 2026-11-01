#!/usr/bin/env python3
"""Reproducible, seamless microtextures for the uploaded Lembah Asri terrain.

This is an asset BUILD STEP, not gameplay procedural geometry. It generates
real 512x512 PNG detail albedos (grass / soil) and a normal map using Pillow.
Each texture wraps seamlessly. The source GLB, its 4K baked color and UVs
remain unchanged. CI runs this before Godot import/export.

Run locally: python3 blockout3d/tools/build_terrain_detail.py
"""
from __future__ import annotations

import hashlib
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

SIZE = 512
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "environment" / "terrain_detail"


def seamless_noise(cells: int, seed: int) -> Image.Image:
    """Upsample a 3x3 periodically repeated noise lattice, then take center."""
    rng = random.Random(seed)
    small = Image.new("L", (cells, cells))
    small.putdata([rng.randrange(40, 216) for _ in range(cells * cells)])
    tiled = Image.new("L", (cells * 3, cells * 3))
    for y in range(3):
        for x in range(3):
            tiled.paste(small, (x * cells, y * cells))
    enlarged = tiled.resize((SIZE * 3, SIZE * 3), Image.Resampling.BICUBIC)
    return enlarged.crop((SIZE, SIZE, SIZE * 2, SIZE * 2))


def natural_height(seed: int) -> Image.Image:
    # Four spatial frequencies create fine grass/soil grain, not random TV snow.
    low = seamless_noise(9, seed + 11)
    mid = seamless_noise(35, seed + 23)
    high = seamless_noise(130, seed + 37)
    micro = seamless_noise(350, seed + 53)
    height = Image.blend(low, mid, 0.45)
    height = Image.blend(height, high, 0.38)
    height = Image.blend(height, micro, 0.24)
    height = ImageEnhance.Contrast(height).enhance(1.55)
    return height


def wrap_line(draw: ImageDraw.ImageDraw, x: int, y: int, dx: int, dy: int, color: tuple[int, int, int]) -> None:
    for sx in (-SIZE, 0, SIZE):
        for sy in (-SIZE, 0, SIZE):
            draw.line((x + sx, y + sy, x + dx + sx, y + dy + sy), fill=color, width=1)


def make_grass(height: Image.Image) -> Image.Image:
    # Grass fibers are *microdetail*, not a green replacement for the baked
    # terrain. The shader only uses this where the macro albedo is green.
    image = ImageOps.colorize(height, black=(174, 191, 162), white=(251, 252, 237))
    draw = ImageDraw.Draw(image)
    rng = random.Random(17041)
    blades = ((168, 189, 148), (191, 209, 164), (224, 236, 196), (245, 247, 214))
    for _ in range(4800):
        x = rng.randrange(SIZE)
        y = rng.randrange(SIZE)
        dx = rng.choice((-2, -1, 0, 1, 2))
        dy = rng.randrange(-5, -1)
        wrap_line(draw, x, y, dx, dy, rng.choice(blades))
    return image


def make_soil(height: Image.Image) -> Image.Image:
    # Earth grain, pebbles and short organic marks; no obvious repeating
    # checkerboard or large stylized patches.
    image = ImageOps.colorize(height, black=(180, 171, 157), white=(249, 243, 229))
    draw = ImageDraw.Draw(image)
    rng = random.Random(88219)
    colors = ((185, 172, 151), (196, 185, 164), (222, 211, 191), (244, 234, 213))
    for _ in range(3700):
        x = rng.randrange(SIZE)
        y = rng.randrange(SIZE)
        dx = rng.choice((0, 1, 2))
        dy = rng.choice((0, 1))
        wrap_line(draw, x, y, dx, dy, rng.choice(colors))
    return image


def make_normal(height: Image.Image) -> Image.Image:
    # Periodic central differences guarantee normals tile at UV wrap borders.
    h = height.filter(ImageFilter.GaussianBlur(radius=0.35)).tobytes()
    pixels = bytearray(SIZE * SIZE * 3)
    for y in range(SIZE):
        ym = ((y - 1) % SIZE) * SIZE
        yp = ((y + 1) % SIZE) * SIZE
        row = y * SIZE
        for x in range(SIZE):
            left = h[row + (x - 1) % SIZE]
            right = h[row + (x + 1) % SIZE]
            up = h[ym + x]
            down = h[yp + x]
            nx = -(right - left) / 255.0 * 1.4
            ny = -(down - up) / 255.0 * 1.4
            length = math.sqrt(nx * nx + ny * ny + 1.0)
            pos = (row + x) * 3
            pixels[pos] = int((nx / length * 0.5 + 0.5) * 255.0)
            pixels[pos + 1] = int((ny / length * 0.5 + 0.5) * 255.0)
            pixels[pos + 2] = int((1.0 / length * 0.5 + 0.5) * 255.0)
    return Image.frombytes("RGB", (SIZE, SIZE), bytes(pixels))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    height = natural_height(59031)
    files = {
        "grass_micro_albedo.png": make_grass(height),
        "soil_micro_albedo.png": make_soil(height),
        "terrain_micro_normal.png": make_normal(height),
    }
    for name, image in files.items():
        path = OUT / name
        image.save(path, format="PNG", optimize=True)
        assert path.exists() and path.stat().st_size > 10_000, name
        assert Image.open(path).size == (SIZE, SIZE)
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        print("TERRAIN_DETAIL_ASSET:", name, SIZE, "px", path.stat().st_size, "bytes", sha)
    print("TERRAIN_DETAIL_BUILD_PASS: three 512px seamless repeatable texture assets")


if __name__ == "__main__":
    main()
