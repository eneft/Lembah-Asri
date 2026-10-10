"""Deterministic art extraction from the user's approved, flattened concept.
Prototype masks/inpainting; refine sprites by hand in later stages.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT=Path(__file__).resolve().parent.parent
SRC=ROOT/"assets/art/concept_farm.png"
OUT=ROOT/"assets/art/layers"
OUT.mkdir(parents=True,exist_ok=True)
image=Image.open(SRC).convert("RGB")
W,H=image.size
assert (W,H)==(1672,941),f"Unexpected concept image size {(W,H)}"
bgr=cv2.cvtColor(np.asarray(image),cv2.COLOR_RGB2BGR)
polygons={
"house":[(0,82),(85,77),(132,61),(237,39),(406,54),(515,108),(609,154),(628,318),(584,404),(550,448),(475,476),(193,475),(79,448),(0,387)],
"coop":[(673,318),(749,286),(903,278),(1021,334),(1050,451),(977,494),(866,502),(725,491),(670,427)],
"garden_tomato":[(105,551),(255,521),(572,528),(653,578),(663,687),(650,782),(412,811),(160,758),(95,654)],
"garden_eggplant":[(730,535),(862,513),(1068,525),(1182,579),(1210,704),(1090,799),(791,778),(691,683)],
"garden_greens":[(220,730),(375,675),(731,679),(862,751),(1007,885),(878,940),(240,940),(136,839)],
"foliage_front":[(0,606),(55,590),(130,599),(210,655),(260,781),(299,940),(0,940)]
}
def mask(points,blur):
    layer=Image.new("L",(W,H),0)
    ImageDraw.Draw(layer).polygon(points,fill=255)
    return layer.filter(ImageFilter.GaussianBlur(blur))
manifest={}
def save(name,alpha,source):
    bounds=alpha.getbbox()
    sprite=source.convert("RGBA")
    sprite.putalpha(alpha)
    sprite.crop(bounds).save(OUT/(name+".png"),optimize=True)
    manifest[name]={"x":bounds[0],"y":bounds[1],"w":bounds[2]-bounds[0],"h":bounds[3]-bounds[1]}
player=mask([(697,440),(709,444),(719,449),(729,451),(735,463),(740,475),(734,488),(726,500),(735,513),(738,532),(728,548),(721,553),(724,573),(739,588),(742,604),(730,609),(713,605),(703,603),(698,611),(677,610),(676,596),(682,580),(680,554),(671,554),(658,542),(657,516),(669,501),(674,482),(676,462),(685,449)],0.75)
npc=mask([(782,459),(801,449),(821,460),(837,471),(846,484),(837,493),(830,507),(829,536),(841,551),(842,590),(784,593),(777,575),(778,547),(764,546),(757,526),(768,507),(772,486),(767,477)],0.75)
save("player_idle",player,image)
save("npc_bu_sari",npc,image)
# Remove flatly-painted actors, speech bubble, and baked HUD before extracting scenery.
erase=np.maximum(np.array(player,dtype=np.uint8),np.array(npc,dtype=np.uint8))
cv2.ellipse(erase,(780,433),(49,44),0,0,360,255,-1)
cv2.rectangle(erase,(708,567),(881,655),255,-1)
cv2.rectangle(erase,(0,0),(368,100),255,-1)
cv2.rectangle(erase,(1300,0),(W,154),255,-1)
cv2.rectangle(erase,(0,811),(658,H),255,-1)
erase=cv2.dilate(erase,np.ones((7,7),np.uint8),iterations=1)
clean=cv2.inpaint(bgr,erase,7,cv2.INPAINT_TELEA)
static_image=Image.fromarray(cv2.cvtColor(clean,cv2.COLOR_BGR2RGB))
for name,polygon in polygons.items():
    alpha=mask(polygon,2)
    save(name,alpha,static_image)
    opaque=cv2.threshold(np.array(alpha,dtype=np.uint8),170,255,cv2.THRESH_BINARY)[1]
    clean=cv2.inpaint(clean,opaque,4,cv2.INPAINT_TELEA)
Image.fromarray(cv2.cvtColor(clean,cv2.COLOR_BGR2RGB)).save(OUT/"background_base.png",optimize=True)
manifest["background_base"]={"x":0,"y":0,"w":W,"h":H}
(OUT/"layout.json").write_text(json.dumps({"reference_size":[W,H],"sprites":manifest},indent=2)+"\n",encoding="utf-8")
print("Generated",len(manifest),"prototype 2D sprite layers")
