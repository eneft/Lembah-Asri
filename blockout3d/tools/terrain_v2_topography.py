#!/usr/bin/env python3
"""Lembah Asri Terrain V2: geometry-only topography rebuild on user's GLB.

Blueprint:
* 70%+ of walkable land is near-level plain / broad plateau (grade < 0.20)
* One northern landmark mountain (~24m), two smaller rocky hills
* Central/southern flat village/fields, western rice terrace plateau
* Southern/eastern sandy coastal shelves; northern/western rugged coast; river

This is intentionally a BUILD-TIME mesh edit, not a heavy runtime shader.
The source terrain base.glb is never modified. Position and normal accessors
are rewritten in a derived Web GLB's BIN chunk, preserving UVs, indices,
materials, texture layout and original island silhouette in XZ.
"""
from __future__ import annotations

import math
import struct
from typing import Any

WORLD_SCALE = 140.0
SEA_HEIGHT_M = 0.45
FLAT_SLOPE_LIMIT = 0.20


def smoothstep(a: float, b: float, value: float) -> float:
    t = max(0.0, min(1.0, (value - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def mesa(u: float, v: float, cx: float, cz: float,
         rx: float, rz: float, elevation: float) -> float:
    radius = math.hypot((u - cx) / rx, (v - cz) / rz)
    return elevation * (1.0 - smoothstep(0.60, 1.20, radius))


def hill(u: float, v: float, cx: float, cz: float,
         rx: float, rz: float, elevation: float) -> float:
    radius2 = ((u - cx) / rx) ** 2 + ((v - cz) / rz) ** 2
    return elevation * math.exp(-2.7 * radius2)


def river_center_x(z: float) -> float:
    """Shared river path with terrain_base_test.gd (world XZ meters)."""
    return -5.0 * math.sin((z + 55.0) * 0.047) + 1.5 * math.sin((z + 34.0) * 0.13)


def height_at(x: float, z: float, half_x: float, half_z: float) -> float:
    """Deterministic smooth height-field in meters, centered on terrain XZ."""
    u = x / half_x
    v = z / half_z
    edge = max(abs(u), abs(v))

    # Naturally sloping 2.6m south land, broad 4.1m central/northern plains.
    height = 2.65 + 1.40 * (1.0 - smoothstep(-0.15, 0.75, v))

    # A WEST: big flat-topped terraced fields with smooth ramps.
    height += mesa(u, v, -0.57, -0.35, 0.45, 0.39, 2.65)
    # C: continuous, level village/central plateau.
    height += mesa(u, v, 0.12, -0.10, 0.53, 0.38, 0.72)
    # D: very gentle west/south agricultural plots.
    height += mesa(u, v, -0.50, 0.33, 0.32, 0.26, 0.32)

    # A: ONE obvious landmark mountain in northern rear.
    height += hill(u, v, 0.08, -0.73, 0.19, 0.19, 20.0)
    # E: only two modest secondary hills at northeast/northwest.
    height += hill(u, v, 0.64, -0.55, 0.19, 0.17, 7.5)
    height += hill(u, v, -0.71, -0.68, 0.14, 0.16, 4.0)

    # G: southern/eastern beaches descend gently to the sea, while northern
    # and western rocky coastlines keep short dramatic cliffs (as in concept).
    # This also concentrates most slope in a narrow shoreline strip, leaving
    # central and southern areas truly flat for walking and building.
    beach_weight = max(smoothstep(0.30, 0.65, v),
                       smoothstep(0.50, 0.80, u))
    coast_begin = 0.945 - 0.065 * beach_weight
    coast = smoothstep(coast_begin, 1.01, edge)
    height = height * (1.0 - coast) + 0.15 * coast

    # One main river, source at mountain foothill -> central plateau ->
    # southern sea. Incise a narrow ~2.9m channel; its middle gradually
    # drops downstream. Three sculpted water-level steps create potential
    # waterfall sites without scattering hills over the playable flats.
    center = river_center_x(z)
    downstream = max(0.0, min(1.0, (48.0 - z) / 90.0))
    river_level = 1.40 + 4.60 * downstream
    river_floor = min(height - 0.46, river_level)
    river_weight = math.exp(-2.20 * (abs(x - center) / 2.90) ** 4)
    river_weight *= smoothstep(-45.0, -32.0, z)
    river_weight *= 1.0 - smoothstep(45.0, 52.0, z)
    height = height * (1.0 - river_weight) + river_floor * river_weight
    return height


def _accessor_data(g: dict[str, Any], data: bytearray, accessor_index: int,
                   expected_type: str, component: int) -> tuple[int, int, int]:
    accessor = g["accessors"][accessor_index]
    if accessor.get("sparse") or accessor.get("componentType") != component or accessor.get("type") != expected_type:
        raise ValueError("Unsupported original GLB accessor format: " + str(accessor_index))
    view = g["bufferViews"][accessor["bufferView"]]
    base = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    count = accessor["count"]
    stride = view.get("byteStride", {"VEC3": 12, "SCALAR": 4}[expected_type])
    need = {"VEC3": 12, "SCALAR": {5121: 1, 5123: 2, 5125: 4}.get(component, 4)}[expected_type]
    if base + max(0, count - 1) * stride + need > len(data):
        raise ValueError("Truncated GLB accessor")
    return base, count, stride


def rebuild_topography(g: dict[str, Any], source_binary: bytes) -> bytes:
    """Mutate only position/normal data and vertex bounds; return binary."""
    data = bytearray(source_binary)
    primitive_list = [prim for mesh in g.get("meshes", [])
                      for prim in mesh.get("primitives", [])
                      if "POSITION" in prim.get("attributes", {})]
    if not primitive_list:
        raise ValueError("Terrain GLB contains no mesh POSITION accessor")

    positions: dict[int, list[tuple[float, float, float]]] = {}
    for prim in primitive_list:
        ai = prim["attributes"]["POSITION"]
        if ai in positions:
            continue
        offset, count, stride = _accessor_data(g, data, ai, "VEC3", 5126)
        positions[ai] = [
            struct.unpack_from("<fff", data, offset + i * stride)
            for i in range(count)
        ]
    all_points = [point for verts in positions.values() for point in verts]
    x_low = min(p[0] for p in all_points)
    x_high = max(p[0] for p in all_points)
    z_low = min(p[2] for p in all_points)
    z_high = max(p[2] for p in all_points)
    old_min_y = min(p[1] for p in all_points)
    old_max_y = max(p[1] for p in all_points)
    half_x = (x_high - x_low) * WORLD_SCALE * 0.5
    half_z = (z_high - z_low) * WORLD_SCALE * 0.5
    mid_x = (x_low + x_high) * 0.5
    mid_z = (z_low + z_high) * 0.5
    if half_x < 20 or half_z < 20:
        raise ValueError("Source GLB island is too narrow for planned blueprint: %s, %s" % (half_x, half_z))

    # Photogrammetry GLBs often include vertical cliff skirts, underside faces
    # and large side-wall triangles. Reprojecting those triangles into a
    # heightfield turns them into huge overlapping shards on the walkable land.
    # Cull near-vertical ORIGINAL faces before resculpting; keep the original
    # index buffer layout (degenerate triangles, no accessor resizing).
    culled = 0
    examined = 0
    for prim in primitive_list:
        index_i = prim.get("indices")
        if index_i is None:
            continue
        index_accessor = g["accessors"][index_i]
        component = index_accessor["componentType"]
        fmt = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4)}.get(component)
        if fmt is None:
            raise ValueError("Unsupported index type for terrain V2")
        off, n, stride = _accessor_data(g, data, index_i, "SCALAR", component)
        verts = positions[prim["attributes"]["POSITION"]]
        if n % 3:
            raise ValueError("Terrain triangle index count not divisible by 3")
        for tri in range(0, n, 3):
            indices = [struct.unpack_from("<" + fmt[0], data, off + (tri + k) * stride)[0] for k in range(3)]
            if max(indices) >= len(verts):
                raise ValueError("Terrain index out of range")
            a, b, c = [verts[k] for k in indices]
            ux, uy, uz = b[0]-a[0], b[1]-a[1], b[2]-a[2]
            vx, vy, vz = c[0]-a[0], c[1]-a[1], c[2]-a[2]
            nx, ny, nz = uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx
            area_sq = nx*nx + ny*ny + nz*nz
            examined += 1
            # Remove near-vertical non-walkable wall triangles. Their source
            # normals are too steep to represent terrain after flattening.
            if area_sq > 1e-18 and abs(ny) / math.sqrt(area_sq) < 0.22:
                for k in (1, 2):
                    struct.pack_into("<" + fmt[0], data, off + (tri + k) * stride, indices[0])
                culled += 1
    print("TERRAIN_V2_SKIRT_CULL:", culled, "of", examined, "source triangles")

    new_y_by_accessor: dict[int, list[float]] = {}
    for ai, verts in positions.items():
        heights = [
            height_at((x - mid_x) * WORLD_SCALE, (z - mid_z) * WORLD_SCALE, half_x, half_z)
            / WORLD_SCALE for x, _, z in verts
        ]
        offset, _, stride = _accessor_data(g, data, ai, "VEC3", 5126)
        for i, height in enumerate(heights):
            struct.pack_into("<f", data, offset + i * stride + 4, height)
        old = g["accessors"][ai]
        old["min"] = [
            min(p[0] for p in verts), min(heights), min(p[2] for p in verts)]
        old["max"] = [
            max(p[0] for p in verts), max(heights), max(p[2] for p in verts)]
        new_y_by_accessor[ai] = heights

    # Recompute normals for the new height field. This prevents incorrect
    # lighting after removing hundreds of small noisy hills.
    normals_updated = set()
    for prim in primitive_list:
        ai = prim["attributes"]["POSITION"]
        normal_i = prim["attributes"].get("NORMAL")
        if normal_i is None or normal_i in normals_updated:
            continue
        base, count, stride = _accessor_data(g, data, normal_i, "VEC3", 5126)
        verts = positions[ai]
        if count != len(verts):
            raise ValueError("Terrain NORMAL/POSITION vertex count mismatch")
        for i, (x, _y, z) in enumerate(verts):
            wx, wz = (x - mid_x) * WORLD_SCALE, (z - mid_z) * WORLD_SCALE
            dx = (height_at(wx + 0.25, wz, half_x, half_z) -
                  height_at(wx - 0.25, wz, half_x, half_z)) / 0.5
            dz = (height_at(wx, wz + 0.25, half_x, half_z) -
                  height_at(wx, wz - 0.25, half_x, half_z)) / 0.5
            length = math.sqrt(1.0 + dx * dx + dz * dz)
            struct.pack_into("<fff", data, base + i * stride,
                             -dx / length, 1.0 / length, -dz / length)
        normals_updated.add(normal_i)

    # Measure planarity across land, not merely number of polygon vertices.
    grades = []
    heights = []
    for zi in range(-54, 55, 2):
        z = zi / 54.0 * half_z
        for xi in range(-60, 61, 2):
            x = xi / 60.0 * half_x
            h = height_at(x, z, half_x, half_z)
            if h < SEA_HEIGHT_M + 0.05:
                continue
            dx = (height_at(x + 0.30, z, half_x, half_z) -
                  height_at(x - 0.30, z, half_x, half_z)) / 0.60
            dz = (height_at(x, z + 0.30, half_x, half_z) -
                  height_at(x, z - 0.30, half_x, half_z)) / 0.60
            grades.append(math.hypot(dx, dz))
            heights.append(h)
    level_percent = 100 * sum(slope < FLAT_SLOPE_LIMIT for slope in grades) / len(grades)
    peak_height = max(heights)
    if level_percent < 70.0 or peak_height < 19.0 or peak_height > 30.0:
        raise ValueError("V2 blueprint slope/peak failure: %.1f%% flat, %.1fm peak" % (
            level_percent, peak_height))
    g.setdefault("asset", {}).setdefault("extras", {})["LembahAsriTerrainV2"] = {
        "revision": "north-peak-flat-village-west-fields-and-coastal-ocean",
        "flat_grade_lt_0_2_percent": round(level_percent, 1),
        "sample_peak_height_m": round(peak_height, 2),
        "sea_height_m": SEA_HEIGHT_M,
        "source_geometry_and_uv": "preserved XZ and TEXCOORD_0; revised Y and NORMAL",
    }
    print("TERRAIN_V2_SOURCE:", "vertex_accessors", len(positions),
          "source_height_m", round((old_max_y-old_min_y)*WORLD_SCALE, 2),
          "size_m", round(half_x*2, 2), "x", round(half_z*2, 2))
    print("TERRAIN_V2_BLUEPRINT_PASS:", "flat_percent", round(level_percent, 2),
          "peak_m", round(peak_height, 2), "ocean_m", SEA_HEIGHT_M,
          "original_position_count", len(all_points),
          "updated_normals", len(normals_updated))
    return bytes(data)


if __name__ == "__main__":
    # No action on original source; used from optimize_terrain_base.py
    print("Import rebuild_topography() from the existing terrain optimizer.")
