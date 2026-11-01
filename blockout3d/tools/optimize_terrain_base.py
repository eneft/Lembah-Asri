#!/usr/bin/env python3
"""Build an optimized web GLB from user-supplied terrain base.glb.
No mesh editing: copies all GLB views, resizes embedded images and sets terrain non-metallic.
"""
from pathlib import Path
import io
import json
import struct
from PIL import Image

# Single baked painterly albedo; no procedural shader at runtime.
from retexture_terrain import bake_painterly_albedo

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/environment/island/terrain base.glb"
DST = ROOT / "assets/environment/island/terrain_base_web.glb"
assert SRC.exists(), "Uploaded terrain base.glb missing"
raw = SRC.read_bytes()
magic, version, total = struct.unpack_from("<4sII",raw,0)
assert magic == b"glTF" and version == 2 and total == len(raw)
p=12
chunks=[]
while p<len(raw):
    length, kind=struct.unpack_from("<I4s",raw,p)
    p+=8
    chunks.append((kind,raw[p:p+length]))
    p+=length
assert chunks[0][0]==b"JSON" and chunks[1][0]==b"BIN\x00"
g=json.loads(chunks[0][1].decode("utf-8").rstrip(" \x00"))
binary=chunks[1][1]
views=g["bufferViews"]
# Original photogrammetry has 8K albedo and 4K normal/metallic.
# Repaint its ALBEDO at 4K, and detach unused normal/metallic maps. This
# avoids ~64MiB GPU per unused 4K normal and 4+ shader samples per fragment.
# The authored terrain geometry, UV seams and camera/player are untouched.
image_settings=[(4096,93),(4,65),(4,65)]
replacement={}
for n,img in enumerate(g.get("images",[])):
    if "bufferView" not in img:
        continue
    idx=img["bufferView"]
    view=views[idx]
    start=view.get("byteOffset",0)
    chunk=binary[start:start+view["byteLength"]]
    im=Image.open(io.BytesIO(chunk))
    dim,quality=image_settings[min(n,len(image_settings)-1)]
    im=im.convert("RGB")
    if max(im.size)>dim:
        im.thumbnail((dim,dim),Image.Resampling.LANCZOS)
    if n==0:
        im = bake_painterly_albedo(im, 4096)
    out=io.BytesIO()
    im.save(out,format="JPEG",quality=quality,optimize=True,subsampling=0)
    replacement[idx]=out.getvalue()
    print("WEB_TERRAIN_TEXTURE",n,im.size,"was",len(chunk),"now",len(replacement[idx]))
    if n == 0:
        assert im.size == (4096,4096), "Retextured terrain albedo must remain 4K"
# Pack every existing view (including all geometry buffers) preserving its accessor indices.
target=bytearray()
for idx,v in enumerate(views):
    align=(4-len(target)%4)%4
    target.extend(b"\x00"*align)
    old=binary[v.get("byteOffset",0):v.get("byteOffset",0)+v["byteLength"]]
    blob=replacement.get(idx,old)
    v["byteOffset"]=len(target)
    v["byteLength"]=len(blob)
    target.extend(blob)
g["buffers"][0]["byteLength"]=len(target)
for mat in g.get("materials",[]):
    pbr=mat.setdefault("pbrMetallicRoughness",{})
    pbr["metallicFactor"]=0.0
    pbr["roughnessFactor"]=0.96
    pbr.pop("metallicRoughnessTexture",None)
    mat.pop("normalTexture",None) # no unused 4K tangent-space normal texture
g.setdefault("asset",{})["generator"]="Lembah Asri baked painterly retexture (source geometry UV preserved)"
j=json.dumps(g,separators=(",",":"),ensure_ascii=False).encode("utf-8")
j+=b" " *((4-len(j)%4)%4)
target.extend(b"\x00"*((4-len(target)%4)%4))
total=12+8+len(j)+8+len(target)
with DST.open("wb") as f:
    f.write(struct.pack("<4sII",b"glTF",2,total))
    f.write(struct.pack("<I4s",len(j),b"JSON"))
    f.write(j)
    f.write(struct.pack("<I4s",len(target),b"BIN\x00"))
    f.write(target)
print("WEB_TERRAIN_RETEXTURED_PASS: unique hand-painted 4096px atlas, 1 diffuse texture sampler, no 4K normal, geometry/UV unchanged")
print("WEB_TERRAIN_OPTIMIZED",SRC.stat().st_size,DST.stat().st_size,"bytes",round(DST.stat().st_size/SRC.stat().st_size*100,1),"pct")
assert DST.stat().st_size<SRC.stat().st_size
