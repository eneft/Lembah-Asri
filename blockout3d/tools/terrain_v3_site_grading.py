"""Terrain V6.1: grade only future building pads, without flattening farmland or paths.

All coordinates and widths use real metres.  The island's source footprint,
river, beach and playable bridge deck remain unchanged.  A gently feathered
apron adapts the surrounding ground to each pad.  The pad itself is level so
houses do not need floating foundations or unrealistic buried corners.
"""
from __future__ import annotations

import math
from terrain_v2_topography import height_at
from terrain_v3_landuse import PLOTS

APRON_METRES = 5.5


def rotated_pad_distance(x: float, z: float, plot: dict) -> float:
    """Unsigned distance beyond the rotated building rectangle (zero inside)."""
    dx = x - plot["center"][0]
    dz = z - plot["center"][1]
    a = math.radians(plot["angle"])
    lx = abs(math.cos(a)*dx + math.sin(a)*dz) - plot["foot"][0]*0.5
    lz = abs(-math.sin(a)*dx + math.cos(a)*dz) - plot["foot"][1]*0.5
    return math.hypot(max(0.0, lx), max(0.0, lz))


def graded_height_at(x: float, z: float, half_x: float, half_z: float) -> float:
    """Physical ground after local building-pad grading, in world metres."""
    base = height_at(x, z, half_x, half_z)
    for plot in PLOTS:
        if plot["kind"] == "square":
            continue  # Keep the village gathering field grassy and natural.
        dist = rotated_pad_distance(x, z, plot)
        if dist >= APRON_METRES:
            continue
        t = max(0.0, min(1.0, dist / APRON_METRES))
        falloff = 1.0 - t*t*(3.0-2.0*t)
        cx, cz = plot["center"]
        target = height_at(cx, cz, half_x, half_z)
        base += (target-base)*falloff
    return base
