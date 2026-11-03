"""CI validation of V7.0 placement against the V6.8 terrain blueprint.

Do not turn the gathering green into a 17th house: 16 authored house pads
plus one small watch-post on the edge of the balai-desa compound.
"""
import json, math, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT / "tools"))
from terrain_v3_landuse import PLOTS, PATHS

data=json.loads((ROOT/"assets/environment/village/settlement_v7.json").read_text())
buildings=data["buildings"]
assert len(buildings)==17 and len({p["id"] for p in buildings})==17
assert data["open_space"]=="lapangan_berkumpul"
assert (ROOT/"assets/environment/houses/main_house/rumah_utama.glb").stat().st_size>100000
assert sum(b["asset"]=="rumah_utama.glb" for b in buildings)==16
assert sum(b["kind"]=="watch_post" for b in buildings)==1
open_plot=next(p for p in PLOTS if p["kind"]=="square")
for plot in PLOTS:
    if plot["kind"]=="square":
        assert all(b["id"]!=plot["id"] for b in buildings)
        continue
    matches=[b for b in buildings if b["id"]==plot["id"]]
    assert len(matches)==1,("Missing plot",plot["id"])
    actual=matches[0]
    assert actual["kind"]==plot["kind"]
    assert math.dist(actual["center"],plot["center"])<0.03,(plot["id"],"wrong coordinate")
    assert actual["foot"]==list(plot["foot"])
    assert actual["yaw"]==plot["angle"]

extra=next(b for b in buildings if b["kind"]=="watch_post")
balai=next(p for p in PLOTS if p["id"]=="balai_desa")
cx,cz=extra["center"]
assert abs(cx-(balai["center"][0]-7.0))<0.03
assert abs(cz-balai["center"][1])<0.03
assert abs(cx-balai["center"][0])+extra["foot"][0]/2<balai["yard"][0]/2
assert extra["foot"][0]<3 and extra["foot"][1]<3
assert math.dist(extra["center"],open_plot["center"])>open_plot["yard"][0]/2+10

def line_dist(x,z,a,b):
    dx=b[0]-a[0]; dz=b[1]-a[1]
    t=max(0.0,min(1.0,((x-a[0])*dx+(z-a[1])*dz)/max(1e-8,dx*dx+dz*dz)))
    return math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)

for name,poly,width in PATHS:
    least=min(line_dist(cx,cz,a,b) for a,b in zip(poly,poly[1:]))
    assert least>width/2+extra["foot"][0]/2+1.0,("Watch post blocks road",name,least)

print("V7 LAYOUT PASS: 16 existing house footprints + 1 balai watch post, open lapangan preserved, no road conflicts")
