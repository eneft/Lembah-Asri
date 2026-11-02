#!/usr/bin/env python3
"""Lembah Asri V3: rebuild CLEAN island topology and paint a small tiled atlas.

Source GLB provides the island's XZ footprint ONLY. We do not reuse its
photogrammetry triangles or UV islands. Height comes from the V2 blueprint
height_at() and is sampled on a uniform 1m grid; visual and physics use the
same final surface triangles. No original source asset is overwritten.
"""
from __future__ import annotations

from collections import deque
import io
import json
import math
from pathlib import Path
import random
import struct

from PIL import Image, ImageDraw, ImageFilter
from terrain_v2_topography import height_at, river_center_x, WORLD_SCALE
from terrain_v3_landuse import surface_weights, validate_layout

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/environment/island/terrain base.glb"
OUTPUT = ROOT / "assets/environment/island/terrain_base_web.glb"
GRID_M = 1.0
ATLAS_PIXELS = 1024
SEA_Y = 0.45


def load_source() -> tuple[dict, bytes]:
    raw = SOURCE.read_bytes()
    if len(raw) < 20 or raw[:4] != b"glTF":
        raise ValueError("Original source is not a valid GLB")
    magic, version, total = struct.unpack_from("<4sII", raw)
    if version != 2 or total != len(raw):
        raise ValueError("Source GLB header invalid")
    cursor = 12
    chunks = []
    while cursor < total:
        length, kind = struct.unpack_from("<I4s", raw, cursor)
        cursor += 8
        chunks.append((kind, raw[cursor:cursor+length]))
        cursor += length
    if len(chunks) < 2 or chunks[0][0] != b"JSON" or chunks[1][0] != b"BIN\x00":
        raise ValueError("GLB must contain JSON and binary chunks")
    return json.loads(chunks[0][1].decode("utf8").rstrip(" \x00")), chunks[1][1]


def accessor(g: dict, blob: bytes, index: int) -> list:
    a = g["accessors"][index]
    view = g["bufferViews"][a["bufferView"]]
    dtype = a["componentType"]
    kind = a["type"]
    formats = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
    if dtype not in formats or kind not in ("SCALAR", "VEC3"):
        raise ValueError(f"Unsupported accessor {index}: {dtype} {kind}")
    code, byte_size = formats[dtype]
    components = 3 if kind == "VEC3" else 1
    stride = view.get("byteStride", components * byte_size)
    off = view.get("byteOffset", 0) + a.get("byteOffset", 0)
    record = struct.Struct("<" + code * components)
    if a.get("sparse") or off + (a["count"]-1) * stride + record.size > len(blob):
        raise ValueError("Sparse/truncated accessors are unsupported")
    return [record.unpack_from(blob, off+i*stride) for i in range(a["count"])]


def footprint(g: dict, blob: bytes):
    """Rasterize original walkable projected triangles, then close scan gaps."""
    prims = [p for m in g.get("meshes", []) for p in m.get("primitives", [])
             if "POSITION" in p.get("attributes", {}) and "indices" in p]
    if not prims:
        raise ValueError("Source has no indexed terrain triangles")
    pos_cache = {p["attributes"]["POSITION"]: accessor(g, blob, p["attributes"]["POSITION"]) for p in prims}
    xs = [v[0] for points in pos_cache.values() for v in points]
    zs = [v[2] for points in pos_cache.values() for v in points]
    x0, x1 = min(xs), max(xs)
    z0, z1 = min(zs), max(zs)
    hx = (x1-x0)*WORLD_SCALE/2
    hz = (z1-z0)*WORLD_SCALE/2
    if hx < 20 or hz < 20:
        raise ValueError("Source footprint bounds too small")
    nx = math.ceil(hx*2/GRID_M)
    nz = math.ceil(hz*2/GRID_M)
    dx = hx*2/nx
    dz = hz*2/nz
    covered = bytearray(nx*nz)
    used = 0
    skipped = 0
    for p in prims:
        verts = pos_cache[p["attributes"]["POSITION"]]
        ids = accessor(g, blob, p["indices"])
        if len(ids) % 3:
            raise ValueError("Source index count must be divisible by 3")
        for t in range(0, len(ids), 3):
            a, b, c = (verts[ids[t+k][0]] for k in range(3))
            ux, uy, uz = (b[j]-a[j] for j in range(3))
            vx, vy, vz = (c[j]-a[j] for j in range(3))
            norm_x = uy*vz-uz*vy
            norm_y = uz*vx-ux*vz
            norm_z = ux*vy-uy*vx
            norm_l = math.sqrt(norm_x**2+norm_y**2+norm_z**2)
            if norm_l < 1e-12 or abs(norm_y)/norm_l < 0.22:
                skipped += 1
                continue
            poly = [((v[0]-x0)*WORLD_SCALE/dx, (v[2]-z0)*WORLD_SCALE/dz) for v in (a,b,c)]
            (ax,az),(bx,bz),(cx,cz) = poly
            det = (bx-ax)*(cz-az)-(bz-az)*(cx-ax)
            if abs(det) < 1e-9:
                continue
            lx = max(0, math.floor(min(ax,bx,cx)))
            uxg = min(nx-1, math.ceil(max(ax,bx,cx)))
            lz = max(0, math.floor(min(az,bz,cz)))
            uzg = min(nz-1, math.ceil(max(az,bz,cz)))
            for j in range(lz,uzg+1):
                py = j+0.5
                for i in range(lx,uxg+1):
                    px = i+0.5
                    u = ((px-ax)*(cz-az)-(py-az)*(cx-ax))/det
                    v = ((bx-ax)*(py-az)-(bz-az)*(px-ax))/det
                    if u >= -0.0001 and v >= -0.0001 and u+v <= 1.0001:
                        covered[j*nx+i] = 1
            used += 1
    # Close one-cell photogrammetry gaps, while preserving the uneven coast.
    dilated = bytearray(covered)
    for j in range(1,nz-1):
        for i in range(1,nx-1):
            k = j*nx+i
            if covered[k-1] or covered[k+1] or covered[k-nx] or covered[k+nx]:
                dilated[k] = 1
    cleaned = bytearray(dilated)
    for j in range(1,nz-1):
        for i in range(1,nx-1):
            k = j*nx+i
            if not (dilated[k-1] and dilated[k+1] and dilated[k-nx] and dilated[k+nx]):
                cleaned[k] = 0
    amount = sum(cleaned)
    if amount < nx*nz*.25:
        raise ValueError(f"Footprint unexpectedly sparse: {amount}/{nx*nz}")
    print("TERRAIN_V3_FOOTPRINT:", nx, "x", nz, "grid", amount,
          "land cells", used, "top-facing original triangles", skipped, "source skirts excluded")
    return hx,hz,nx,nz,dx,dz,cleaned


def coast_distance(nx: int, nz: int, occupied: bytearray, step: float):
    """World-meter distance to the nearest non-land cell or grid boundary."""
    inf = 10**8
    steps = [inf] * (nx*nz)
    queue = deque()
    for j in range(nz):
        for i in range(nx):
            k = j*nx+i
            if not occupied[k] or i == 0 or j == 0 or i == nx-1 or j == nz-1:
                steps[k] = 0
                queue.append(k)
    while queue:
        k = queue.popleft()
        j,i = divmod(k,nx)
        for nxt in (k-1 if i else k,k+1 if i+1<nx else k,
                    k-nx if j else k,k+nx if j+1<nz else k):
            if steps[nxt] > steps[k]+1:
                steps[nxt] = steps[k]+1
                queue.append(nxt)
    return [v*step for v in steps]


def smooth(a: float,b:float,x:float)->float:
    t=max(0.0,min(1.0,(x-a)/(b-a)))
    return t*t*(3-2*t)


def make_geometry(hx,hz,nx,nz,dx,dz,occupied):
    # Grid vertices are SHARED, so there are no cracks, overlapping surfaces,
    # zero-area triangles, or legacy scan undersides.
    shore = coast_distance(nx,nz,occupied,min(dx,dz))
    # Approximate shoreline distance per corner by nearest four cell centers.
    heights = []
    vertices = []
    uvs = []
    shore_per_vertex = []
    for j in range(nz+1):
        z = -hz + j*dz
        for i in range(nx+1):
            x = -hx + i*dx
            near = []
            for cj in (j-1,j):
                for ci in (i-1,i):
                    if 0<=ci<nx and 0<=cj<nz:
                        near.append(shore[cj*nx+ci])
            # Average neighbour distances instead of picking the largest.
            # The latter made a sharp stair-stepped terrace at each cell of
            # the coastline raster. Keep the actual island footprint.
            distance = sum(near)/len(near) if near else 0.0
            raw_height = height_at(x,z,hx,hz)
            # A broader gently sloping beach taper makes sand meet the ocean
            # without a steep 1m ledge. Collision uses this SAME visual mesh.
            beach = smooth(0.0, 9.0, distance)
            h = 0.10 + (raw_height-0.10)*beach
            heights.append(h)
            shore_per_vertex.append(distance)
            vertices.append((x/WORLD_SCALE,h/WORLD_SCALE,z/WORLD_SCALE))
            uvs.append(((x+hx)/(2*hx), (z+hz)/(2*hz)))
    normals = []
    for j in range(nz+1):
        for i in range(nx+1):
            ia = max(0,i-1); ib=min(nx,i+1)
            ja = max(0,j-1); jb=min(nz,j+1)
            slope_x = (heights[j*(nx+1)+ib]-heights[j*(nx+1)+ia])/(max(dx, (ib-ia)*dx))
            slope_z = (heights[jb*(nx+1)+i]-heights[ja*(nx+1)+i])/(max(dz, (jb-ja)*dz))
            n=(-slope_x,1.0,-slope_z)
            mag=math.sqrt(sum(v*v for v in n))
            normals.append(tuple(v/mag for v in n))
    colors = []
    for j in range(nz+1):
        z = -hz + j*dz
        river_x = river_center_x(z)
        for i in range(nx+1):
            idx = j*(nx+1)+i
            x = -hx + i*dx
            lot, yard, path = surface_weights(x, z, heights[idx], normals[idx][1],
                                               shore_per_vertex[idx], river_x)
            # A=coastal sand band for material; protected rocky north/west
            # has less sand than the village and fishing shore south/east.
            # Distance-to-COAST is more robust than an absolute height cutoff.
            v = z/hz
            u = x/hx
            sandy_direction = max(smooth(0.02, 0.63, v), smooth(0.35, 0.75, u))
            coast_band = (1.0-smooth(2.0, 12.0, shore_per_vertex[idx]))
            coastal_sand = coast_band * (0.16 + 0.84*sandy_direction)
            colors.append((lot, yard, path, coastal_sand))
    indices = []
    for j in range(nz):
        for i in range(nx):
            if not occupied[j*nx+i]:
                continue
            a = j*(nx+1)+i
            b = a+1
            c = a+nx+1
            d = c+1
            indices.extend((a,c,b,b,c,d))
    if len(indices) < 6000:
        raise ValueError("Clean mesh has too few triangles")
    if max(indices)>=len(vertices) or len(indices)%3:
        raise ValueError("Invalid clean mesh index buffer")
    print("TERRAIN_V3_TOPOLOGY_PASS:",len(vertices),"grid vertices",len(indices)//3,
          "non-overlapping upward-facing triangles", "waterline",SEA_Y)
    active = [c for c in colors if max(c[0],c[1],c[2]) > 0.15]
    marked_lots = sum(c[0] > 0.4 for c in active)
    marked_yards = sum(c[1] > 0.4 for c in active)
    marked_paths = sum(c[2] > 0.4 for c in active)
    if marked_lots < 100 or marked_yards < 180 or marked_paths < 100:
        raise ValueError("Terrain V3 future plot masks too sparse; revisit actual coastline/layout")
    print("TERRAIN_V3_PLOTS_PASS:", len(colors), "vertex colors",
          marked_lots, "building-footprint", marked_yards, "yard", marked_paths,
          "path marked vertices; softened coast and sandy fringe retained")
    return vertices,normals,uvs,colors,indices


def _wrap_quadrant(core: Image.Image) -> Image.Image:
    """8px wrapped gutters prevent atlas cross-bleed and visible tiling seams."""
    tile_size = ATLAS_PIXELS // 2
    pad = 8
    core_size = tile_size - 2 * pad
    if core.size != (core_size, core_size):
        raise ValueError("Painterly atlas tile core dimensions invalid")
    tile = Image.new("RGB", (tile_size, tile_size))
    tile.paste(core, (pad, pad))
    tile.paste(core.crop((core_size-pad, 0, core_size, core_size)), (0, pad))
    tile.paste(core.crop((0, 0, pad, core_size)), (pad+core_size, pad))
    tile.paste(tile.crop((0, core_size, tile_size, core_size+pad)), (0, 0))
    tile.paste(tile.crop((0, pad, tile_size, pad*2)), (0, pad+core_size))
    return tile


def _paint_illustrated_rock(core_size: int) -> Image.Image:
    """Tileable stylized stone strata and hand-painted cracks (not oval noise)."""
    rng = random.Random(30814)
    base = Image.new("RGB", (core_size, core_size), (114, 112, 98))
    draw = ImageDraw.Draw(base)
    tones = [(104,105,96), (123,121,103), (140,132,109),
             (91,94,86), (151,141,117), (116,112,97)]
    for y in range(-64, core_size+64, 23):
        rise = rng.randint(-12, 12)
        color = tones[rng.randrange(len(tones))]
        for shift_y in (-core_size, 0, core_size):
            draw.polygon([
                (0,y+shift_y+rise), (core_size//3,y+shift_y+rise-6),
                (2*core_size//3,y+shift_y+rise+4),
                (core_size,y+shift_y+rise), (core_size,y+shift_y+rise+20),
                (0,y+shift_y+rise+18)], fill=color)
    for k in range(750):
        x,y=rng.randrange(core_size),rng.randrange(core_size)
        rw,rh=rng.randint(4,25),rng.randint(2,9)
        col=tones[rng.randrange(len(tones))]
        points=[(x-rw,y-rh),(x+rw//3,y-rh-rng.randint(0,3)),
                (x+rw,y+rh//2),(x,y+rh)]
        for ox in (-core_size,0,core_size):
            for oy in (-core_size,0,core_size):
                draw.polygon([(px+ox,py+oy) for px,py in points],fill=col)
    for k in range(470):
        x,y=rng.randrange(core_size),rng.randrange(core_size)
        length=rng.randint(7,53)
        dye=(66,73,70) if k%3 else (177,163,128)
        dy=rng.randint(-6,5)
        for ox in (-core_size,0,core_size):
            for oy in (-core_size,0,core_size):
                draw.line([(x+ox,y+oy),(x+ox+length,y+oy+dy)],
                          fill=dye,width=1 if k%4 else 2)
    return base.filter(ImageFilter.GaussianBlur(0.35))


def make_atlas() -> bytes:
    """Bake the APPROVED hand-painted grass reference, preserving other biomes.

    The 384px WebP is a carefully seam-reconciled copy of the image the user
    selected. Unlike the previous random-oval generator, its actual painted
    blades and natural tuft shapes appear directly in-game. This source stays
    in the repository and is scaled inside the build step for easy iteration.
    """
    atlas = Image.new("RGB", (ATLAS_PIXELS, ATLAS_PIXELS))
    core_size = ATLAS_PIXELS // 2 - 16
    grass_source = ROOT / "assets/environment/island/grass_painterly_tile.webp"
    if not grass_source.is_file():
        raise FileNotFoundError("Approved Lembah Asri painterly grass asset missing: " + str(grass_source))
    with Image.open(grass_source) as original_grass:
        if original_grass.width < 256 or original_grass.height < 256:
            raise ValueError("Approved grass artwork too small")
        grass = original_grass.convert("RGB").resize((core_size, core_size), Image.Resampling.LANCZOS)
    atlas.paste(_wrap_quadrant(grass), (0, 0))
    palettes = [
        [(129,101,72),(153,121,83),(173,139,100),(117,91,66)], # earth
        [(193,164,113),(208,179,128),(225,198,150),(175,149,102)], # sand
        [(104,101,88),(120,119,104),(139,133,114),(91,93,82)], # rock
    ]
    for idx, palette in enumerate(palettes):
        k = idx + 1
        rng = random.Random(15143+k*7907)
        if k == 3:
            core = _paint_illustrated_rock(core_size)
        else:
            core = Image.new("RGB", (core_size, core_size), palette[0])
            painter = ImageDraw.Draw(core)
            for stroke in range(11000):
                px = rng.randrange(core_size)
                py = rng.randrange(core_size)
                col = palette[rng.randrange(len(palette))]
                radius_x = rng.randrange(1, 10)
                radius_y = rng.randrange(1, 5)
                for ox in (-core_size, 0, core_size):
                    for oy in (-core_size, 0, core_size):
                        painter.ellipse((px+ox-radius_x, py+oy-radius_y,
                            px+ox+radius_x, py+oy+radius_y), fill=col)
            core = core.filter(ImageFilter.GaussianBlur(0.42))
        atlas.paste(_wrap_quadrant(core),
                    ((k % 2) * (ATLAS_PIXELS // 2), (k // 2) * (ATLAS_PIXELS // 2)))
    out = io.BytesIO()
    atlas.save(out, "JPEG", quality=91, optimize=True, subsampling=0)
    print("TERRAIN_V3_GRASS_REFERENCE_PASS: user-approved painterly grass",
          grass_source.stat().st_size, "source bytes, wrapped seamless 496px core")
    print("TERRAIN_V3_TEXTURE_PASS: one 1024x1024 baked painted atlas",
          len(out.getvalue()), "bytes; painted grass and STRATIFIED ROCK, soil, sand")
    return out.getvalue()


def export_glb(vertices,normals,uvs,colors,indices,atlas):
    binary=bytearray()
    views=[]
    def append(payload: bytes, target=None):
        while len(binary)%4:
            binary.append(0)
        view={"buffer":0,"byteOffset":len(binary),"byteLength":len(payload)}
        if target is not None:
            view["target"]=target
        views.append(view)
        binary.extend(payload)
        return len(views)-1
    position_data=b"".join(struct.pack("<3f",*p) for p in vertices)
    normal_data=b"".join(struct.pack("<3f",*n) for n in normals)
    uv_data=b"".join(struct.pack("<2f",*uv) for uv in uvs)
    color_data=b"".join(struct.pack("<4f",*color) for color in colors)
    index_data=struct.pack("<"+"I"*len(indices),*indices)
    pos_view=append(position_data,34962)
    normal_view=append(normal_data,34962)
    uv_view=append(uv_data,34962)
    color_view=append(color_data,34962)
    index_view=append(index_data,34963)
    image_view=append(atlas)
    xs=[p[0] for p in vertices];ys=[p[1] for p in vertices];zs=[p[2] for p in vertices]
    g={
      "asset":{"version":"2.0","generator":"Lembah Asri V3 clean coastal heightfield + hand painted atlas"},
      "scene":0,"scenes":[{"nodes":[0]}],
      "nodes":[{"name":"TerrainV3CleanIsland","mesh":0}],
      "meshes":[{"name":"TerrainV3CleanIsland","primitives":[{
        "attributes":{"POSITION":0,"NORMAL":1,"TEXCOORD_0":2,"COLOR_0":3},
        "indices":4,"material":0,"mode":4
      }]}],
      "materials":[{"name":"LembahAsriV3PainterlyAtlas","doubleSided":False,
        "pbrMetallicRoughness":{"baseColorTexture":{"index":0},
          "metallicFactor":0.0,"roughnessFactor":0.97}}],
      "textures":[{"sampler":0,"source":0}],
      "samplers":[{"magFilter":9729,"minFilter":9987,"wrapS":10497,"wrapT":10497}],
      "images":[{"mimeType":"image/jpeg","bufferView":image_view}],
      "buffers":[{"byteLength":len(binary)}],"bufferViews":views,
      "accessors":[
        {"bufferView":pos_view,"componentType":5126,"count":len(vertices),"type":"VEC3",
         "min":[min(xs),min(ys),min(zs)],"max":[max(xs),max(ys),max(zs)]},
        {"bufferView":normal_view,"componentType":5126,"count":len(normals),"type":"VEC3"},
        {"bufferView":uv_view,"componentType":5126,"count":len(uvs),"type":"VEC2"},
        {"bufferView":color_view,"componentType":5126,"count":len(colors),"type":"VEC4"},
        {"bufferView":index_view,"componentType":5125,"count":len(indices),"type":"SCALAR",
         "min":[min(indices)],"max":[max(indices)]}
      ],
      "extras":{"terrain_revision":"V3 topology rebuild; one atlas; same mesh physics"},
    }
    j=json.dumps(g,separators=(",",":")).encode("utf-8")
    j+=b" "*((-len(j))%4)
    binary.extend(b"\x00"*((-len(binary))%4))
    total=12+8+len(j)+8+len(binary)
    with OUTPUT.open("wb") as out:
        out.write(struct.pack("<4sII",b"glTF",2,total))
        out.write(struct.pack("<I4s",len(j),b"JSON"))
        out.write(j)
        out.write(struct.pack("<I4s",len(binary),b"BIN\x00"))
        out.write(binary)
    print("TERRAIN_V3_WEB_GLB_PASS:",OUTPUT.stat().st_size,"bytes",
          "original source untouched",SOURCE.stat().st_size,"bytes")


def main():
    g,source_blob=load_source()
    print("TERRAIN_V3_LAYOUT_PLAN:", validate_layout(), "planned lots/paths")
    hx,hz,nx,nz,dx,dz,occupied=footprint(g,source_blob)
    vertices,normals,uvs,colors,indices=make_geometry(hx,hz,nx,nz,dx,dz,occupied)
    export_glb(vertices,normals,uvs,colors,indices,make_atlas())


if __name__=="__main__":
    main()
