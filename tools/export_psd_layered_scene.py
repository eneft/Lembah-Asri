#!/usr/bin/env python3
"""Export the ORIGINAL Photoshop pixels and hand-painted collision. No generative edits.
The PSD reader enumerates layers bottom-to-top in this particular file; the
manifest's explicit source order is authoritative. Background stays bottom.
"""
from pathlib import Path
import json, hashlib
import numpy as np
import cv2
from psd_tools import PSDImage

source=Path("assets/source_psd/Lembah asri tes scene")
dest=Path("assets/art/psd_layered_scene")
dest.mkdir(parents=True,exist_ok=True)
original=source.read_bytes()
assert original[:4]==b"8BPS", "Only authentic Photoshop PSD"
psd=PSDImage.open(source)
assert psd.size==(1672,941), f"Unexpected canvas: {psd.size}"
mapping={
 "Background":"00_background",
 "layer-wooden-fence 2":"01_fence_right",
 "layer-stone-wall":"02_stone_wall_left",
 "layer-wooden-fence 3":"03_fence_left",
 "layer-stone-wall 2":"04_stone_wall_bottom",
 "layer-wooden-bridge":"05_bridge",
 "banana-tree":"06_banana",
 "layer-wooden-fence":"07_fence_front",
 "layer-tiled-roof":"08_roof",
 "layer-bush":"09_bush",
 "layer-palm-tree":"10_palm",
 "forground":"11_foreground"
}
manifest={"source":str(source),"source_sha256":hashlib.sha256(original).hexdigest(),
 "canvas":[1672,941],"order":"background-bottom-then-original-photoshop-layer-order",
 "character_marker_bbox":None,"hero_marker_source_order":None,"layers":[]}
for i,layer in enumerate(psd):
 name=str(layer.name)
 if name=="Posisi layer karakter utama disini":
  manifest["character_marker_bbox"]=list(map(int,layer.bbox))
  manifest["hero_marker_source_order"]=i
 if name not in mapping:
  if layer.is_group() or name=="Posisi layer karakter utama disini":
   continue
  raise RuntimeError("Unrecognized PSD layer not exported: %r. Add it to mapping and Godot scene instead of silently ignoring it." % name)
 bounds=list(map(int,layer.bbox))
 rgba=layer.composite(force=True).convert("RGBA")
 assert rgba.size==(bounds[2]-bounds[0],bounds[3]-bounds[1]),name
 target=mapping[name]+".png"
 rgba.save(dest/target,optimize=True)
 info={"name":name,"filename":target,"bbox":bounds,
  "source_order":i,"opacity_already_baked":True,"visible":bool(layer.is_visible())}
 manifest["layers"].append(info)
 print("PSD_EXPORTED_LAYER:",name,bounds,target,flush=True)
assert len(manifest["layers"])==12 and manifest["character_marker_bbox"] and manifest["hero_marker_source_order"] is not None,"Missing scene objects, foreground or marker"
assert manifest["layers"][0]["name"]=="Background", "Background must remain the lowest painted PSD layer"
foreground=[layer for layer in manifest["layers"] if layer["name"]=="forground"]
assert len(foreground)==1 and foreground[0]["source_order"] > manifest["hero_marker_source_order"], "Photoshop 'forground' must be above the character placeholder"
group=[x for x in psd if str(x.name)=="Collision"]
assert len(group)==1 and group[0].is_group() and len(group[0])==1
coll=group[0][0]; bounds=list(map(int,coll.bbox))
rgba=coll.composite(force=True).convert("RGBA")
rgba.save(dest/"collision_authored_reference.png",optimize=True)
mask=np.asarray(rgba.getchannel("A"))
binary=(mask>=24).astype(np.uint8)*255
shapes,_=cv2.findContours(binary,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
polygons=[]
for shape in sorted(shapes,key=cv2.contourArea,reverse=True):
 if cv2.contourArea(shape)<250:continue
 simplify=cv2.approxPolyDP(shape,2.0,True).reshape(-1,2)
 polygons.append([[int(x)+bounds[0],int(y)+bounds[1]] for x,y in simplify])
assert 1 <= len(polygons) <= 128, f"Unexpected authored collision count: {len(polygons)}"
bx=manifest["character_marker_bbox"]
spawn=[int(round((bx[0]+bx[2])/2)),int(bx[3])]
collision={"type":"solid_blocked","source_group":"Collision",
 "canvas":[1672,941],"alpha_threshold":24,"simplify_epsilon_px":2.0,
 "source_group_bbox":bounds,"source_sha256":manifest["source_sha256"],
 "hero_spawn_foot":spawn,"obstacle_count":len(polygons),"polygons":polygons}
(dest/"collision_polygons.json").write_text(json.dumps(collision,ensure_ascii=False,indent=2)+"\n")
(dest/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
print("PSD LAYERED EXPORT PASS:",len(manifest["layers"]),"layers,",len(polygons),"collision bodies, marker",spawn,flush=True)
