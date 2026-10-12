extends Node2D
# Isolated test only. Original main scene unchanged.
const LOOP_SECONDS := 1.0 # Same complete run-loop duration in all eight directions.
const DIRECTIONS := ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]
const RESOURCES := {
 "right": "res://assets/characters/run_uploaded/right/lembah_asri_run_49_frames_7x7_lossless.tres",
 "down_right": "res://assets/characters/run_uploaded/down_right/run_12_spritesheet_4x3.tres",
 "down": "res://assets/characters/run_uploaded/down/run_12_spritesheet_4x3_1.tres",
 "up": "res://assets/characters/run_uploaded/up/run_back_12_spritesheet_4x3.tres"
}
const MOVE := {
 "up_left": Vector2(-1,-1),"up":Vector2(0,-1),"up_right":Vector2(1,-1),
 "left":Vector2(-1,0),"right":Vector2(1,0),
 "down_left":Vector2(-1,1),"down":Vector2(0,1),"down_right":Vector2(1,1)
}
@onready var actor: AnimatedSprite2D = $Runner
var current_dir := "down"
var touch_dir := ""
var info: Label
var frames_count := {}
func _ready() -> void:
 var bank := SpriteFrames.new()
 if bank.has_animation("default"): bank.remove_animation("default")
 for d in DIRECTIONS:
  var origin: String = d
  if d == "left": origin = "right"
  if d == "down_left": origin = "down_right"
  if d == "up_left": origin = "up_right"
  var frames: Array[Texture2D] = []
  if origin == "up_right":
   # New approved rear-diagonal source: 49 transparent 768x1168 cells (7x7).
   # Keep the previous asset only as a non-breaking fallback until the new PNG
   # is committed; the run8-uploaded scene must remain runnable meanwhile.
   var approved_path: String = "res://assets/characters/run_uploaded/back_diagonal/lembah_asri_run_49_7x7_transparent_lossless.png"
   var has_approved: bool = ResourceLoader.exists(approved_path)
   var source_path: String = approved_path if has_approved else "res://assets/characters/run_uploaded/up_right/Natural_run_cycle_in_place.png"
   var tex: Texture2D = load(source_path) as Texture2D
   assert(tex != null, "Missing rear-diagonal sheet: " + source_path)
   var cols: int = 7 if has_approved else 6
   var cell_w: int = int(tex.get_width() / cols)
   var cell_h: int = int(tex.get_height() / cols)
   assert((tex.get_width() % cols) == 0 and (tex.get_height() % cols) == 0)
   if has_approved:
    assert(cell_w == 768 and cell_h == 1168, "Unexpected dimensions for approved rear-diagonal sprites")
    print("RUN8 BACK DIAGONAL: approved 49-frame upload")
   else:
    print("RUN8 BACK DIAGONAL: fallback until approved PNG is committed")
   # New file uses all 49 real poses; old source skips the first bad cell.
   var begin_frame: int = 0 if has_approved else 1
   var end_frame: int = 49 if has_approved else 31
   for i in range(begin_frame, end_frame):
    var frame := AtlasTexture.new()
    frame.atlas = tex
    frame.region = Rect2((i % cols) * cell_w, int(i / cols) * cell_h, cell_w, cell_h)
    frame.filter_clip = true
    frames.append(frame)
  else:
   var source: SpriteFrames = load(RESOURCES[origin]) as SpriteFrames
   assert(source != null, "Missing original upload: " + origin)
   var names := Array(source.get_animation_names())
   names.sort()
   for a in names:
    for j in source.get_frame_count(a):
     frames.append(source.get_frame_texture(a,j))
  var key: String = "run_" + str(d)
  bank.add_animation(key)
  # 8, 18, 26, 30 or 49 frames all complete in LOOP_SECONDS.
  bank.set_animation_speed(key, float(frames.size()) / LOOP_SECONDS)
  bank.set_animation_loop(key,true)
  for frame in frames: bank.add_frame(key,frame)
  frames_count[d] = frames.size()
 actor.sprite_frames = bank
 actor.position = Vector2(640,470)
 _make_ui()
 set_direction("down",false)
 queue_redraw()
func set_direction(d:String, moving:bool) -> void:
 current_dir = d
 actor.flip_h = d in ["left","down_left","up_left"]
 var key := "run_" + d
 if actor.animation != key: actor.animation = key
 if moving:
  if not actor.is_playing(): actor.play()
 else:
  actor.stop()
  actor.frame=0
 if info != null: info.text = "Arah: %s | %d frame asli | %s" % [d,frames_count[d],"RUN" if moving else "IDLE"]
func _process(delta:float) -> void:
 var v := Vector2.ZERO
 if Input.is_action_pressed("ui_left") or Input.is_key_pressed(KEY_A): v.x -= 1
 if Input.is_action_pressed("ui_right") or Input.is_key_pressed(KEY_D): v.x += 1
 if Input.is_action_pressed("ui_up") or Input.is_key_pressed(KEY_W): v.y -= 1
 if Input.is_action_pressed("ui_down") or Input.is_key_pressed(KEY_S): v.y += 1
 if v == Vector2.ZERO and touch_dir != "": v=MOVE[touch_dir]
 if v != Vector2.ZERO:
  v=v.normalized()
  actor.position=(actor.position+v*160*delta).clamp(Vector2(110,200),Vector2(1170,655))
  var idx:=posmod(int(round(v.angle()/(PI/4.0))),8)
  set_direction(DIRECTIONS[idx],true)
 elif actor.is_playing(): set_direction(current_dir,false)
func _draw() -> void:
 draw_rect(Rect2(0,0,1280,720),Color("d6e5c9"))
 for x in range(0,1281,40):draw_line(Vector2(x,0),Vector2(x,720),Color(0.3,0.4,0.3,0.14),1)
 for y in range(0,721,40):draw_line(Vector2(0,y),Vector2(1280,y),Color(0.3,0.4,0.3,0.14),1)
func _make_ui() -> void:
 var canvas:=CanvasLayer.new()
 add_child(canvas)
 var ui:=Control.new()
 canvas.add_child(ui)
 ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 var h:=Label.new()
 h.text="LEMBAH ASRI | RUN DARI ZIP UPLOAD"
 h.position=Vector2(20,15)
 h.add_theme_font_size_override("font_size",24)
 ui.add_child(h)
 info=Label.new()
 info.position=Vector2(20,55)
 ui.add_child(info)
 var entries:=[ ["up_left","↖",0,0],["up","↑",1,0],["up_right","↗",2,0], ["left","←",0,1],["right","→",2,1], ["down_left","↙",0,2],["down","↓",1,2],["down_right","↘",2,2] ]
 for e in entries:
  var btn:=Button.new()
  btn.text=e[1]
  btn.position=Vector2(20+int(e[2])*63,495+int(e[3])*65)
  btn.size=Vector2(60,60)
  ui.add_child(btn)
  btn.button_down.connect(func():touch_dir=e[0])
  btn.button_up.connect(func():touch_dir="")
