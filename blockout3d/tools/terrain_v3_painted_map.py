"""Lembah Asri Painted Terrain Pass v1.

Artist-directed, world-aligned painted colormap. This is a REAL baked texture,
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

    low = noise_image(SAMPLE_SIZE, 17, 85021).tobytes()
    medium = noise_image(SAMPLE_SIZE, 43, 87009).tobytes()
    small = noise_image(SAMPLE_SIZE, 137, 90147).tobytes()
    base = Image.new("RGB",(SAMPLE_SIZE,SAMPLE_SIZE))
    pixels = []
    rockmask = bytearray(SAMPLE_SIZE*SAMPLE_SIZE)
    pathmask = bytearray(SAMPLE_SIZE*SAMPLE_SIZE)
    sandmask = bytearray(SAMPLE_SIZE*SAMPLE_SIZE)

    grass_base = (119.0,163.0,102.0)
    earth_base = (165.0,125.0,89.0)
    sand_base = (221.0,196.0,148.0)
    rock_base = (120.0,118.0,107.0)

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
            lighting = 0.75*m+0.28*s+0.08*fine
            grass = (
                grass_base[0] + 24*lighting + 8*s,
                grass_base[1] + 18*lighting + 4*m,
                grass_base[2] + 19*lighting + 6*s)
            # Ochre grassy highlands with mossy patches.
            grass = blend(grass,(164,168,103),ease(5.0,17.0,h)*0.26)
            earth = (
                earth_base[0] + 18*lighting,
                earth_base[1] + 17*lighting,
                earth_base[2] + 10*lighting)
            sand = (
                sand_base[0] + 10*lighting,
                sand_base[1] + 14*lighting,
                sand_base[2] + 10*lighting)
            rock = (
                rock_base[0] + 35*lighting+7*s,
                rock_base[1] + 32*lighting+8*s,
                rock_base[2] + 24*lighting+10*s)
            # Rock faces form broad irregular masses, with colored grassy
            # interruptions. No narrow repeated horizontal contour stripes.
            slope = 1.0-normal_y
            ridge = ease(7.0,16.0,h)
            rock_amount = max(
                ease(0.13,0.48,slope+0.075*m+0.045*s),
                0.73*ridge*ease(0.05,0.27,slope+0.06*m))
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
    # Paint long, broken broadleaf-like brush marks. Their orientation and
    # size come from the terrain's region, so the island has composition:
    # fragmented rock facets, wavy grass pigments, earth and shore washes.
    palette_grass=[(201,206,139,31),(74,118,83,27),(231,206,122,22),
                   (92,144,99,24),(213,205,140,20)]
    palette_rock=[(62,74,74,32),(210,187,155,30),(94,106,98,28),
                  (182,173,143,24),(68,86,80,18)]
    palette_sand=[(248,230,182,35),(187,160,116,25),(246,209,152,23)]
    palette_soil=[(224,176,127,31),(109,83,67,22),(195,143,103,30)]
    painter=ImageDraw.Draw(base,"RGBA")
    rng=random.Random(8035)
    marks={"grass":0,"rock":0,"soil":0,"sand":0}
    for k in range(12400):
        x=rng.randrange(PAINT_SIZE)
        y=rng.randrange(PAINT_SIZE)
        index=(y//2)*SAMPLE_SIZE+(x//2)
        r=rockmask[index]
        p=pathmask[index]
        b=sandmask[index]
        if p>143:
            category="soil"
            shades=palette_soil
            length=rng.randrange(9,34)
            thickness=rng.randrange(2,8)
        elif b>150:
            category="sand"
            shades=palette_sand
            length=rng.randrange(10,40)
            thickness=rng.randrange(3,10)
        elif r>127:
            category="rock"
            shades=palette_rock
            length=rng.randrange(17,65)
            thickness=rng.randrange(6,21)
        else:
            category="grass"
            shades=palette_grass
            length=rng.randrange(10,43)
            thickness=rng.randrange(3,10)
        marks[category] += 1
        angle=rng.uniform(-0.70,0.70)
        if category=="rock":
            angle=rng.choice([-1,1])*rng.uniform(0.16,1.00)
        dx=math.cos(angle)*length
        dy=math.sin(angle)*length
        points=[
            (x-dx*0.58,y-dy*0.58-thickness*0.32),
            (x-dx*0.22,y-dy*0.22-thickness),
            (x+dx*0.50,y+dy*0.50-thickness*0.24),
            (x+dx*0.63,y+dy*0.63+thickness*0.19),
            (x+dx*0.10,y+dy*0.10+thickness*0.72),
            (x-dx*0.50,y-dy*0.50+thickness*0.22)]
        painter.polygon(points,fill=rng.choice(shades))
    base = base.filter(ImageFilter.GaussianBlur(0.32))
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    base.save(OUTPUT,format="PNG",optimize=True)
    if OUTPUT.stat().st_size < 120000:
        raise ValueError("Painted terrain is empty or missing rich color content")
    print("TERRAIN_V4_PAINTED_MAP_PASS:",OUTPUT.stat().st_size,
          "bytes; size=",base.size,"region brush marks=",marks,
          "world size metres=",round(hx*2),round(hz*2))
    return OUTPUT
