extends Control
## Lembah Asri RPG HUD V1 — illustrated UI, not baked into the PSD.
## Interactive: journal, bag, atlas map, menu, six-slot hotbar and time/weather.
## HP, stamina, level and calendar remain unassigned until real systems exist.
signal weather_delta(step: int)
signal lighting_delta(step: int)
signal modal_changed(is_open: bool)

const WORLD_SIZE := Vector2(1672.0, 941.0)
const WORLD_MAP: Texture2D = preload("res://assets/art/psd_layered_scene/00_background.png")
const HERO_FACE: Texture2D = preload("res://assets/characters/player_base_8dir/down.png")
const LABELS := ["Tangan", "Jurnal", "Tas", "Peta", "Kosong", "Menu"]
const NUM_SLOTS := 6
const INK := Color("#2d3027")
const CREAM := Color("#f5e8c9")
const GOLD := Color("#d5b277")
const MUTED := Color("#b8c6b3")
const GREEN := Color("#4d674f")

var hero: Node2D
var phase_label: String = "SIANG"
var weather_label: String = "CERAH"
var area_label: String = "RUMAH MASA KECIL"
var objective_label: String = "Jelajahi rumah masa kecilmu"
var contextual_label: String = ""
var level: int = -1
var health: float = -1.0
var max_health: float = -1.0
var energy: float = -1.0
var max_energy: float = -1.0
var day_number: int = -1
var selected_slot: int = 0
var open_panel: String = ""
var inventory_items: Array[String] = []
var journal_entries: Array[String] = []
var message_text: String = ""
var message_left: float = 0.0
var _skins: Dictionary = {}
var _last_pointer_frame: int = -100

func _ready() -> void:
 set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 mouse_filter = Control.MOUSE_FILTER_IGNORE
 process_mode = Node.PROCESS_MODE_ALWAYS
 _skins["panel"] = _skin(Color(0.15,0.22,0.17,0.89), Color(0.73,0.64,0.43,0.90), 12)
 _skins["soft"] = _skin(Color(0.18,0.28,0.20,0.84), Color(0.61,0.67,0.49,0.72), 11)
 _skins["slot"] = _skin(Color(0.18,0.24,0.18,0.93), Color(0.63,0.65,0.50,0.86), 8)
 _skins["selected"] = _skin(Color(0.37,0.34,0.23,0.97), Color(0.96,0.80,0.48,1.0), 8)
 _skins["modal"] = _skin(Color(0.93,0.89,0.77,0.99), Color(0.50,0.42,0.27,1.0), 15)
 _skins["tab"] = _skin(Color(0.81,0.77,0.64,0.98), Color(0.58,0.52,0.36,0.70), 7)
 resized.connect(queue_redraw)

func _skin(bg: Color, edge: Color, radius: int) -> StyleBoxFlat:
 var style := StyleBoxFlat.new()
 style.bg_color = bg
 style.border_color = edge
 style.set_corner_radius_all(radius)
 style.set_border_width_all(2)
 return style

func bind_player(actor: Node2D) -> void:
 hero = actor
 queue_redraw()

func set_weather(text: String) -> void:
 weather_label = text
 queue_redraw()

func set_phase(text: String) -> void:
 phase_label = text
 queue_redraw()

func set_area(text: String) -> void:
 area_label = text
 queue_redraw()

func set_objective(text: String) -> void:
 objective_label = text
 queue_redraw()

func set_context(text: String) -> void:
 if contextual_label != text:
  contextual_label = text
  queue_redraw()

func set_stats(new_level: int, hp: float, hp_limit: float, sp: float, sp_limit: float) -> void:
 level = new_level
 health = hp
 max_health = hp_limit
 energy = sp
 max_energy = sp_limit
 queue_redraw()

func set_day(day: int) -> void:
 day_number = day
 queue_redraw()

func set_inventory(items: Array[String]) -> void:
 inventory_items = items.duplicate()
 queue_redraw()

func set_journal(entries: Array[String]) -> void:
 journal_entries = entries.duplicate()
 queue_redraw()

func is_modal_open() -> bool:
 return open_panel != ""

func _scale() -> float:
 return clampf(minf(size.x / 1180.0, size.y / 650.0), 0.69, 1.16)

func _layout() -> Dictionary:
 var s: float = _scale()
 var card_width: float = 287.0 * s
 var top_right: Rect2 = Rect2(size.x-299*s,13*s,285*s,85*s)
 var map_card: Rect2 = Rect2(size.x-234*s,115*s,220*s,133*s)
 var slot: float = 56*s
 var gap: float = 6*s
 var bar_width: float = NUM_SLOTS*slot + (NUM_SLOTS-1)*gap
 var slots: Array[Rect2] = []
 for i in range(NUM_SLOTS):
  slots.append(Rect2((size.x-bar_width)*0.5 + float(i)*(slot+gap),
   size.y-71*s,slot,slot))
 var popup_width: float = minf(size.x-34*s,545*s)
 var popup_height: float = minf(size.y-32*s,384*s)
 var popup: Rect2 = Rect2((size.x-popup_width)*0.5,
  (size.y-popup_height)*0.5,popup_width,popup_height)
 return {
  "scale":s,
  "player":Rect2(14*s,14*s,card_width,106*s),
  "objective":Rect2((size.x-325*s)*0.5,18*s,325*s,75*s),
  "status":top_right,
  "clock":Rect2(top_right.position,Vector2(top_right.size.x*0.49,top_right.size.y)),
  "weather":Rect2(top_right.position+Vector2(top_right.size.x*0.51,0),Vector2(top_right.size.x*0.49,top_right.size.y)),
  "minimap":map_card,
  "slots":slots,
  "popup":popup,
  "close":Rect2(popup.end.x-43*s,popup.position.y+11*s,30*s,29*s)
 }

func _font() -> Font:
 return ThemeDB.fallback_font

func _text(p: Vector2, value: String, pt: int, ink: Color, width: float = -1.0) -> void:
 draw_string(_font(),p,value,HORIZONTAL_ALIGNMENT_LEFT,width,pt,ink)

func _centered(rect: Rect2, text: String, pt: int, col: Color, rise: float = 0.0) -> void:
 draw_string(_font(),Vector2(rect.get_center().x,rect.get_center().y+pt*0.30+rise),
  text,HORIZONTAL_ALIGNMENT_CENTER,-1,pt,col)

func _bar(box: Rect2, value: float, maximum: float, fill: Color) -> void:
 draw_rect(box,Color(0.10,0.16,0.12,0.93),true)
 if value >= 0 and maximum > 0:
  draw_rect(Rect2(box.position,Vector2(box.size.x*clampf(value/maximum,0,1),box.size.y)),
   fill,true)
 draw_rect(box,Color(0.70,0.64,0.48,0.66),false,1)

func _process(delta: float) -> void:
 if message_left > 0.0:
  message_left = maxf(0.0,message_left-delta)
 # The minimap marker tracks the existing real CharacterBody2D.
 queue_redraw()

func _draw() -> void:
 if size.x < 380 or size.y < 260:
  return
 var d: Dictionary = _layout()
 var s: float = d["scale"]
 _draw_player(d["player"],s)
 _draw_objective(d["objective"],s)
 _draw_status(d["status"],s)
 _draw_minimap(d["minimap"],s)
 _draw_hotbar(d["slots"],s)
 if contextual_label != "" and open_panel == "":
  var hint: Rect2 = Rect2((size.x-330*s)*0.5,size.y-119*s,330*s,27*s)
  draw_style_box(_skins["soft"],hint)
  _centered(hint,contextual_label,maxi(11,roundi(14*s)),CREAM)
 if message_left > 0.0 and open_panel == "":
  var toast: Rect2 = Rect2((size.x-345*s)*0.5,size.y-150*s,345*s,27*s)
  draw_style_box(_skins["soft"],toast)
  _centered(toast,message_text,maxi(11,roundi(13*s)),CREAM)
 if is_modal_open():
  _draw_modal(d,s)

func _draw_player(box: Rect2,s: float) -> void:
 draw_style_box(_skins["panel"],box)
 var icon_origin: Vector2 = box.position+Vector2(45*s,48*s)
 draw_circle(icon_origin,33*s,Color("#d9c69c"))
 draw_arc(icon_origin,33*s,0,TAU,44,Color("#765938"),2.5*s,true)
 if HERO_FACE != null:
  var src: Rect2 = Rect2(Vector2(330,65),Vector2(500,610))
  var dims: Vector2 = HERO_FACE.get_size()
  if src.end.x <= dims.x and src.end.y <= dims.y:
   draw_texture_rect_region(HERO_FACE,
    Rect2(box.position+Vector2(28*s,18*s),Vector2(35*s,63*s)),src)
 _text(box.position+Vector2(87*s,30*s),"PENGEMBARA",maxi(12,roundi(15*s)),CREAM)
 _text(box.position+Vector2(225*s,30*s),
  "Lv."+str(level) if level >= 0 else "Lv. —",maxi(10,roundi(12*s)),GOLD,55*s)
 _text(box.position+Vector2(89*s,51*s),"HP",maxi(10,roundi(12*s)),CREAM)
 _bar(Rect2(box.position+Vector2(122*s,41*s),Vector2(141*s,10*s)),health,max_health,Color("#c46b61"))
 _text(box.position+Vector2(89*s,71*s),"EN",maxi(10,roundi(12*s)),CREAM)
 _bar(Rect2(box.position+Vector2(122*s,61*s),Vector2(141*s,10*s)),energy,max_energy,Color("#9fbb6b"))
 _text(box.position+Vector2(22*s,95*s),"Statistik belum aktif" if health < 0 else "Status karakter",
  maxi(9,roundi(11*s)),MUTED,240*s)

func _draw_objective(box: Rect2,s: float) -> void:
 draw_style_box(_skins["soft"],box)
 _text(box.position+Vector2(14*s,23*s),"LEMB AH ASRI".replace(" ",""),maxi(12,roundi(15*s)),GOLD)
 _text(box.position+Vector2(14*s,42*s),area_label,maxi(10,roundi(12*s)),CREAM,300*s)
 _text(box.position+Vector2(14*s,61*s),objective_label,maxi(9,roundi(12*s)),MUTED,300*s)

func _draw_status(box: Rect2,s: float) -> void:
 draw_style_box(_skins["panel"],box)
 var day_text: String = "HARI "+str(day_number) if day_number > 0 else "HARI —"
 _text(box.position+Vector2(12*s,23*s),day_text,maxi(11,roundi(12*s)),GOLD,133*s)
 _text(box.position+Vector2(12*s,50*s),phase_label,maxi(11,roundi(14*s)),CREAM,127*s)
 _text(box.position+Vector2(12*s,73*s),"‹   WAKTU   ›",maxi(10,roundi(11*s)),MUTED)
 draw_line(box.position+Vector2(143*s,9*s),box.position+Vector2(143*s,76*s),
  Color(0.77,0.70,0.51,0.48),1*s)
 _text(box.position+Vector2(156*s,28*s),"CUACA",maxi(11,roundi(12*s)),GOLD)
 _text(box.position+Vector2(156*s,51*s),weather_label,maxi(10,roundi(13*s)),CREAM,117*s)
 _text(box.position+Vector2(156*s,73*s),"‹    UBAH   ›",maxi(10,roundi(11*s)),MUTED)

func _draw_minimap(box: Rect2,s: float) -> void:
 draw_style_box(_skins["panel"],box)
 _text(box.position+Vector2(9*s,17*s),"PETA HALAMAN",maxi(10,roundi(11*s)),GOLD)
 var view: Rect2 = Rect2(box.position+Vector2(8*s,23*s),box.size-Vector2(16*s,32*s))
 draw_rect(view,Color("#627d59"),true)
 draw_texture_rect_region(WORLD_MAP,view,Rect2(Vector2.ZERO,WORLD_SIZE),Color(1,1,1,0.88))
 if is_instance_valid(hero):
  var p: Vector2 = hero.global_position
  var marker: Vector2 = view.position+Vector2(clampf(p.x/WORLD_SIZE.x,0,1)*view.size.x,
   clampf(p.y/WORLD_SIZE.y,0,1)*view.size.y)
  draw_circle(marker,6*s,Color("#f5e8c9"))
  draw_circle(marker,3.4*s,Color("#4064b9"))
 draw_rect(view,GOLD,false,1*s)

func _draw_hotbar(slot_rects: Array[Rect2],s: float) -> void:
 for i in range(slot_rects.size()):
  var rect: Rect2 = slot_rects[i]
  draw_style_box(_skins["selected"] if i == selected_slot else _skins["slot"],rect)
  _text(rect.position+Vector2(6*s,14*s),str(i+1),maxi(10,roundi(11*s)),GOLD)
  var symbol: String = ["✋","✎","▣","◇","·","≡"][i]
  _centered(Rect2(rect.position+Vector2(0,6*s),rect.size-Vector2(0,12*s)),
   symbol,maxi(15,roundi(24*s)),CREAM)
  _centered(Rect2(rect.position+Vector2(0,32*s),Vector2(rect.size.x,20*s)),
   LABELS[i],maxi(8,roundi(10*s)),MUTED)

func _draw_modal(d: Dictionary,s: float) -> void:
 draw_rect(Rect2(Vector2.ZERO,size),Color(0.06,0.11,0.08,0.80),true)
 var pop: Rect2 = d["popup"]
 draw_style_box(_skins["modal"],pop)
 _text(pop.position+Vector2(20*s,31*s),"LEMB AH ASRI".replace(" ",""),
  maxi(18,roundi(23*s)),INK,pop.size.x-85*s)
 var close: Rect2 = d["close"]
 draw_style_box(_skins["tab"],close)
 _centered(close,"×",maxi(17,roundi(21*s)),INK)
 var tab_names: Array[String] = ["Inventori","Jurnal","Peta","Menu"]
 var tab_width: float = (pop.size.x-34*s)/4.0
 for i in range(4):
  var tab: Rect2 = Rect2(pop.position+Vector2(17*s+tab_width*i,48*s),
   Vector2(tab_width-4*s,36*s))
  draw_style_box(_skins["selected"] if open_panel==tab_names[i] else _skins["tab"],tab)
  _centered(tab,tab_names[i],maxi(9,roundi(12*s)),CREAM if open_panel==tab_names[i] else INK)
 var interior: Rect2 = Rect2(pop.position+Vector2(23*s,98*s),pop.size-Vector2(46*s,113*s))
 if open_panel == "Peta":
  var map_rect: Rect2 = Rect2(interior.position,Vector2(interior.size.x,minf(interior.size.y-22*s,210*s)))
  draw_texture_rect_region(WORLD_MAP,map_rect,Rect2(Vector2.ZERO,WORLD_SIZE))
  if is_instance_valid(hero):
   var mark: Vector2 = map_rect.position+Vector2(
    clampf(hero.global_position.x/WORLD_SIZE.x,0,1)*map_rect.size.x,
    clampf(hero.global_position.y/WORLD_SIZE.y,0,1)*map_rect.size.y)
   draw_circle(mark,7*s,Color.WHITE)
   draw_circle(mark,4*s,Color("#365baf"))
  draw_rect(map_rect,Color("#79623b"),false,2*s)
  _text(interior.position+Vector2(0,interior.size.y-1*s),"Lokasi: Rumah Masa Kecil",
   maxi(10,roundi(12*s)),INK,interior.size.x)
 elif open_panel == "Inventori":
  _text(interior.position+Vector2(0,24*s),"TAS PENGEMBARA",maxi(14,roundi(18*s)),INK)
  if inventory_items.is_empty():
   _text(interior.position+Vector2(0,55*s),"Tas masih kosong.",maxi(12,roundi(16*s)),INK)
   _text(interior.position+Vector2(0,79*s),"Barang akan muncul setelah diperoleh dalam game.",
    maxi(10,roundi(12*s)),INK,interior.size.x)
  else:
   for i in range(mini(inventory_items.size(),6)):
    _text(interior.position+Vector2(0,(59+27*i)*s),
     "• "+inventory_items[i],maxi(11,roundi(15*s)),INK,interior.size.x)
 elif open_panel == "Jurnal":
  _text(interior.position+Vector2(0,25*s),"JURNAL KENANGAN",maxi(14,roundi(18*s)),INK)
  _text(interior.position+Vector2(0,57*s),"Aku kembali ke desa tempatku tumbuh dahulu.",
   maxi(11,roundi(15*s)),INK,interior.size.x)
  _text(interior.position+Vector2(0,86*s),"Rumah tua ini masih menyimpan begitu banyak cerita.",
   maxi(10,roundi(13*s)),INK,interior.size.x)
  for i in range(mini(journal_entries.size(),4)):
   _text(interior.position+Vector2(0,(119+i*25)*s),"• "+journal_entries[i],
    maxi(10,roundi(13*s)),INK,interior.size.x)
 else:
  _text(interior.position+Vector2(0,25*s),"MENU PERMAINAN",maxi(14,roundi(18*s)),INK)
  _text(interior.position+Vector2(0,60*s),"Gerak: WASD / Panah atau joystick",maxi(11,roundi(14*s)),INK,interior.size.x)
  _text(interior.position+Vector2(0,85*s),"Lari: Shift / LARI    Interaksi: E, F / AKSI",
   maxi(10,roundi(13*s)),INK,interior.size.x)
  _text(interior.position+Vector2(0,110*s),"Jurnal: J    Tas: I    Peta: M    Tutup: Esc",
   maxi(10,roundi(13*s)),INK,interior.size.x)
  _text(interior.position+Vector2(0,162*s),"Sistem simpan, level, HP dan energi masih dikembangkan.",
   maxi(10,roundi(12*s)),INK,interior.size.x)

func _notify(text: String) -> void:
 message_text = text
 message_left = 2.0
 queue_redraw()

func toggle_panel(which: String) -> void:
 var next_panel: String = "" if open_panel == which else which
 if next_panel == open_panel:
  return
 open_panel = next_panel
 modal_changed.emit(is_modal_open())
 queue_redraw()

func close_panel() -> void:
 if is_modal_open():
  open_panel = ""
  modal_changed.emit(false)
  queue_redraw()

func select_slot(index: int) -> void:
 if index < 0 or index >= NUM_SLOTS:
  return
 selected_slot = index
 match index:
  1: toggle_panel("Jurnal")
  2: toggle_panel("Inventori")
  3: toggle_panel("Peta")
  4: _notify("Slot belum diisi")
  5: toggle_panel("Menu")
  _: close_panel()
 queue_redraw()

func _tap(at: Vector2) -> bool:
 var d: Dictionary = _layout()
 var s: float = d["scale"]
 if is_modal_open():
  var pop: Rect2 = d["popup"]
  if not pop.has_point(at) or (d["close"] as Rect2).has_point(at):
   close_panel()
   return true
  var tab_width: float = (pop.size.x-34*s)/4
  for i in range(4):
   var tab: Rect2 = Rect2(pop.position+Vector2(17*s+tab_width*i,48*s),
    Vector2(tab_width-4*s,36*s))
   if tab.has_point(at):
    toggle_panel(["Inventori","Jurnal","Peta","Menu"][i])
    return true
  return true
 if (d["clock"] as Rect2).has_point(at):
  lighting_delta.emit(1)
  return true
 if (d["weather"] as Rect2).has_point(at):
  weather_delta.emit(1)
  return true
 if (d["minimap"] as Rect2).has_point(at):
  toggle_panel("Peta")
  return true
 var slots: Array[Rect2] = d["slots"]
 for i in range(slots.size()):
  if slots[i].has_point(at):
   select_slot(i)
   return true
 return false

func _input(event: InputEvent) -> void:
 if event is InputEventKey and event.pressed and not event.echo:
  var key: int = event.keycode
  if key == KEY_ESCAPE:
   if is_modal_open():
    close_panel()
   else:
    toggle_panel("Menu")
  elif key == KEY_I:
   toggle_panel("Inventori")
  elif key == KEY_J:
   toggle_panel("Jurnal")
  elif key == KEY_M:
   toggle_panel("Peta")
  elif key >= KEY_1 and key <= KEY_6 and not is_modal_open():
   select_slot(key-KEY_1)
  else:
   return
  get_viewport().set_input_as_handled()
 elif event is InputEventScreenTouch and event.pressed:
  if _last_pointer_frame != Engine.get_process_frames() and _tap(event.position):
   _last_pointer_frame = Engine.get_process_frames()
   get_viewport().set_input_as_handled()
 elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
  if _last_pointer_frame != Engine.get_process_frames() and _tap(event.position):
   _last_pointer_frame = Engine.get_process_frames()
   get_viewport().set_input_as_handled()
