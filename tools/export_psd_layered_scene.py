from pathlib import Path
from psd_tools import PSDImage
from PIL import Image,ImageChops
import json,hashlib
src=Path("assets/source_psd/Lembah asri tes scene")
out=Path("assets/art/psd_layered_scene")
out.mkdir(parents=True,exist_ok=True)
psd=PSDImage.open(src)
assert psd.size==(1672,941)
rename={
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
"layer-palm-tree":"10_palm"}
manifest={"source":str(src),"sha256":hashlib.sha256(src.read_bytes()).hexdigest(),"canvas":[1672,941],"layers":[]}
for order,layer in enumerate(psd):
 if layer.name not in rename:continue
 bbox=list(map(int,layer.bbox))
 rgba=layer.composite(force=True).convert("RGBA")
 assert rgba.size==(bbox[2]-bbox[0],bbox[3]-bbox[1])
 filename=rename[layer.name]+".png"
 rgba.save(out/filename,optimize=True)
 h=rgba.getchannel("A").histogram()
 info={"name":layer.name,"file":filename,"bbox":bbox,"order":order,"opacity":layer.opacity,"alpha_nonzero":rgba.width*rgba.height-h[0],"alpha_255":h[255],"alpha_0":h[0]}
 manifest["layers"].append(info)
 print("LAYER_EXPORT:",json.dumps(info,ensure_ascii=False),flush=True)
gr=[x for x in psd if x.name=="Collision"][0]
ink=gr[0].composite(force=True).convert("RGBA")
ink.save(out/"collision_preview.png")
from collections import Counter
print("COLLISION_AUDIT:",json.dumps({"bounds":list(gr[0].bbox),"mode":ink.mode,"alpha_extrema":ink.getchannel("A").getextrema(),"popular":[[list(color),amount] for color,amount in Counter(ink.getdata()).most_common(16)]}),flush=True)
marker=[x for x in psd if x.name=="Posisi layer karakter utama disini"][0]
manifest["hero_marker_bbox"]=list(map(int,marker.bbox))
manifest["collision_bbox"]=list(map(int,gr[0].bbox))
(out/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
base=Image.open(out/"00_background.png").convert("RGBA")
result=base.copy()
for record in reversed(manifest["layers"][1:]):
 layer=Image.open(out/record["file"]).convert("RGBA")
 if record["opacity"]<255:
  layer.putalpha(layer.getchannel("A").point(lambda a:round(a*record["opacity"]/255)))
 layer_image=Image.new("RGBA",base.size)
 layer_image.paste(layer,tuple(record["bbox"][:2]))
 result=Image.alpha_composite(result,layer_image)
print("BACKGROUND_VS_LAYERED_DIFF:",ImageChops.difference(base.convert("RGB"),result.convert("RGB")).getbbox(),flush=True)
base.thumbnail((1254,706));base.save(out/"preview_background_only.png")
result.thumbnail((1254,706));result.save(out/"preview_background_plus_layers.png")
print("PSD LAYER EXPORT PASS:",len(manifest["layers"]))
