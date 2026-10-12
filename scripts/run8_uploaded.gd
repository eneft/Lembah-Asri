extends Node2D
# Isolated test only. Original main scene unchanged.
const COLOR_GRADE := {
 "right": {"gain": Vector3(0.955, 1.041, 1.008), "saturation": 0.942, "brightness": 1.0},
 "left": {"gain": Vector3(0.955, 1.041, 1.008), "saturation": 0.942, "brightness": 1.0}
}
const DEFAULT_COLOR_GRADE := {"gain": Vector3(1.0, 1.0, 1.0), "saturation": 1.0, "brightness": 1.0}
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
   var tex: Texture2D = load("res://assets/characters/run_uploaded/up_right/Natural_run_cycle_in_place.png")
   assert(tex != null)
   # 6 columns x 6 rows; first cell has dark artifact, use valid cells 1..30.
   for i in range(1,31):
    var frame := AtlasTexture.new()
    frame.atlas = tex
    frame.region = Rect2((i % 6)*512,int(i / 6)*898,512,898)
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
  var key := "run_" + d
  bank.add_animation(key)
  bank.set_animation_speed(key,12.0)
  bank.set_animation_loop(key,true)
  for frame in frames: bank.add_frame(key,frame)
  frames_count[d] = frames.size()
 actor.sprite_frames = bank
 _ensure_color_material()
 actor.position = Vector2(640,470)
 _make_ui()
 set_direction("down",false)
 queue_redraw()
func _ensure_color_material() -> void:
 var shader := Shader.new()
 shader.code = """
shader_type canvas_item;
uniform vec3 channel_gain = vec3(1.0, 1.0, 1.0);
uniform float saturation = 1.0;
uniform float brightness = 1.0;
void fragment() {
 vec4 tex = texture(TEXTURE, UV);
 vec3 rgb = tex.rgb * channel_gain;
 float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
 rgb = mix(vec3(luma), rgb, saturation) * brightness;
 COLOR = vec4(rgb, tex.a) * COLOR;
}
"""
 var material := ShaderMaterial.new()
 material.shader = shader
 actor.material = material

func _apply_color_grade(direction: String) -> void:
 var cfg: Dictionary = COLOR_GRADE.get(direction, DEFAULT_COLOR_GRADE)
 var material := actor.material as ShaderMaterial
 if material == null:
  return
 material.set_shader_parameter("channel_gain", cfg["gain"])
 material.set_shader_parameter("saturation", float(cfg["saturation"]))
 material.set_shader_parameter("brightness", float(cfg["brightness"]))

func set_direction(d:String, moving:bool) -> void:
 current_dir = d
 _apply_color_grade(d)
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
