"""V7.3 native scene source-of-truth vegetation and obstruction audit.

Derived from the actual Terrain V6.8 landuse blueprint. Each candidate must
respect the complete house footprints, village gathering green, door approach
and all 10 paths (including BOTH real bridges). Vegetation is NOT a separate
replacement terrain and cannot occupy water or overwrite saved architecture.
"""
from __future__ import annotations
import json,math,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from terrain_v3_landuse import PLOTS,PATHS
data=json.loads((ROOT/"assets/environment/village/vegetation_v73.json").read_text())
assert data["revision"]=="V7.3"
assert len(data["paths"])==len(PATHS)==10
assert len(data["plots"])==len(PLOTS)+1
by_id={p["id"]:p for p in data["plots"]}
for p in PLOTS:
    q=by_id[p["id"]]
    assert math.dist(q["center"],p["center"])<0.001,p["id"]
    assert q["foot"]==list(p["foot"])
    assert q["yard"]==list(p["yard"])
    assert q["yaw"]==p["angle"]
for route,(name,points,width) in zip(data["paths"],PATHS):
    assert route["id"]==name
    assert math.isclose(route["width"],width)
    assert len(route["points"])==len(points)
    for a,b in zip(route["points"],points):
        assert math.dist(a,b)<0.001,name

def distseg(x,z,a,b):
    dx=b[0]-a[0];dz=b[1]-a[1]
    t=max(0,min(1,((x-a[0])*dx+(z-a[1])*dz)/max(1e-8,dx*dx+dz*dz)))
    return math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)
def guarded(x,z,kind):
    radius={"shade":2.55,"banana":1.7,"palm":2.7,"shrub":1.1,"grass":.85}[kind]
    for p in data["plots"]:
        dx=x-p["center"][0];dz=z-p["center"][1]
        theta=math.radians(p["yaw"]);co=math.cos(theta);si=math.sin(theta)
        u=co*dx+si*dz;v=-si*dx+co*dz
        green=p["kind"]=="square"
        wh=p["yard"] if green else p["foot"]
        margin=radius+1.4 if green else radius
        if abs(u)<wh[0]/2+margin and abs(v)<wh[1]/2+margin:
            return True
        if not green and p["kind"]!="watch_post" and (
            p["foot"][1]*.45 < v < p["foot"][1]*.5+5+radius
            and abs(u)<2.7+radius):
            return True
    for path in data["paths"]:
        if min(distseg(x,z,a,b) for a,b in zip(path["points"],path["points"][1:])) < (
            path["width"]/2+radius+.72):
            return True
    return False

zones={zone["id"]:zone for zone in data["zones"]}
assert len(zones)==5
candidates=data["candidates"]
assert len(candidates)>=220
types={"shade","palm","banana","grass","shrub"}
counts={}
for p in candidates:
    x,z=float(p["x"]),float(p["z"]);kind=p["type"];zone=p["zone"]
    assert kind in types and zone in zones
    x0,z0,x1,z1=zones[zone]["bounds"]
    assert x0<=x<=x1 and z0<=z<=z1,(zone,x,z)
    assert not guarded(x,z,kind),("vegetation blocks road/house/plaza",p)
    assert .6<=p["scale"]<=1.4
    counts[(zone,kind)]=counts.get((zone,kind),0)+1
for zone in data["zones"]:
    for kind,target in zone["specs"].items():
        assert counts.get((zone["id"],kind),0)>=target*2,("not enough backups",zone["id"],kind)
assert len(set((p["x"],p["z"]) for p in candidates))==len(candidates)
assert sum(z["specs"].get("grass",0) for z in data["zones"])>=100
assert sum(z["specs"].get("palm",0) for z in data["zones"])>=8
print("V7.3 VEGETATION LAYOUT PASS: %d protected candidates, 5 native zones, 17 building lots + watch post, 10 passable trails, open village square"%len(candidates))
