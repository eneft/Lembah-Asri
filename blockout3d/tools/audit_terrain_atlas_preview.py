#!/usr/bin/env python3
"""Preview embedded user-authored terrain atlas without modifying it."""
import base64
import io
import json
from pathlib import Path
import struct
from PIL import Image
p=Path("/tmp/lembah-terrain-source-original.glb")
data=p.read_bytes()
sz,tag=struct.unpack_from("<I4s",data,12)
assert tag==b"JSON"
j=json.loads(data[20:20+sz].decode("utf-8").rstrip())
off=20+sz
bsize,btag=struct.unpack_from("<I4s",data,off)
assert btag==bytes([66,73,78,0])
start=off+8
for i,im in enumerate(j.get("images",[])):
 v=j["bufferViews"][im["bufferView"]]
 payload=data[start+v.get("byteOffset",0):start+v.get("byteOffset",0)+v["byteLength"]]
 with Image.open(io.BytesIO(payload)) as tex:
  print("AUDIT_ATLAS",i,"resolution",tex.size,"mode",tex.mode,"bytes",len(payload))
  if i==0:
   tex=tex.convert("RGB")
   tex.thumbnail((640,640),Image.Resampling.LANCZOS)
   b=io.BytesIO()
   tex.save(b,format="JPEG",quality=79,optimize=True)
   print("AUDIT_ATLAS_PREVIEW_B64_START")
   print(base64.b64encode(b.getvalue()).decode("ascii"))
   print("AUDIT_ATLAS_PREVIEW_B64_END")
