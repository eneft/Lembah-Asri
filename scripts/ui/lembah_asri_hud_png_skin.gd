extends RefCounted
## PNG HUD skin: visual-only, preserving gameplay and touch hit boxes.
const ROOT := "res://assets/ui/rpg_hud_v1/"
const FILES := {
 "status": "player_status.png",
 "location": "location_quest.png",
 "weather": "weather_time.png",
 "map": "minimap_frame.png",
 "hotbar": "hotbar.png",
 "hint": "action_hint.png"
}
const CREAM := Color("#f6e5bf")
const INK := Color("#452b14")
var sprites: Dictionary = {}

func _init() -> void:
 for key in FILES:
  var file: String = ROOT + FILES[key]
  if ResourceLoader.exists(file):
   var resource: Resource = load(file)
   if resource is Texture2D:
    sprites[key] = resource

func has_all() -> bool:
 return sprites.size() == FILES.size()

func layout(view: Vector2) -> Dictionary:
 var s: float = clampf(minf(view.x / 1160.0,view.y / 650.0),0.64,1.12)
 var status := Rect2(10*s,8*s,295*s,109*s)
 var quest := Rect2((view.x-375*s)/2.0,8*s,375*s,111*s)
 var weather := Rect2(view.x-267*s,8*s,256*s,64*s)
 var mini := Rect2(view.x-200*s,78*s,186*s,183*s)
 var bar := Rect2((view.x-477*s)/2.0,view.y-105*s,477*s,99*s)
 var slots: Array[Rect2] = []
 for i in range(6):
  slots.append(Rect2(bar.position+Vector2((32+float(i)*74)*s,17*s),Vector2(71*s,64*s)))
 var popup_width: float = minf(view.x-32*s,545*s)
 var popup_height: float = minf(view.y-27*s,384*s)
 var popup: Rect2 = Rect2((view.x-popup_width)*0.5,(view.y-popup_height)*0.5,popup_width,popup_height)
 return {
  "scale":s,"player":status,"objective":quest,"status":weather,
  "clock":Rect2(weather.position,Vector2(weather.size.x*.48,weather.size.y)),
  "weather":Rect2(weather.position+Vector2(weather.size.x*.51,0),Vector2(weather.size.x*.49,weather.size.y)),
  "minimap":mini,"hotbar":bar,"slots":slots,"popup":popup,
  "close":Rect2(popup.end.x-43*s,popup.position.y+11*s,30*s,29*s)
 }

func paint(ui: Control,d: Dictionary,hero: Node2D,phase: String,weather: String,
 day: int, level: int, hp: float, hp_max: float, energy: float, energy_max: float,
 selection: int,context: String,message: String,message_left: float) -> void:
 var places: Dictionary = {"status":"player","location":"objective",
  "weather":"status","map":"minimap","hotbar":"hotbar"}
 for key in places:
  ui.draw_texture_rect(sprites[key],d[places[key]],false)
 var s: float = d["scale"]
 var status: Rect2 = d["player"]
 _word(ui,status.position+Vector2(236*s,45*s),"Lv. "+(str(level) if level>=0 else "—"),12*s,INK)
 _word(ui,status.position+Vector2(243*s,68*s),_numbers(hp,hp_max),10*s,INK)
 _word(ui,status.position+Vector2(243*s,85*s),_numbers(energy,energy_max),10*s,INK)
 var timebox: Rect2 = d["status"]
 _word(ui,timebox.position+Vector2(77*s,29*s),"Hari "+(str(day) if day>0 else "—"),12*s,INK)
 _word(ui,timebox.position+Vector2(77*s,44*s),phase.capitalize(),12*s,INK)
 _word(ui,timebox.position+Vector2(190*s,38*s),weather.capitalize(),11*s,INK)
 if is_instance_valid(hero):
  var map: Rect2 = d["minimap"]
  var world: Vector2 = hero.global_position
  var dot := Vector2(map.position.x + map.size.x*(0.12+clampf(world.x/1672.0,0,1)*.70),
   map.position.y + map.size.y*(0.13+clampf(world.y/941.0,0,1)*.70))
  ui.draw_circle(dot,4.0*s,Color("#fcf0d0"))
  ui.draw_circle(dot,2.4*s,Color("#2955c0"))
 var slots: Array[Rect2] = d["slots"]
 if selection>=0 and selection<slots.size():
  ui.draw_rect(slots[selection].grow(2*s),Color("#ffd57c"),false,2.0*s)
 if context != "":
  if context.to_lower().contains("buka pintu"):
   var hint := Rect2((ui.size.x-260*s)*.5,ui.size.y-142*s,260*s,67*s)
   ui.draw_texture_rect(sprites["hint"],hint,false)
  else:
   var hint := Rect2((ui.size.x-280*s)*.5,ui.size.y-132*s,280*s,29*s)
   ui.draw_rect(hint,Color(0.18,0.13,0.09,.83),true)
   _word(ui,hint.position+Vector2(15*s,20*s),context,12*s,CREAM)
 if message_left>0:
  var toast:=Rect2((ui.size.x-280*s)*.5,ui.size.y-170*s,280*s,27*s)
  ui.draw_rect(toast,Color(.14,.21,.16,.83),true)
  _word(ui,toast.position+Vector2(12*s,18*s),message,12*s,CREAM)

func _numbers(value: float,maximum: float) -> String:
 if value<0 or maximum<=0:
  return "— / —"
 return "%d/%d" % [roundi(value),roundi(maximum)]

func _word(ui: Control,point: Vector2,value: String,pixel_size: float,color: Color) -> void:
 ui.draw_string(ThemeDB.fallback_font,point,value,HORIZONTAL_ALIGNMENT_LEFT,-1,
  maxi(9,roundi(pixel_size)),color)
