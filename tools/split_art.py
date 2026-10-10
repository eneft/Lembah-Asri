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
# Visual repair v2. Previous run destructively inpainted HOUSE, COOP and
# entire FARM patch masks, which created a huge brown/green smear in the middle.
# Do not destroy the original backdrop just to make foreground cutouts!
#
# For the current vertical slice: remove only the moving hero from the backdrop.
# The static illustrated Bu Sari, painted interaction callout, and stylized HUD
# are retained until their ground can be hand-cleaned; her interaction sprite is
# still a separate game object, registered at precisely the same position.
erase = np.array(player,dtype=np.uint8)
erase = cv2.dilate(erase,np.ones((5,5),np.uint8),iterations=1)
clean = cv2.inpaint(bgr,erase,3,cv2.INPAINT_TELEA)
static_image = Image.fromarray(cv2.cvtColor(clean,cv2.COLOR_BGR2RGB))
for name,polygon in polygons.items():
    # These overlay sprites are fully separate PNGs. At this early stage
    # they remain registered over the intact scenery beneath them.
    save(name,mask(polygon,1.0),static_image)
static_image.save(OUT/"background_base.png",optimize=True)
manifest["background_base"]={"x":0,"y":0,"w":W,"h":H}
(OUT/"layout.json").write_text(json.dumps({
    "reference_size":[W,H],
    "sprites":manifest,
    "limitations":"Scenery slices retain registered painted backing; only hero removal is reconstructed automatically. Manual layer cleanup pending."
},indent=2)+"\n",encoding="utf-8")
print("Generated",len(manifest),"art layers without destructive scenery inpainting")
