extends Node2D
# Isolated test only. Original main scene unchanged.
# Most directions keep their approved 12-frame / 12-FPS RUN. Side views
# deliberately retain all 14 native stride poses and play at 14 FPS, so
# their full left+right foot cycle still lasts one second.
const RUN_FPS := 12.0
const RUN_FRAME_COUNT := 12
const SIDE_RUN_FRAME_COUNT := 14
const RUN_FPS_BY_DIR := {
 "right": 14.0, "left": 14.0,
 "down_right": 12.0, "down_left": 12.0,
 "down": 12.0, "up_right": 12.0,
 "up_left": 12.0, "up": 12.0
}
const MOVE_SPEED := 160.0 # Identical pixels/second for all directions, including diagonals.
# Test-scene movement boundaries refer to the *foot pivot*. A 253px-tall
# character whose feet are at y=200 is clipped above the viewport/header.
# Keep the whole silhouette inside the stage with clearance below the HUD.
const TOP_HUD_SAFE_Y := 105.0
const RUN_HEADROOM_MARGIN := 20.0
const STAGE_SIDE_MARGIN := 150.0
# Original, approved 8-direction IDLE artwork already present in repository.
# This avoids freezing a running frame whenever input is released.
# These 1152x1632 PNGs were uploaded by the user and anchored at boot Y=1585.
const IDLE_FOOT_Y := 1585.0
const IDLE_PIVOT_X := 576.0
const IDLE_VISIBLE_HEIGHT := {
 "down": 1492.0, "down_right": 1498.0, "right": 1507.0,
 "up_right": 1492.0, "up": 1529.0, "up_left": 1490.0,
 "left": 1515.0, "down_left": 1494.0
}
const IDLE_BASE_PATH := "res://assets/characters/player_base_8dir/" # Legacy ONLY if new files are missing.
# User-supplied latest idle PNGs, with three mirrored partners. All 5 are
# required before switching sources to prevent mixed art/style in one session.
const NEW_IDLE_BASE_PATH := "res://assets/characters/idle_uploaded/"
const NEW_IDLE_SOURCE := {
 "down": "front", "down_right": "front_right", "right": "right",
 "up_right": "back_right", "up": "back",
 "up_left": "back_right", "left": "right", "down_left": "front_right"
}
# Actual alpha>=25 bounding boxes of the five latest images, all 1024x1536.
const NEW_IDLE_VISIBLE_HEIGHT := {
 "front": 1430.0, "front_right": 1447.0, "right": 1373.0,
 "back_right": 1394.0, "back": 1396.0
}
const NEW_IDLE_FOOT_Y := {
 "front": 1464.0, "front_right": 1491.0, "right": 1457.0,
 "back_right": 1436.0, "back": 1436.0
}
const NEW_IDLE_PIVOT_X := {
 "front": 528.0, "front_right": 524.0, "right": 510.0,
 "back_right": 540.5, "back": 521.5
}

# Earlier side color balance brought opaque left/right closer to front but
# tinted partially transparent hands green. Restore the measured correction
# ONLY on opaque pixels of side RUN using the alpha-aware shader below.
# Preserve native side IDLE art and every non-side direction.
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
 # Re-measured from ORIGINAL alpha>=25 source frames used by each direction.
 # Calibrate one scale per direction, never resize poses individually.
 "right": 980.0, "left": 980.0,
 "down_right": 1069.0, "down_left": 1069.0,
 "down": 1101.0,
 "up_right": 1048.0, "up_left": 1048.0,
 "up": 1081.0
}
# Median bottom of alpha silhouette in the 768x1168 source canvas.
# Place this foot baseline on the node origin for EVERY direction, eliminating
# floating/sinking when turning between differently cropped source sprites.
const SOURCE_FOOT_BASELINE := {
 # Median last opaque pixel, measured from the actual selected run poses.
 "right": 1077.0, "left": 1077.0,
 "down_right": 1092.5, "down_left": 1092.5,
 "down": 1125.0,
 "up_right": 1073.0, "up_left": 1073.0,
 "up": 1119.0
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
var using_new_idle: bool = false
var using_refined_back_loop: bool = false
const REFINED_BACK_RUN_PATH := "res://assets/characters/run_uploaded/back_diagonal/back_diagonal_run12.tres"
const REFINED_BACK_HEIGHT := 1050.5
const REFINED_BACK_FOOT := 1067.0
func _ready() -> void:
 using_refined_back_loop = ResourceLoader.exists(REFINED_BACK_RUN_PATH)
 using_new_idle = true
 for source_name in ["front", "front_right", "right", "back_right", "back"]:
  if not ResourceLoader.exists(NEW_IDLE_BASE_PATH + source_name + ".png"):
   using_new_idle = false
   break
 if using_new_idle:
  print("IDLE SOURCE: latest five PNGs, 8 dirs with 3 mirrors")
 else:
  push_warning("LATEST IDLE PNGs NOT IN GITHUB: still using legacy until 5 files are uploaded under assets/characters/idle_uploaded")
 var bank := SpriteFrames.new()
 if bank.has_animation("default"): bank.remove_animation("default")
 for d in DIRECTIONS:
  var origin: String = d
  if d == "left": origin = "right"
  if d == "down_left": origin = "down_right"
  if d == "up_left": origin = "up_right"
  var frames: Array[Texture2D] = []
  if origin == "up_right":
   # Latest revised 12-frame in-place rear-diagonal cycle from the user's
   # full 49-frame original. This takes priority over the turning 21-frame edit.
   if using_refined_back_loop:
    var refined: SpriteFrames = load(REFINED_BACK_RUN_PATH) as SpriteFrames
    assert(refined != null and refined.has_animation("run_back_right"), "Refined back diagonal resource invalid")
    assert(refined.get_frame_count("run_back_right") == 12)
    for j in range(12):
     frames.append(refined.get_frame_texture("run_back_right", j))
    print("RUN8 BACK DIAGONAL: corrected 12 native frames from full 49-frame source")
   else:
    var approved_path: String = "res://assets/characters/run_uploaded/back_diagonal/back_left_right.tres"
    if ResourceLoader.exists(approved_path):
     var approved: SpriteFrames = load(approved_path) as SpriteFrames
     assert(approved != null, "Edited back diagonal SpriteFrames failed to load")
     for row_name in ["row_1", "row_2", "row_3"]:
      assert(approved.has_animation(row_name), "Missing source row " + row_name)
      for j in range(approved.get_frame_count(row_name)):
       frames.append(approved.get_frame_texture(row_name, j))
     assert(frames.size() == 21)
     print("RUN8 BACK DIAGONAL: fallback 21-frame turning source, pending revised 12-frame PNG")
    else:
     var fallback: Texture2D = load("res://assets/characters/run_uploaded/up_right/Natural_run_cycle_in_place.png") as Texture2D
     assert(fallback != null)
     for i in range(1, 31):
      var frame := AtlasTexture.new()
      frame.atlas = fallback
      frame.region = Rect2((i % 6) * 512, int(i / 6) * 898, 512, 898)
      frame.filter_clip = true
      frames.append(frame)
     print("RUN8 BACK DIAGONAL: emergency legacy fallback")
  else:
   var source: SpriteFrames = load(RESOURCES[origin]) as SpriteFrames
   assert(source != null, "Missing original upload: " + origin)
   var names := Array(source.get_animation_names())
   names.sort()
   for a in names:
    for j in source.get_frame_count(a):
     frames.append(source.get_frame_texture(a,j))
  # Full native 14-frame side stride; other directions retain 12 frames.
  # Never discard contact phases to force a uniform frame count.
  # Source .tres/PNG resources remain unchanged.
  var run_frames: Array[Texture2D] = retime_run_frames(d, frames)
  var key: String = "run_" + str(d)
  bank.add_animation(key)
  bank.set_animation_speed(key, float(RUN_FPS_BY_DIR[d]))
  bank.set_animation_loop(key, true)
  for frame in run_frames:
   bank.add_frame(key, frame)
  frames_count[d] = run_frames.size()
  print("RUN8 RETIME %s: %d original -> %d frames @ %.0f FPS" % [d, frames.size(), run_frames.size(), float(RUN_FPS_BY_DIR[d])])
 # Prefer the five NEW user-uploaded pose PNGs when all are actually present.
 # Mirror only left-facing partners; never mirror the hair or redraw frames.
 for d in DIRECTIONS:
  var idle_path: String = NEW_IDLE_BASE_PATH + str(NEW_IDLE_SOURCE[d]) + ".png" if using_new_idle else IDLE_BASE_PATH + str(d) + ".png"
  var idle_texture: Texture2D = load(idle_path) as Texture2D
  assert(idle_texture != null, "Missing IDLE pose: " + idle_path)
  var idle_name: String = "idle_" + str(d)
  bank.add_animation(idle_name)
  bank.set_animation_speed(idle_name, 1.0)
  bank.set_animation_loop(idle_name, false)
  bank.add_frame(idle_name, idle_texture)
 actor.sprite_frames = bank
 _setup_color_material()
 actor.position = Vector2(640,470)
 _make_ui()
 set_direction("down",false)
 queue_redraw()
# Native side SpriteFrames are arranged in 7-frame row_3 (indices 0..6)
# then 7-frame row_4 (7..13), representing BOTH foot-contact phases.
# Repeating these 14 source frames at 14 FPS preserves the full original gait.
# Never skip contacts or cross into disconnected row_6 / row_7.
const SIDE_RUN_LOOP_FULL := [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
const REAR_DIAGONAL_RUN_LOOP_12 := [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

func target_run_frame_count(direction: String) -> int:
 return SIDE_RUN_FRAME_COUNT if direction == "right" or direction == "left" else RUN_FRAME_COUNT

func run_source_indices(direction: String, source_count: int) -> PackedInt32Array:
 assert(source_count >= 2, "RUN requires at least two source poses")
 if (direction == "right" or direction == "left") and source_count == 26:
  return PackedInt32Array(SIDE_RUN_LOOP_FULL)
 if (direction == "up_right" or direction == "up_left") and source_count == 21:
  return PackedInt32Array(REAR_DIAGONAL_RUN_LOOP_12)
 var target_count: int = target_run_frame_count(direction)
 var indices := PackedInt32Array()
 for slot in range(target_count):
  indices.append(clampi(int(floor(float(slot) * float(source_count) / float(target_count))), 0, source_count - 1))
 return indices

func retime_run_frames(direction: String, original_frames: Array[Texture2D]) -> Array[Texture2D]:
 var indices: PackedInt32Array = run_source_indices(direction, original_frames.size())
 assert(indices.size() == target_run_frame_count(direction), "RUN frame count mismatch for " + direction)
 var result: Array[Texture2D] = []
 for i in indices:
  assert(i >= 0 and i < original_frames.size(), "RUN index out of source range")
  result.append(original_frames[i])
 return result

func _setup_color_material() -> void:
 # In Godot CanvasItem fragment, COLOR already includes the sampled texture.
 # Keep alpha unchanged, apply palette balancing only to opaque source pixels.
 # This avoids green edge fringes on transparent hands and hair.
 var shader := Shader.new()
 shader.code = """
shader_type canvas_item;
uniform vec3 channel_gain = vec3(1.0, 1.0, 1.0);
uniform float saturation = 1.0;
uniform float edge_alpha_start = 0.35;
uniform float edge_alpha_end = 0.95;
void fragment() {
 vec4 original = COLOR;
 vec3 graded = original.rgb * channel_gain;
 float luminosity = dot(graded, vec3(0.2126, 0.7152, 0.0722));
 graded = mix(vec3(luminosity), graded, saturation);
 float opaque_mask = smoothstep(edge_alpha_start, edge_alpha_end, original.a);
 vec3 final_rgb = mix(original.rgb, graded, opaque_mask);
 COLOR = vec4(clamp(final_rgb, vec3(0.0), vec3(1.0)), original.a);
}
"""
 var grade := ShaderMaterial.new()
 grade.shader = shader
 actor.material = grade

func _apply_color_grade(direction: String, moving: bool = true) -> void:
 var grade: ShaderMaterial = actor.material as ShaderMaterial
 if grade == null:
  return
 # Side RUN only. New user-uploaded IDLE artwork retains its original colors.
 # Other directions remain neutral.
 if moving and (direction == "left" or direction == "right"):
  grade.set_shader_parameter("channel_gain", SIDE_COLOR_GAIN)
  grade.set_shader_parameter("saturation", SIDE_SATURATION)
 else:
  grade.set_shader_parameter("channel_gain", NEUTRAL_COLOR_GAIN)
  grade.set_shader_parameter("saturation", 1.0)

func apply_proportions(direction: String, moving: bool = true) -> void:
 # Calibrate each distinct canvas to a single visible body height and heel
 # position; never resize or recolor the source PNG.
 var source_height: float = float(SOURCE_VISIBLE_HEIGHT[direction])
 var source_foot: float = float(SOURCE_FOOT_BASELINE[direction])
 if moving and using_refined_back_loop and direction in ["up_left", "up_right"]:
  source_height = REFINED_BACK_HEIGHT
  source_foot = REFINED_BACK_FOOT
 var source_pivot_x: float = PIVOT_X
 if not moving:
  if using_new_idle:
   var origin: String = str(NEW_IDLE_SOURCE[direction])
   source_height = float(NEW_IDLE_VISIBLE_HEIGHT[origin])
   source_foot = float(NEW_IDLE_FOOT_Y[origin])
   source_pivot_x = float(NEW_IDLE_PIVOT_X[origin])
  else:
   source_height = float(IDLE_VISIBLE_HEIGHT[direction])
   source_foot = IDLE_FOOT_Y
   source_pivot_x = IDLE_PIVOT_X
 var scale_factor: float = ACTOR_BASE_SCALE * TARGET_VISIBLE_HEIGHT / source_height
 actor.scale = Vector2(scale_factor, scale_factor)
 actor.offset = Vector2(-source_pivot_x, -source_foot)

func set_direction(d: String, moving: bool) -> void:
 current_dir = d
 apply_proportions(d, moving)
 _apply_color_grade(d, moving)
 # New IDLE uses 5 source images and mirrors 3 left directions. Legacy idle
 # already has unique native left poses so it must NOT be mirrored.
 actor.flip_h = d in ["left", "down_left", "up_left"] if (moving or using_new_idle) else false
 var key: String = ("run_" if moving else "idle_") + d
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
  var state_label: String = "RUN" if moving else ("IDLE NEW" if using_new_idle else "IDLE LEGACY — NEW PNGs NOT UPLOADED")
  info.text = "Arah: %s | %d RUN frames @ %.0f FPS | %s" % [d, int(frames_count[d]), float(RUN_FPS_BY_DIR[d]), state_label]

func move_in_direction(direction: Vector2, delta: float) -> void:
 # Normalization is essential: diagonal input (1,1) must NOT move sqrt(2)x faster.
 if direction == Vector2.ZERO:
  return
 var unit_direction: Vector2 = direction.normalized()
 # Full silhouette is approximately 0.23 * 1101 = 253 screen units.
 # Clamp the FOOT position accordingly so head/hair never disappears over the
 # top of the screen, even when holding an upward direction for several seconds.
 var min_foot_y: float = TOP_HUD_SAFE_Y + ACTOR_BASE_SCALE * TARGET_VISIBLE_HEIGHT + RUN_HEADROOM_MARGIN
 var min_foot: Vector2 = Vector2(STAGE_SIDE_MARGIN, min_foot_y)
 var max_foot: Vector2 = Vector2(1280.0 - STAGE_SIDE_MARGIN, 655.0)
 actor.position = (actor.position + unit_direction * MOVE_SPEED * maxf(delta, 0.0)).clamp(min_foot, max_foot)
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
