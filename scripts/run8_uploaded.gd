extends Node2D
# Isolated test only. Original main scene unchanged.
const RUN_FPS := 12.0 # Exactly 12 displayed animation frames per second for every direction.
const RUN_FRAME_COUNT := 12 # 12 source slots per loop: consistent cadence at 12 FPS.
const MOVE_SPEED := 160.0 # Identical pixels/second for all directions, including diagonals.
# Display-only color normalization measured against the existing diagonal
# sources. Side views are slightly redder / more saturated than other views.
# Keep original PNGs, animation frames, alpha, pivots, scale and FPS unchanged.
const SIDE_COLOR_GAIN := Vector3(0.955, 1.041, 1.008)
const SIDE_SATURATION := 0.942
const NEUTRAL_COLOR_GAIN := Vector3(1.0, 1.0, 1.0)
# Visual-bounds calibration of the CURRENT uploaded sprite resources (alpha >= 25).
# All resource frames use a 768x1168 canvas, but the visible character heights
# are not equal. Normalize the median silhouette heights per DIRECTION, never
# individual poses: resizing each frame would create an ugly pumping effect.
# Values below are the median measured visible alpha bounds of source frames.
const ACTOR_BASE_SCALE := 0.23
const TARGET_VISIBLE_HEIGHT := 1101.0 # Front/down source is the size reference.
const PIVOT_X := 384.0
const SOURCE_VISIBLE_HEIGHT := {
 "right": 988.0, "left": 988.0,
 "down_right": 1076.5, "down_left": 1076.5,
 "down": 1101.0,
 "up_right": 1048.0, "up_left": 1048.0,
 "up": 1081.0
}
# Median bottom of alpha silhouette in the 768x1168 source canvas.
# Place this foot baseline on the node origin for EVERY direction, eliminating
# floating/sinking when turning between differently cropped source sprites.
const SOURCE_FOOT_BASELINE := {
 "right": 1081.0, "left": 1081.0,
 "down_right": 1097.5, "down_left": 1097.5,
 "down": 1126.0,
 "up_right": 1073.0, "up_left": 1073.0,
 "up": 1120.0
}

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
   # New user-approved file back_left_right_godot4.zip: 3 sequential
   # source rows x 7 frames = ONE natural, 21-frame running cycle.
   # Do not treat rows as different directions.
   var approved_path: String = "res://assets/characters/run_uploaded/back_diagonal/back_left_right.tres"
   if ResourceLoader.exists(approved_path):
    var approved: SpriteFrames = load(approved_path) as SpriteFrames
    assert(approved != null, "Approved back-diagonal SpriteFrames failed to load")
    for row_name in ["row_1", "row_2", "row_3"]:
     assert(approved.has_animation(row_name), "Missing approved animation row: " + row_name)
     for j in range(approved.get_frame_count(row_name)):
      frames.append(approved.get_frame_texture(row_name, j))
    assert(frames.size() == 21, "Approved back-diagonal source should contain 21 continuous frames")
    print("RUN8 BACK DIAGONAL: approved back_left_right.tres / 21 frames")
   else:
    # Keep test usable until the two edited PNGs and .tres have been uploaded.
    var fallback: Texture2D = load("res://assets/characters/run_uploaded/up_right/Natural_run_cycle_in_place.png") as Texture2D
    assert(fallback != null, "Missing temporary back-diagonal sheet")
    for i in range(1, 31):
     var frame := AtlasTexture.new()
     frame.atlas = fallback
     frame.region = Rect2((i % 6) * 512, int(i / 6) * 898, 512, 898)
     frame.filter_clip = true
     frames.append(frame)
    print("RUN8 BACK DIAGONAL: temporary asset, awaiting edited back_left_right ZIP")
  else:
   var source: SpriteFrames = load(RESOURCES[origin]) as SpriteFrames
   assert(source != null, "Missing original upload: " + origin)
   var names := Array(source.get_animation_names())
   names.sort()
   for a in names:
    for j in source.get_frame_count(a):
     frames.append(source.get_frame_texture(a,j))
  # Re-time the original pose sequence onto exactly twelve uniform slots.
  # Long sources: choose ordered key poses across the source sequence.
  # Short sources: repeat only existing poses at distributed positions.
  # Keep uploaded .tres/PNG files completely untouched.
  var run_frames: Array[Texture2D] = retime_run_frames(frames)
  var key: String = "run_" + str(d)
  bank.add_animation(key)
  bank.set_animation_speed(key, RUN_FPS)
  bank.set_animation_loop(key, true)
  for frame in run_frames:
   bank.add_frame(key, frame)
  frames_count[d] = run_frames.size()
  print("RUN8 RETIME %s: %d original -> %d frames @ %.0f FPS" % [d, frames.size(), run_frames.size(), RUN_FPS])
 actor.sprite_frames = bank
 _setup_color_material()
 actor.position = Vector2(640,470)
 _make_ui()
 set_direction("down",false)
 queue_redraw()
# Even phase-based sampling retains the original pose order, including both
# leg-contact phases. Indices use a half-open interval [0, original_count),
# avoiding duplicated wrap-around frames and providing stable loops.
# Example: 8 -> 12 = [0,0,1,2,2,3,4,4,5,6,6,7]
# 18/21/26 -> 12: skips only intermediate source poses, never interpolates
# or alters pixel/alpha data. Original sources remain available for later edits.
func retime_run_frames(original_frames: Array[Texture2D]) -> Array[Texture2D]:
 var source_count: int = original_frames.size()
 assert(source_count >= 2, "Run animation must contain at least two original poses")
 var result: Array[Texture2D] = []
 for slot in range(RUN_FRAME_COUNT):
  var source_index: int = clampi(int(floor(float(slot) * float(source_count) / float(RUN_FRAME_COUNT))), 0, source_count - 1)
  result.append(original_frames[source_index])
 assert(result.size() == RUN_FRAME_COUNT)
 return result

func _setup_color_material() -> void:
 # In Godot CanvasItem fragment, COLOR already contains the sampled texture
 # multiplied by the actor's modulate. Do not sample TEXTURE again or the
 # sprites become unintentionally double-darkened.
 var shader := Shader.new()
 shader.code = """
shader_type canvas_item;
uniform vec3 channel_gain = vec3(1.0, 1.0, 1.0);
uniform float saturation = 1.0;
void fragment() {
 vec4 original = COLOR;
 vec3 balanced = original.rgb * channel_gain;
 float luminosity = dot(balanced, vec3(0.2126, 0.7152, 0.0722));
 balanced = mix(vec3(luminosity), balanced, saturation);
 COLOR = vec4(clamp(balanced, vec3(0.0), vec3(1.0)), original.a);
}
"""
 var grade := ShaderMaterial.new()
 grade.shader = shader
 actor.material = grade

func _apply_color_grade(direction: String) -> void:
 var grade: ShaderMaterial = actor.material as ShaderMaterial
 if grade == null:
  return
 # Both mirrored side views use the same color treatment.
 if direction == "right" or direction == "left":
  grade.set_shader_parameter("channel_gain", SIDE_COLOR_GAIN)
  grade.set_shader_parameter("saturation", SIDE_SATURATION)
 else:
  grade.set_shader_parameter("channel_gain", NEUTRAL_COLOR_GAIN)
  grade.set_shader_parameter("saturation", 1.0)

func apply_proportions(direction: String) -> void:
 # One uniform factor for X and Y keeps each illustrated body proportional.
 # Mirrored partners share EXACTLY the same scale, foot baseline, and silhouette.
 assert(SOURCE_VISIBLE_HEIGHT.has(direction), "Unknown RUN direction for size calibration")
 var source_height: float = float(SOURCE_VISIBLE_HEIGHT[direction])
 var source_foot: float = float(SOURCE_FOOT_BASELINE[direction])
 var scale_factor: float = ACTOR_BASE_SCALE * TARGET_VISIBLE_HEIGHT / source_height
 actor.scale = Vector2(scale_factor, scale_factor)
 actor.offset = Vector2(-PIVOT_X, -source_foot)

func set_direction(d: String, moving: bool) -> void:
 current_dir = d
 apply_proportions(d)
 _apply_color_grade(d)
 actor.flip_h = d in ["left", "down_left", "up_left"]
 var key: String = "run_" + d
 # Keep the stride phase when changing direction mid-run. Previously changing
 # animation reset the pose to frame 0, making turns seem slower or jerky.
 var was_running: bool = actor.is_playing()
 var phase: float = 0.0
 if moving and was_running:
  var previous_count: int = max(1, actor.sprite_frames.get_frame_count(actor.animation))
  phase = fposmod((float(actor.frame) + actor.frame_progress) / float(previous_count), 1.0)
 if actor.animation != key:
  actor.animation = key
  if moving and was_running:
   var next_count: int = actor.sprite_frames.get_frame_count(key)
   var frame_position: float = phase * float(next_count)
   var next_frame: int = clampi(int(floor(frame_position)), 0, next_count - 1)
   actor.set_frame_and_progress(next_frame, frame_position - float(next_frame))
 if moving:
  if not actor.is_playing():
   actor.play()
 else:
  actor.stop()
  actor.frame = 0
 if info != null:
  info.text = "Arah: %s | %d frame | RUN %.0f FPS | %s" % [d, int(frames_count[d]), RUN_FPS, "RUN" if moving else "IDLE"]

func move_in_direction(direction: Vector2, delta: float) -> void:
 # Normalization is essential: diagonal input (1,1) must NOT move sqrt(2)x faster.
 if direction == Vector2.ZERO:
  return
 var unit_direction: Vector2 = direction.normalized()
 actor.position = (actor.position + unit_direction * MOVE_SPEED * maxf(delta, 0.0)).clamp(Vector2(110, 200), Vector2(1170, 655))
 var idx: int = posmod(int(round(unit_direction.angle() / (PI / 4.0))), 8)
 set_direction(DIRECTIONS[idx], true)
func _process(delta:float) -> void:
 var v := Vector2.ZERO
 if Input.is_action_pressed("ui_left") or Input.is_key_pressed(KEY_A): v.x -= 1
 if Input.is_action_pressed("ui_right") or Input.is_key_pressed(KEY_D): v.x += 1
 if Input.is_action_pressed("ui_up") or Input.is_key_pressed(KEY_W): v.y -= 1
 if Input.is_action_pressed("ui_down") or Input.is_key_pressed(KEY_S): v.y += 1
 if v == Vector2.ZERO and touch_dir != "": v=MOVE[touch_dir]
 if v != Vector2.ZERO:
  move_in_direction(v, delta)
 elif actor.is_playing():
  set_direction(current_dir, false)
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
