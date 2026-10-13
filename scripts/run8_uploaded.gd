extends Node2D
# Isolated test only. Original main scene unchanged.
# Source-preserving RUN: do NOT drop, duplicate, reorder, or resample frames
# in LEFT/RIGHT (26-frame original) or UP_LEFT/UP_RIGHT (21-frame original).
# One native cycle per second, so FPS equals original source frame count.
# Other four directions retain their established 12@12 configuration.
# A full original cycle is not a guarantee of a seamless source-art loop.
const RUN_FPS := 12.0
const RUN_FRAME_COUNT := 12
const SIDE_RUN_FRAME_COUNT := 26
const BACK_DIAGONAL_RUN_FRAME_COUNT := 21
const RUN_FPS_BY_DIR := {
 "right": 26.0, "left": 26.0,
 "down_right": 12.0, "down_left": 12.0,
 "down": 12.0, "up_right": 21.0,
 "up_left": 21.0, "up": 12.0
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

# Color audit (skin/shirt median RGB, opaque source pixels, normalized crops):
# SIDE skin [220,133,87] vs FRONT skin [224,148,93]; SIDE green shirt
# [124,109,70] vs FRONT shirt [126,101,66]. One global green-channel gain
# makes the shirt greener while trying to correct skin, causing bad fringes.
# Separate alpha-protected skin and green-shirt corrections instead.
# Original textures, IDLE and non-side directions remain unchanged.
const SIDE_SKIN_GAIN := Vector3(1.015, 1.11, 1.08)
const SIDE_SHIRT_GAIN := Vector3(1.020, 0.900, 0.920)
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
const ORIGINAL_BACK_RUN_PATH := "res://assets/characters/run_uploaded/back_diagonal/back_left_right.tres"
func _ready() -> void:
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
   # Use the user's actual EDITED 21-frame Back Right/Left resource. Do not
   # substitute the later 12-frame refined asset or trim any original pose.
   # Mirroring to up_left is controlled by actor.flip_h, never by frame edits.
   var back_source: SpriteFrames = load(ORIGINAL_BACK_RUN_PATH) as SpriteFrames
   assert(back_source != null, "Missing original 21-frame back diagonal upload")
   for row_name in ["row_1", "row_2", "row_3"]:
    assert(back_source.has_animation(row_name), "Missing original back row " + row_name)
    for j in range(back_source.get_frame_count(row_name)):
     frames.append(back_source.get_frame_texture(row_name, j))
   assert(frames.size() == BACK_DIAGONAL_RUN_FRAME_COUNT, "Back diagonal original must have exactly 21 poses")
   print("RUN8 BACK DIAGONAL: all 21 original frames, no sampling or truncation")
  else:
   var source: SpriteFrames = load(RESOURCES[origin]) as SpriteFrames
   assert(source != null, "Missing original upload: " + origin)
   var names := Array(source.get_animation_names())
   names.sort()
   for a in names:
    for j in source.get_frame_count(a):
     frames.append(source.get_frame_texture(a,j))
  # Side = all 26 original frames, rear diagonal = all 21 original frames.
  # Other directions continue their existing 12-frame cadence.
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
# Keep the complete, source-ordered original pose lists. Even frames that
# appear repeated are part of the user's source and MUST NOT be removed.
const SIDE_RUN_LOOP_FULL := [
 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25
]
const BACK_DIAGONAL_RUN_LOOP_FULL := [
 0, 1, 2, 3, 4, 5, 6,
 7, 8, 9, 10, 11, 12, 13,
 14, 15, 16, 17, 18, 19, 20
]

func target_run_frame_count(direction: String) -> int:
 if direction == "right" or direction == "left":
  return SIDE_RUN_FRAME_COUNT
 if direction == "up_right" or direction == "up_left":
  return BACK_DIAGONAL_RUN_FRAME_COUNT
 return RUN_FRAME_COUNT

func run_source_indices(direction: String, source_count: int) -> PackedInt32Array:
 assert(source_count >= 2, "RUN requires at least two source poses")
 if direction == "right" or direction == "left":
  assert(source_count == SIDE_RUN_FRAME_COUNT, "Side original must contain 26 poses")
  return PackedInt32Array(SIDE_RUN_LOOP_FULL)
 if direction == "up_right" or direction == "up_left":
  assert(source_count == BACK_DIAGONAL_RUN_FRAME_COUNT, "Rear diagonal original must contain 21 poses")
  return PackedInt32Array(BACK_DIAGONAL_RUN_LOOP_FULL)
 # Other four directions retain their previous 12-frame sampling behavior.
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
 # The sprite artwork already has hand/skin and jacket pixels of different
 # hues; a SINGLE green gain worsens the mismatch. Isolate colors in RGB,
 # preserve alpha and do not grade translucent edges.
 var shader := Shader.new()
 shader.code = """
shader_type canvas_item;
uniform vec3 skin_gain = vec3(1.0, 1.0, 1.0);
uniform vec3 shirt_gain = vec3(1.0, 1.0, 1.0);
uniform float grading_enabled = 0.0;
void fragment() {
 vec4 original = COLOR;
 vec3 rgb = original.rgb;
 float skin_mask = smoothstep(0.71, 0.83, rgb.r)
   * smoothstep(0.33, 0.47, rgb.g)
   * (1.0 - smoothstep(0.64, 0.76, rgb.g))
   * smoothstep(0.12, 0.25, rgb.r - rgb.g)
   * (1.0 - smoothstep(0.50, 0.68, rgb.b));
 float shirt_mask = smoothstep(0.35, 0.47, rgb.g)
   * (1.0 - smoothstep(0.55, 0.65, rgb.r))
   * smoothstep(0.72, 0.87, rgb.g / max(rgb.r, 0.001))
   * (1.0 - smoothstep(0.53, 0.65, rgb.b));
 shirt_mask *= (1.0 - skin_mask);
 vec3 corrected = rgb
   + (rgb * skin_gain - rgb) * skin_mask
   + (rgb * shirt_gain - rgb) * shirt_mask;
 float opaque_mask = smoothstep(0.40, 0.97, original.a);
 COLOR = vec4(mix(rgb, clamp(corrected, vec3(0.0), vec3(1.0)),
   grading_enabled * opaque_mask), original.a);
}
"""
 var grade := ShaderMaterial.new()
 grade.shader = shader
 actor.material = grade

func _apply_color_grade(direction: String, moving: bool = true) -> void:
 var grade: ShaderMaterial = actor.material as ShaderMaterial
 if grade == null:
  return
 # Correct opaque RUN skin and green jacket differently; native IDLE art
 # and all non-side directions are passed through without recoloring.
 grade.set_shader_parameter("skin_gain", SIDE_SKIN_GAIN)
 grade.set_shader_parameter("shirt_gain", SIDE_SHIRT_GAIN)
 grade.set_shader_parameter("grading_enabled", 1.0 if moving and (direction == "left" or direction == "right") else 0.0)

func apply_proportions(direction: String, moving: bool = true) -> void:
 # Calibrate each distinct canvas to a single visible body height and heel
 # position; never resize or recolor the source PNG.
 var source_height: float = float(SOURCE_VISIBLE_HEIGHT[direction])
 var source_foot: float = float(SOURCE_FOOT_BASELINE[direction])
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
