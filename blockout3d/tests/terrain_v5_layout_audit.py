#!/usr/bin/env python3
"""Terrain V5 regression: village roads must not cross reserved house footprints.

This intentionally checks BUILD-TIME geometry and source alignment without
Pillow/Godot, so it can reject bad layout changes before expensive Web export.
"""
from __future__ import annotations
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from terrain_v3_landuse import PATHS, PLOTS, validate_layout  # noqa: E402
from terrain_v2_topography import river_center_x  # noqa: E402

SAFE_EDGE = 0.18  # paint feather / near-footprint clearance, metres
SAMPLE_STEP = 0.30
assert validate_layout() == (17, 10), "V5 zoning or path set changed unexpectedly"


def footprint_distance(x: float, z: float, plot: dict) -> float:
    dx = x - plot["center"][0]
    dz = z - plot["center"][1]
    angle = math.radians(plot["angle"])
    co, si = math.cos(angle), math.sin(angle)
    a = abs(co * dx + si * dz) - plot["foot"][0] * 0.5
    b = abs(-si * dx + co * dz) - plot["foot"][1] * 0.5
    return math.hypot(max(0.0, a), max(0.0, b)) + min(max(a, b), 0.0)


count = 0
for name, points, width in PATHS:
    assert len(points) >= 2 and 1.4 <= width <= 4.0, name
    for plot in PLOTS:
        if plot["kind"] == "square":
            continue  # gathering green must remain traversable
        least = float("inf")
        for (ax, az), (bx, bz) in zip(points, points[1:]):
            steps = max(1, math.ceil(math.hypot(bx-ax, bz-az) / SAMPLE_STEP))
            for step in range(steps+1):
                t = step / steps
                least = min(least, footprint_distance(
                    ax + (bx-ax)*t, az + (bz-az)*t, plot))
        if least < width * 0.5 + SAFE_EDGE:
            raise AssertionError(
                f"Path {name} intersects {plot['id']} (clearance={least:.2f}m)")
        count += 1

home = next(p for p in PLOTS if p["id"] == "rumah_masa_kecil")
home_route = next(points for name, points, _ in PATHS if name == "jalan_rumah_masa_kecil")
gate_dist = footprint_distance(*home_route[-1], home)
assert 4.0 < gate_dist < 12.0, f"Childhood-house path does not stop at yard entry: {gate_dist:.2f}m"

# Water, terrain carve, and bridges share one centerline. Existing crossings
# must NOT move when routing the upstream source toward the mountain.
old_river = lambda z: -9.0*math.sin((z+99.0)*0.0261)+2.7*math.sin((z+61.0)*0.0722)
for z in (-9.0, 47.0):
    assert abs(river_center_x(z)-old_river(z)) < 1e-8, f"Bridge water alignment shifted at z={z}"

peak_x = 0.49 * 130.0  # landmark mountain blueprint x for 260m-wide island
assert 8.0 <= peak_x-river_center_x(-90.0) <= 22.0, "Headwater is detached from the north-east mountain"

for name, z in (("akses_jembatan_utama", -9.0), ("akses_jembatan_selatan", 47.0)):
    points = next(points for path, points, _ in PATHS if path == name)
    river_x = river_center_x(z)
    assert min(p[0] for p in points) < river_x - 10.0, f"{name}: no west bank route"
    assert max(p[0] for p in points) > river_x + 10.0, f"{name}: no east bank route"
    assert any(abs(x-river_x) < 2.0 and abs(zz-z) < 1.0 for x, zz in points), (
        f"{name}: no waypoint aligned with physical bridge")

# Explicit network joins prevent visually adjacent, but disconnected, paths.
# These critical connections must remain within one metre of each other.
routes = {name: points for name, points, _ in PATHS}
required_joins = (
    ("jalan_rumah_masa_kecil", 0, "akses_sawah_barat", 0),
    ("jalan_kampung_barat", 0, "akses_sawah_barat", 4),
    ("akses_jembatan_barat", 0, "jalan_kampung_barat", -1),
    ("akses_jembatan_barat", -1, "akses_jembatan_utama", 1),
    ("akses_jembatan_utama", -2, "lorong_desa_timur", 0),
    ("akses_jembatan_selatan", 0, "akses_sawah_barat", 5),
    ("akses_jembatan_selatan", -1, "jalan_desa_timur", 6),
    ("akses_nelayan", 0, "jalan_desa_timur", 6),
)
for first, a, second, b in required_joins:
    point_a, point_b = routes[first][a], routes[second][b]
    gap = math.dist(point_a, point_b)
    assert gap <= 1.0, f"Disconnected roads: {first} -> {second} ({gap:.2f}m)"

# 3D trail markers must be physically near the authoritative painted paths.
# Guard against the obsolete pre-expansion 140m scene coordinates returning.
marker_script = (Path(__file__).resolve().parents[1] /
                 "scripts" / "terrain_v3_infrastructure.gd").read_text(encoding="utf-8")
match = re.search(
    r"var locations: Array\[Vector2\] = \[(.*?)\]\s*var objects: Array\[Transform3D\]",
    marker_script, re.S)
assert match, "Roadside markers array missing from V6 infrastructure"
marker_coords = [tuple(map(float, pair)) for pair in
                 re.findall(r"Vector2\((-?[\d.]+),\s*(-?[\d.]+)\)", match.group(1))]
assert len(marker_coords) >= 20, "V6 route landmarks too sparse"


def distance_to_segment(point, a, b):
    dx, dz = b[0]-a[0], b[1]-a[1]
    d2 = dx*dx+dz*dz
    t = max(0.0, min(1.0, ((point[0]-a[0])*dx +
                            (point[1]-a[1])*dz)/max(1e-8,d2)))
    return math.hypot(point[0] - a[0] - t*dx, point[1] - a[1] - t*dz)


for marker in marker_coords:
    distance = min(distance_to_segment(marker, a, b)
                   for points in routes.values() for a, b in zip(points, points[1:]))
    assert distance < 2.8, f"Old or off-road trail marker {marker}: {distance:.2f}m"

print(f"TERRAIN V6 MARKERS PASS: {len(marker_coords)} landmarks aligned with 260m routes")
print(f"TERRAIN V5 LAYOUT PASS: {len(PLOTS)} reserved plots, {len(PATHS)} roads, {count} clear road/plot comparisons; headwater joins mountain, bridges fixed, 8 road junctions connected")
