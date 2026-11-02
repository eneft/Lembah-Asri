"""Editable Terrain V3 village zoning plan — all coordinates are world X/Z metres.

Concept zoning: western terraced agriculture + isolated childhood home,
central/southern residential village split by the river, open communal green,
and a few eastern/southeastern fishing homes near the coast.

These are FUTURE building plots, not constructed buildings. Adjust plots here
as the architectural blueprint is refined. No physics bodies are added.
Visual site masks are baked into GLB vertex COLOR_0 for low-cost mobile shading.
"""
from __future__ import annotations

import math

# center(X,Z), footprint width/depth (m), garden width/depth (m), rotation degrees.
# Deliberately leave the river (roughly X=-9..9) without building footprints.
PLOTS = [
    # Nostalgic childhood home, well away from compact village clusters.
    {"id":"rumah_masa_kecil", "kind":"home", "center":(-36.0, 25.0), "foot":(10.0, 8.5), "yard":(19.0, 17.0), "angle":-8.0},
    # West bank, low-density houses near fields.
    {"id":"rumah_barat_01", "kind":"home", "center":(-26.0, -9.0), "foot":(9.0, 7.0), "yard":(15.0, 13.0), "angle":8.0},
    {"id":"rumah_barat_02", "kind":"home", "center":(-39.0, -5.0), "foot":(9.0, 7.0), "yard":(15.0, 13.0), "angle":-9.0},
    {"id":"rumah_barat_03", "kind":"home", "center":(-23.0, 11.0), "foot":(9.0, 7.0), "yard":(14.0, 13.0), "angle":-4.0},
    {"id":"gudang_kebun", "kind":"farm", "center":(-47.0, -23.0), "foot":(9.0, 8.0), "yard":(16.0, 15.0), "angle":6.0},
    # East bank village, distinct from the river and gathering ground.
    {"id":"rumah_desa_01", "kind":"home", "center":(16.0, -19.0), "foot":(9.0, 7.5), "yard":(14.0, 13.0), "angle":5.0},
    {"id":"rumah_desa_02", "kind":"home", "center":(31.0, -20.0), "foot":(9.5, 7.5), "yard":(15.0, 13.0), "angle":-6.0},
    {"id":"rumah_desa_03", "kind":"home", "center":(45.0, -17.0), "foot":(9.0, 7.0), "yard":(14.0, 12.0), "angle":5.0},
    {"id":"rumah_desa_04", "kind":"home", "center":(13.0, -2.0), "foot":(9.0, 7.5), "yard":(14.0, 13.0), "angle":-8.0},
    {"id":"rumah_desa_05", "kind":"home", "center":(46.0, 0.0), "foot":(9.0, 7.5), "yard":(14.0, 13.0), "angle":11.0},
    {"id":"rumah_desa_06", "kind":"home", "center":(13.0, 19.0), "foot":(9.0, 7.5), "yard":(14.0, 13.0), "angle":7.0},
    {"id":"rumah_desa_07", "kind":"home", "center":(46.0, 20.0), "foot":(9.0, 7.5), "yard":(14.0, 13.0), "angle":-5.0},
    # Communal square must stay OPEN, not a football pitch nor an occupied plot.
    {"id":"lapangan_berkumpul", "kind":"square", "center":(29.5, 1.5), "foot":(12.0, 10.0), "yard":(18.0, 16.0), "angle":0.0},
    {"id":"balai_desa", "kind":"public", "center":(30.0, 21.0), "foot":(11.0, 9.0), "yard":(17.0, 15.0), "angle":0.0},
    # Coastal fishing settlement: smaller plots, avoid sinking below sea.
    {"id":"rumah_nelayan_01", "kind":"fishing", "center":(19.0, 37.0), "foot":(8.0, 6.5), "yard":(13.0, 11.0), "angle":-6.0},
    {"id":"rumah_nelayan_02", "kind":"fishing", "center":(34.0, 39.0), "foot":(8.0, 6.5), "yard":(13.0, 11.0), "angle":8.0},
    {"id":"warung_pesisir", "kind":"fishing", "center":(48.0, 35.0), "foot":(9.0, 7.0), "yard":(14.0, 12.0), "angle":-7.0},
]

# Intended footpaths. They intentionally do not add geometry or a bridge.
# The river channel is screened out by the guard in surface_weights().
PATHS = [
    ("jalan_desa_timur", [(12,-29),(26,-26),(35,-13),(36,0),(37,14),(34,25),(35,43)], 3.1),
    ("lorong_desa_timur", [(10,-9),(19,-7),(33,-8),(49,-7)], 1.8),
    ("jalan_rumah_timur", [(12,13),(25,13),(43,12)], 1.8),
    ("akses_sawah_barat", [(-49,-25),(-38,-15),(-33,-1),(-32,13),(-36,27)], 2.0),
    ("jalan_kampung_barat", [(-43,10),(-30,8),(-15,9)], 1.8),
    # Actual safe bridge is near z=-5. Connect its banks with west/east roads;
    # old straight-across z=9 route would lead people into the river.
    ("akses_jembatan_barat", [(-17,9),(-13,1),(-11,-5),(3,-5),(12,-7)], 2.3),
    ("akses_nelayan", [(35,25),(37,34),(45,41)], 1.8),
]

# Macro-scale rebuild 2026-11-02. Spread SETTLEMENT POSITIONS, not the
# dimensions of a human, a house or a road. This makes the journey from the
# isolated childhood home through fields, central village and beach longer,
# without creating a miniature house scaled up 1.86x.
BLUEPRINT_SPACING = 260.0 / 140.0
for _plot in PLOTS:
    _plot["center"] = tuple(_v * BLUEPRINT_SPACING for _v in _plot["center"])
PATHS = [(_name, [(_x * BLUEPRINT_SPACING, _z * BLUEPRINT_SPACING)
                   for _x,_z in _points], _width)
         for _name,_points,_width in PATHS]
# Move the childhood homestead from the south-west lowland to a naturally
# elevated west-north-west farm terrace, separated from the village.
for _plot in PLOTS:
    if _plot["id"] == "rumah_masa_kecil":
        _plot["center"] = (-74.0, -56.0)
        _plot["yard"] = (21.0, 19.0)
        break
# Approach path remains aligned to the actual crossing at river x≈-8,z≈-9.
# It meets both dry shores and rejoins the dispersed village pathways.
PATHS.append(("akses_jembatan_utama", [
    (-34.0,-5.0),(-22.0,-10.0),(-15.0,-9.0),(-8.0,-9.0),
    (-1.0,-9.0),(12.0,-12.0),(28.0,-14.0)], 2.65))
# Two independent crossings and a road up to the nostalgic childhood house.
# All paths remain physical-world metres; village spacing is already applied.
PATHS += [
    ("jalan_rumah_masa_kecil", [
        (-96.0,-34.0),(-87.0,-43.0),(-75.0,-56.0),(-69.0,-64.0)], 2.25),
    ("akses_jembatan_selatan", [
        (-52.0,21.0),(-40.0,33.0),(-22.0,44.0),(-3.0,47.0),
        (9.0,47.0),(22.0,48.0),(40.0,58.0),(61.0,71.0)], 2.7),
]
# Wider public green is a gathering plaza, NOT a football field.
for _plot in PLOTS:
    if _plot["kind"] == "square":
        _plot["yard"] = (31.0, 26.0)
        break


def _smooth(a: float, b: float, x: float) -> float:
    t = max(0.0, min(1.0, (x-a)/max(0.00001,b-a)))
    return t*t*(3.0-2.0*t)

def _rectangle(x: float, z: float, plot: dict, half: tuple[float,float], feather: float) -> float:
    dx, dz = x-plot["center"][0], z-plot["center"][1]
    angle = math.radians(plot["angle"])
    co, si = math.cos(angle), math.sin(angle)
    u, v = abs(co*dx+si*dz), abs(-si*dx+co*dz)
    # Rounded, softly feathered ground transitions instead of colored tile
    # rectangles. Footprints remain true rectangles for future building fit;
    # only the visible soil/grass transition is gently irregular.
    x_edge, z_edge = u-half[0], v-half[1]
    signed_dist = (math.hypot(max(0.0,x_edge),max(0.0,z_edge))
                   + min(max(x_edge,z_edge),0.0))
    wobble = 0.26 * math.sin(x*0.47+z*0.28) * math.sin(z*0.61-x*0.17)
    return 1.0 - _smooth(-0.38*feather, 0.72*feather, signed_dist+wobble)

def _segment_distance(x: float,z:float,a:tuple,b:tuple) -> float:
    ux,uz = b[0]-a[0],b[1]-a[1]
    t = max(0.0,min(1.0,((x-a[0])*ux+(z-a[1])*uz)/max(1e-8,ux*ux+uz*uz)))
    return math.hypot(x-a[0]-ux*t,z-a[1]-uz*t)

def surface_weights(x:float,z:float,height:float,normal_y:float,coast_m:float,
                    river_x:float) -> tuple[float,float,float]:
    """RGB = prepared earth, trimmed-grass yard, earthen path.

    Final safety clip is shared by ALL zones: no marking steep hills, beaches,
    shoreline, river banks or water. Keep home/yard area deliberately quiet.
    """
    shore_safe = _smooth(3.0, 8.0, coast_m)
    dry_safe = _smooth(1.65, 2.55, height)
    slope_safe = _smooth(0.83, 0.96, normal_y)
    river_safe = _smooth(3.9, 7.2, abs(x-river_x))
    safe = shore_safe*dry_safe*slope_safe*river_safe
    if safe < 0.003:
        return (0.0,0.0,0.0)

    lot = lawn = path = 0.0
    for plot in PLOTS:
        garden = _rectangle(x,z,plot,(plot["yard"][0]*.5,plot["yard"][1]*.5),2.6)
        lawn = max(lawn,garden)
        if plot["kind"] != "square":
            footprint = _rectangle(x,z,plot,(plot["foot"][0]*.5,plot["foot"][1]*.5),1.8)
            lot = max(lot,footprint)
        else:
            # Communal gathering grass remains open, slightly worn in center.
            lawn = max(lawn,garden)
    for _,polyline,width in PATHS:
        dist = min(_segment_distance(x,z,polyline[i],polyline[i+1]) for i in range(len(polyline)-1))
        path = max(path,1.0-_smooth(width*.40, width*.65+1.35,dist))
    return (min(1.0,lot*safe),min(1.0,lawn*safe),min(1.0,path*safe))

def validate_layout():
    names=[p["id"] for p in PLOTS]
    assert len(set(names)) == len(names), "Duplicate plot IDs"
    assert len(PLOTS) <= 32
    assert any(p["kind"]=="square" for p in PLOTS)
    for p in PLOTS:
        assert p["foot"][0] <= p["yard"][0] and p["foot"][1] <= p["yard"][1]
        assert max(p["yard"]) < (35 if p["kind"]=="square" else 25)
    return len(PLOTS),len(PATHS)
