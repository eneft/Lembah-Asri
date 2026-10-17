extends RefCounted
## Lembah Asri HUD V2 — cozy farming-RPG layout, adaptive to iPhone landscape.
## Painting only: menu actions and tool state stay inside lembah_asri_rpg_hud.gd.
## Reuses high-quality PNG portrait/tool icon artwork without its baked fake numbers.
const ROOT := "res://assets/ui/rpg_hud_v1/"
const FILES := {"portrait":"player_status.png","icons":"hotbar.png","sun":"weather_time.png"}
const INK := Color("#45321f")
const CREAM := Color("#fcf1d6")
const BROWN := Color("#7f6040")
var pictures: Dictionary = {}
var parchment: StyleBoxFlat
var chip: StyleBoxFlat
var slot: StyleBoxFlat
var selected: StyleBoxFlat

func _init() -> void:
 for key in FILES:
  if ResourceLoader.exists(ROOT+FILES[key]):
   pictures[key] = load(ROOT+FILES[key])
 parchment = _style(Color(.98,.94,.82,.96),Color(.61,.46,.30,.99),12)
 chip = _style(Color(.99,.95,.85,.98),Color(.68,.55,.37,.98),10)
 slot = _style(Color(.96,.91,.79,.96),Color(.58,.48,.31,.93),9)
 selected = _style(Color(.99,.92,.76,1.0),Color(.97,.67,.27,1.0),9)

func _style(color: Color,border: Color,radius: int) -> StyleBoxFlat:
 var shape := StyleBoxFlat.new()
 shape.bg_color = color
 shape.border_color = border
 shape.set_corner_radius_all(radius)
 shape.set_border_width_all(2)
 return shape

func has_all() -> bool:
 return pictures.size()==FILES.size()

func layout(view: Vector2) -> Dictionary:
 var s: float = clampf(minf(view.x/1180.0,view.y/650.0),0.66,1.12)
 var player := Rect2(11*s,10*s,230*s,78*s)
 var weather := Rect2(view.x-257*s,10*s,247*s,67*s)
 var button_start: float = weather.position.x-172*s
 var bar_width: float = 374*s
 var bar := Rect2((view.x-bar_width)*.5,view.y-82*s,bar_width,72*s)
 var slots: Array[Rect2] = []
 for i in range(6):
  slots.append(Rect2(bar.position+Vector2((9+float(i)*59)*s,9*s),Vector2(53*s,54*s)))
 var popup_width: float = minf(view.x-34*s,545*s)
 var popup_height: float = minf(view.y-29*s,384*s)
 var popup: Rect2 = Rect2((view.x-popup_width)*.5,(view.y-popup_height)*.5,
  popup_width,popup_height)
 return {
  "scale":s,"player":player,"status":weather,
  "objective":Rect2((view.x-314*s)*.5,12*s,314*s,45*s),
  "clock":Rect2(weather.position,Vector2(122*s,67*s)),
  "weather":Rect2(weather.position+Vector2(124*s,0),Vector2(123*s,67*s)),
  "minimap":Rect2(button_start,14*s,37*s,37*s),
  "journal_button":Rect2(button_start+43*s,14*s,37*s,37*s),
  "inventory_button":Rect2(button_start+86*s,14*s,37*s,37*s),
  "menu_button":Rect2(button_start+129*s,14*s,37*s,37*s),
  "slots":slots,"hotbar":bar,
  "popup":popup,"close":Rect2(popup.end.x-43*s,popup.position.y+11*s,30*s,29*s)
 }

func paint(ui: Control,d: Dictionary,hero: Node2D,phase: String,weather: String,
 day: int,level: int,hp: float,hp_max: float,energy: float,energy_max: float,
 chosen: int,tools: Array[String],area: String,area_secs: float,
 context: String,message: String,message_left: float) -> void:
 var s: float = d["scale"]
 _player(ui,d["player"],s,level,hp,hp_max,energy,energy_max)
 _weather(ui,d["status"],s,phase,weather,day)
 _button(ui,d["minimap"],3,s)
 _button(ui,d["journal_button"],1,s)
 _button(ui,d["inventory_button"],2,s)
 _button(ui,d["menu_button"],5,s)
 var bar: Rect2 = d["hotbar"]
 ui.draw_style_box(parchment,bar)
 var rects: Array[Rect2] = d["slots"]
 for i in range(rects.size()):
  var item: Rect2 = rects[i]
  ui.draw_style_box(selected if chosen==i else slot,item)
  _text(ui,item.position+Vector2(6*s,12*s),str(i+1),10*s,BROWN)
  if i==0:
   _icon(ui,item.grow(-12*s),0)
  elif tools[i] != "":
   _text(ui,item.position+Vector2(7*s,35*s),tools[i],10*s,INK,item.size.x-11*s)
  else:
   _text(ui,item.position+Vector2(20*s,36*s),"·",23*s,Color("#bbab92"))
 if area_secs>0.0:
  var welcome: Rect2 = d["objective"]
  ui.draw_style_box(chip,welcome)
  _text(ui,welcome.position+Vector2(17*s,29*s),area.capitalize(),16*s,INK,welcome.size.x-30*s)
 if context!="":
  var prompt := Rect2((ui.size.x-245*s)*.5,bar.position.y-42*s,245*s,31*s)
  ui.draw_style_box(chip,prompt)
  _text(ui,prompt.position+Vector2(12*s,21*s),context,13*s,INK,prompt.size.x-18*s)
 if message_left>0:
  var toast := Rect2((ui.size.x-276*s)*.5,bar.position.y-78*s,276*s,29*s)
  ui.draw_style_box(chip,toast)
  _text(ui,toast.position+Vector2(12*s,20*s),message,12*s,INK,toast.size.x-18*s)

func _player(ui: Control,box: Rect2,s: float,level: int,hp: float,
 hp_max: float,energy: float,energy_max: float) -> void:
 ui.draw_style_box(parchment,box)
 var photo: Texture2D = pictures["portrait"]
 var sz: Vector2 = photo.get_size()
 # Portrait is cut from actual illustrated asset, excluding baked Lv.1/HP.
 ui.draw_texture_rect_region(photo,
  Rect2(box.position+Vector2(4*s,2*s),Vector2(74*s,73*s)),
  Rect2(sz*Vector2(.043,.32),sz*Vector2(.31,.355)))
 _text(ui,box.position+Vector2(84*s,22*s),"Pengembara",14*s,INK)
 _text(ui,box.position+Vector2(84*s,39*s),
  "Lv. "+str(level) if level>=0 else "Petualang",11*s,BROWN)
 _bar(ui,Rect2(box.position+Vector2(84*s,48*s),Vector2(132*s,8*s)),
  hp,hp_max,Color("#c97762"))
 _bar(ui,Rect2(box.position+Vector2(84*s,60*s),Vector2(132*s,8*s)),
  energy,energy_max,Color("#8dac70"))

func _bar(ui: Control,rect: Rect2,val: float,maximum: float,fill: Color) -> void:
 ui.draw_rect(rect,Color(.42,.34,.25,.18),true)
 if val>=0 and maximum>0:
  ui.draw_rect(Rect2(rect.position,Vector2(rect.size.x*clampf(val/maximum,0,1),rect.size.y)),fill,true)
 ui.draw_rect(rect,Color(.58,.49,.34,.63),false,1.0)

func _weather(ui: Control,box: Rect2,s: float,phase: String,weather: String,day: int) -> void:
 ui.draw_style_box(parchment,box)
 ui.draw_line(box.position+Vector2(121*s,7*s),box.position+Vector2(121*s,59*s),Color(.66,.56,.37,.50),1*s)
 var art: Texture2D = pictures["sun"]
 var ts: Vector2 = art.get_size()
 ui.draw_texture_rect_region(art,Rect2(box.position+Vector2(9*s,13*s),Vector2(30*s,31*s)),
  Rect2(ts*Vector2(.18,.32),ts*Vector2(.14,.36)))
 _text(ui,box.position+Vector2(43*s,26*s),"Hari "+str(day) if day>0 else "Waktu",12*s,INK)
 _text(ui,box.position+Vector2(43*s,47*s),phase.capitalize(),13*s,INK)
 _text(ui,box.position+Vector2(132*s,21*s),"CUACA",10*s,BROWN)
 _text(ui,box.position+Vector2(132*s,40*s),weather.capitalize(),13*s,INK,110*s)
 _text(ui,box.position+Vector2(132*s,54*s),"Ketuk untuk ubah",9*s,BROWN)

func _button(ui: Control,rect: Rect2,index: int,s: float) -> void:
 ui.draw_style_box(chip,rect)
 _icon(ui,rect.grow(-8*s),index)

func _icon(ui: Control,rect: Rect2,index: int) -> void:
 var tex: Texture2D = pictures["icons"]
 var dims: Vector2 = tex.get_size()
 var centers: Array[float] = [.167,.300,.428,.553,.700,.823]
 var center: float = centers[index]
 var source := Rect2(Vector2(dims.x*(center-.047),dims.y*.29),
  Vector2(dims.x*.094,dims.y*.235))
 ui.draw_texture_rect_region(tex,rect,source)

func _text(ui: Control,point: Vector2,label: String,size: float,color: Color,width: float=-1.0) -> void:
 ui.draw_string(ThemeDB.fallback_font,point,label,HORIZONTAL_ALIGNMENT_LEFT,width,
  maxi(9,roundi(size)),color)
