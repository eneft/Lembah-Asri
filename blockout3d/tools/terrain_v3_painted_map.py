"""Lembah Asri Painted Terrain Pass v1.1: clean, restrained watercolor-like washes.

Artist-directed, world-aligned painted colormap. No random high-contrast marks.
not a repeatable shader tile. Its large paint masses follow authoritative V3
terrain elevation, hill slopes, reserved village lots, dirt paths and beach
bands. Original atlas remains a very light close-up detail.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets/environment/island/terrain_v3_painted_colormap.png"
PAINT_SIZE = 1536
SAMPLE_SIZE = 768


def ease(a: float, b: float, x: float) -> float:
    v = max(0.0, min(1.0, (x-a)/(b-a)))
    return v*v*(3.0-2.0*v)


def blend(a, b, amount):
    t = max(0.0, min(1.0, amount))
    return tuple(a[i]*(1.0-t)+b[i]*t for i in range(3))


def noise_image(size: int, cells: int, seed: int):
    rng = random.Random(seed)
    im = Image.new("L", (cells,cells))
    im.putdata([rng.randrange(256) for _ in range(cells*cells)])
    return im.resize((size,size), Image.Resampling.BICUBIC)


def sample_field(array, nx, nz, x_grid, z_grid):
    ix = min(nx-1, max(0, int(x_grid)))
    iz = min(nz-1, max(0, int(z_grid)))
    dx = max(0.0,min(1.0,x_grid-ix))
    dz = max(0.0,min(1.0,z_grid-iz))
    n = nx+1
    a = array[iz*n+ix]
    b = array[iz*n+ix+1]
    c = array[(iz+1)*n+ix]
    d = array[(iz+1)*n+ix+1]
    return (a*(1.0-dx)*(1.0-dz)+b*dx*(1.0-dz)
            +c*(1.0-dx)*dz+d*dx*dz)


def paint_colormap(hx, hz, nx, nz, vertices, normals, colors, world_scale):
    """Paint a full-island color composition aligned to exported GLB UV_0."""
    if len(vertices) != (nx+1)*(nz+1) or len(colors) != len(vertices):
        raise ValueError("Painter has no matching terrain grid / landuse mask")
    terrain_y = [v[1]*world_scale for v in vertices]
    upward = [n[1] for n in normals]
    lots = [c[0] for c in colors]
    yards = [c[1] for c in colors]
    tracks = [c[2] for c in colors]
    sand_masks = [c[3] for c in colors]

    low = noise_image(SAMPLE_SIZE, 11, 85021).tobytes()
    medium = noise_image(SAMPLE_SIZE, 25, 87009).tobytes()
    small = noise_image(SAMPLE_SIZE, 64, 90147).tobytes()
    base = Image.new("RGB",(SAMPLE_SIZE,SAMPLE_SIZE))
    pixels = []
    rockmask = bytearray(SAMPLE_SIZE*SAMPLE_SIZE)
    pathmask = bytearray(SAMPLE_SIZE*SAMPLE_SIZE)
    sandmask = bytearray(SAMPLE_SIZE*SAMPLE_SIZE)

    grass_base = (128.0,166.0,109.0)
    earth_base = (166.0,131.0,98.0)
    sand_base = (218.0,192.0,148.0)
    rock_base = (125.0,123.0,112.0)

    for j in range(SAMPLE_SIZE):
        v = j / (SAMPLE_SIZE-1)
        zz = v*nz
        for i in range(SAMPLE_SIZE):
            index = j*SAMPLE_SIZE+i
            uu = i/(SAMPLE_SIZE-1)
            xx = uu*nx
            h = sample_field(terrain_y,nx,nz,xx,zz)
            normal_y = sample_field(upward,nx,nz,xx,zz)
            plot = sample_field(lots,nx,nz,xx,zz)
            yard = sample_field(yards,nx,nz,xx,zz)
            path = sample_field(tracks,nx,nz,xx,zz)
            coast = sample_field(sand_masks,nx,nz,xx,zz)
            m = (low[index]-128)/128.0
            s = (medium[index]-128)/128.0
            fine = (small[index]-128)/128.0
            # Broad *painted* regions, not repeating shader cells.
            lighting = 0.63*m+0.22*s+0.025*fine
            grass = (
                grass_base[0] + 13*lighting + 2*s,
                grass_base[1] + 11*lighting + 1.8*m,
                grass_base[2] + 12*lighting + 2*s)
            # Ochre grassy highlands with mossy patches.
            grass = blend(grass,(158,166,116),ease(5.0,17.0,h)*0.18)
            earth = (
                earth_base[0] + 10*lighting,
                earth_base[1] + 9*lighting,
                earth_base[2] + 7*lighting)
            sand = (
                sand_base[0] + 7*lighting,
                sand_base[1] + 7*lighting,
                sand_base[2] + 6*lighting)
            rock = (
                rock_base[0] + 18*lighting+3*s,
                rock_base[1] + 16*lighting+3*s,
                rock_base[2] + 14*lighting+3*s)
            # Rock faces form broad irregular masses, with colored grassy
            # interruptions. No narrow repeated horizontal contour stripes.
            slope = 1.0-normal_y
            ridge = ease(7.0,16.0,h)
            rock_amount = max(
                ease(0.13,0.50,slope+0.047*m+0.018*s),
                0.73*ridge*ease(0.05,0.30,slope+0.035*m))
            rock_amount *= 1.0-ease(0.58,0.92,m)*0.24
            coast_amount = max(coast*0.90, (1.0-ease(0.65,3.4,h))*0.27)
            color = blend(grass,rock,rock_amount)
            color = blend(color,sand,coast_amount*(1.0-rock_amount*0.6))
            color = blend(color,earth,min(0.96,path*0.81+plot*0.86))
            color = blend(color,grass, yard*0.22*(1.0-path))
            pixels.append(tuple(int(max(0,min(255,x))) for x in color))
            rockmask[index] = int(255*rock_amount)
            pathmask[index] = int(255*max(path,plot))
            sandmask[index] = int(255*coast_amount)

    base.putdata(pixels)
    base = base.resize((PAINT_SIZE,PAINT_SIZE),Image.Resampling.BICUBIC)
    # RESTRAINED PAINT PASS: V1 drew 12,400 sharp polygon strokes across
    # the entire map, creating a messy scribbled appearance. The big terrain
    # masses above now own the composition. Add only a small set of extremely
    # soft, region-colored washes with feathered edges; no hard marks.
    palette_grass = [(179,191,143,16), (94,142,105,13)]
    palette_rock  = [(162,152,131,14), (103,110,104,13)]
    palette_sand  = [(235,210,172,13), (198,177,144,12)]
    palette_soil  = [(194,158,118,13), (139,109,86,12)]
    wash = Image.new("RGBA", (PAINT_SIZE, PAINT_SIZE), (0,0,0,0))
    painter = ImageDraw.Draw(wash, "RGBA")
    rng = random.Random(8035)
    marks = {"grass":0, "rock":0, "soil":0, "sand":0}
    for _ in range(900):
        x = rng.randrange(PAINT_SIZE)
        y = rng.randrange(PAINT_SIZE)
        index = (y//2)*SAMPLE_SIZE + (x//2)
        r, p, b = rockmask[index], pathmask[index], sandmask[index]
        if p > 156:
            category, shades = "soil", palette_soil
        elif b > 150:
            category, shades = "sand", palette_sand
        elif r > 140:
            category, shades = "rock", palette_rock
        else:
            category, shades = "grass", palette_grass
        marks[category] += 1
        # Rounded watercolor patches rather than sharp triangular strokes.
        # Keep marks larger but far fewer, with very low opacity.
        radius_x = rng.randrange(16, 38)
        radius_y = rng.randrange(7, 18)
        painter.ellipse((x-radius_x,y-radius_y,
                         x+radius_x,y+radius_y), fill=rng.choice(shades))
    # Blur ONLY the brush overlay, preserving the terrain's original palette
    # and smooth village trail/shoreline boundaries.
    wash = wash.filter(ImageFilter.GaussianBlur(6.0))
    base = Image.alpha_composite(base.convert("RGBA"),wash).convert("RGB")

    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    base.save(OUTPUT,format="PNG",optimize=True)
    if OUTPUT.stat().st_size < 120000:
        raise ValueError("Painted terrain is empty or missing rich color content")
    print("TERRAIN_V4_PAINTED_MAP_PASS:",OUTPUT.stat().st_size,
          "bytes; size=",base.size,"region brush marks=",marks,
          "world size metres=",round(hx*2),round(hz*2))
    print("PAINTED_TERRAIN_CLEAN_PASS: 900 blurred low-opacity washes; no 12400 sharp brush polygons")
    return OUTPUT
