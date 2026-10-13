extends CharacterBody2D
## Lembah Asri MAIN scene protagonist: user's current 8-direction RUN + IDLE.
## Uses exactly the original side (26) and rear-diagonal (21) poses.
## The environmental art, Y-sort, walk polygon, camera, HUD and touch controls
## remain owned by house_garden_stage1.gd and are NOT replaced.
@export var walk_speed: float = 160.0
@export var run_speed: float = 325.0

# Optional normalized 8-direction run atlas. Old RUN/IDLE/WALK are preserved
# unless BOTH atlas PNGs and the SpriteFrames resource have been installed.
const PROPORTIONAL_RUN_PATH := "res://assets/characters/run8_proportional/Run8_SpriteFrames.tres"
var proportional_run_bank: SpriteFrames = null
var using_proportional_run: bool = false

const RUN_RIGHT: SpriteFrames = preload("res://assets/characters/run_uploaded/right/lembah_asri_run_49_frames_7x7_lossless.tres")
const RUN_FRONT_RIGHT: SpriteFrames = preload("res://assets/characters/run_uploaded/down_right/run_12_spritesheet_4x3.tres")
const RUN_FRONT: SpriteFrames = preload("res://assets/characters/run_uploaded/down/run_12_spritesheet_4x3_1.tres")
const RUN_BACK: SpriteFrames = preload("res://assets/characters/run_uploaded/up/run_back_12_spritesheet_4x3.tres")
const RUN_BACK_RIGHT: SpriteFrames = preload("res://assets/characters/run_uploaded/back_diagonal/back_left_right.tres")

const IDLE_FRONT: Texture2D = preload("res://assets/characters/idle_uploaded/front.png")
const IDLE_FRONT_RIGHT: Texture2D = preload("res://assets/characters/idle_uploaded/front_right.png")
const IDLE_RIGHT: Texture2D = preload("res://assets/characters/idle_uploaded/right.png")
const IDLE_BACK_RIGHT: Texture2D = preload("res://assets/characters/idle_uploaded/back_right.png")
const IDLE_BACK: Texture2D = preload("res://assets/characters/idle_uploaded/back.png")

const DIRECTIONS := ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]
const STATES := ["idle", "walk", "run"]
const RUN_FPS_BY_DIR := {
 "right": 26.0, "left": 26.0,
 "down_right": 12.0, "down_left": 12.0,
 "down": 12.0, "up_right": 21.0, "up_left": 21.0, "up": 12.0
}
# World art is 1672x941. Approximately 112 scene pixels high
# (about 89 screen pixels under the existing 0.80 camera zoom), noticeably
# smaller than the old 173px single-direction runner and 253px RUN test.
# Calibrate one UNIFORM scale per direction/state; never resize each frame.
const CHARACTER_HEIGHT_WORLD := 112.0
const SOURCE_VISIBLE_HEIGHT := {
 "right": 980.0, "left": 980.0,
 "down_right": 1069.0, "down_left": 1069.0,
 "down": 1101.0, "up_right": 1048.0,
 "up_left": 1048.0, "up": 1081.0
}
const SOURCE_FOOT_BASELINE := {
 "right": 1077.0, "left": 1077.0,
 "down_right": 1092.5, "down_left": 1092.5,
 "down": 1125.0, "up_right": 1073.0,
 "up_left": 1073.0, "up": 1119.0
}
const IDLE_VISIBLE_HEIGHT := {
 "down": 1430.0, "down_right": 1447.0, "right": 1373.0,
 "up_right": 1394.0, "up": 1396.0
}
const IDLE_FOOT := {
 "down": 1464.0, "down_right": 1491.0, "right": 1457.0,
 "up_right": 1436.0, "up": 1436.0
}
const IDLE_PIVOT_X := {
 "down": 528.0, "down_right": 524.0, "right": 510.0,
 "up_right": 540.5, "up": 521.5
}
const SKIN_GAIN := Vector3(1.015, 1.11, 1.08)
const SHIRT_GAIN := Vector3(1.020, 0.900, 0.920)

var facing: Vector2 = Vector2(1.0, 1.0).normalized()
var facing_name: String = "down_right"
var animation_state: String = "idle"
# Preserve compatibility with existing UI and earlier gameplay checks.
var using_imported_run: bool = true
var using_run8_uploaded: bool = true
var mobile_direction: Vector2 = Vector2.ZERO
var mobile_run_held: bool = false

# Approved FOOT walkable polygon: grass yard connects to bridge path;
# water/banks and built structures remain blocked by stage colliders.
var walk_polygon: PackedVector2Array = PackedVector2Array([
 Vector2(245,545), Vector2(325,509), Vector2(435,480), Vector2(545,463),
 Vector2(620,473), Vector2(665,496), Vector2(733,495), Vector2(807,515),
 Vector2(927,530), Vector2(1060,551),
 Vector2(1190,493), Vector2(1330,459), Vector2(1520,420),
 Vector2(1610,415), Vector2(1620,455), Vector2(1520,491),
 Vector2(1395,513), Vector2(1230,550), Vector2(1090,584),
 Vector2(1044,607), Vector2(936,598), Vector2(878,614),
 Vector2(800,630), Vector2(730,652), Vector2(652,648),
 Vector2(593,630), Vector2(511,622), Vector2(410,637),
 Vector2(312,623), Vector2(251,590)
])

func is_walkable_foot(point: Vector2) -> bool:
 return Geometry2D.is_point_in_polygon(point, walk_polygon)

func _ready() -> void:
 if not InputMap.has_action("run"):
  InputMap.add_action("run")
 var shift := InputEventKey.new()
 shift.physical_keycode = KEY_SHIFT
 if not InputMap.action_has_event("run", shift):
  InputMap.action_add_event("run", shift)
 var actor: AnimatedSprite2D = $AnimatedSprite2D
 actor.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
 # Offset is calibrated to the FOOT in the same convention as the RUN8 test.
 # A centered Sprite2D with a second manual offset would shift the pivot.
 actor.centered = false
 actor.position = Vector2.ZERO
 _detect_proportional_run()
 _setup_animations()
 _setup_color_material(actor)
 # Explicit shader state is needed even before the first movement input:
 # ShaderMaterial.get_shader_parameter() returns null for unset uniforms,
 # and native IDLE must always remain unaffected by RUN side color grading.
 _apply_color_state("down_right", "idle")
 _apply_visual_proportions("down_right", false)
 actor.flip_h = false
 actor.animation = "idle_down_right"
 actor.frame = 0
 actor.stop()
 print("LEMBAH ASRI MAIN: RUN8 normalized pack active: %s; legacy WALK+IDLE preserved; world_height=112px" % str(using_proportional_run))

func _detect_proportional_run() -> void:
 using_proportional_run = false
 proportional_run_bank = null
 if not ResourceLoader.exists(PROPORTIONAL_RUN_PATH):
  return
 var candidate := load(PROPORTIONAL_RUN_PATH) as SpriteFrames
 if candidate == null:
  push_warning("New proportional run resource failed to load; keeping current animation.")
  return
 for direction in DIRECTIONS:
  var key: String = "run_" + direction
  if not candidate.has_animation(key) or candidate.get_frame_count(key) < 2:
   push_warning("Incomplete new proportional RUN8 (" + key + "); keeping current animation.")
   return
 proportional_run_bank = candidate
 using_proportional_run = true


func _native_direction(heading: String) -> String:
 if heading == "left":
  return "right"
 if heading == "down_left":
  return "down_right"
 if heading == "up_left":
  return "up_right"
 return heading

func _idle_texture(origin: String) -> Texture2D:
 match origin:
  "right": return IDLE_RIGHT
  "down_right": return IDLE_FRONT_RIGHT
  "down": return IDLE_FRONT
  "up_right": return IDLE_BACK_RIGHT
  "up": return IDLE_BACK
 push_error("Missing original idle heading " + origin)
 return IDLE_FRONT

func _run_resource(origin: String) -> SpriteFrames:
 match origin:
  "right": return RUN_RIGHT
  "down_right": return RUN_FRONT_RIGHT
  "down": return RUN_FRONT
  "up_right": return RUN_BACK_RIGHT
  "up": return RUN_BACK
 push_error("Missing native run heading " + origin)
 return RUN_FRONT

func _original_run_textures(origin: String) -> Array[Texture2D]:
 var source: SpriteFrames = _run_resource(origin)
 var result: Array[Texture2D] = []
 if origin == "up_right":
  # Exact original edited Back Left/Right upload, all 21 frames, no retiming.
  for row_name in ["row_1", "row_2", "row_3"]:
   assert(source.has_animation(row_name), "Missing original Back diagonal row " + row_name)
   for i in range(source.get_frame_count(row_name)):
    result.append(source.get_frame_texture(row_name, i))
  assert(result.size() == 21)
 else:
  var rows := Array(source.get_animation_names())
  rows.sort()
  for row_name in rows:
   for i in range(source.get_frame_count(row_name)):
    result.append(source.get_frame_texture(row_name, i))
  if origin == "right":
   assert(result.size() == 26, "Original left/right upload must have 26 frames")
 return result

func _run_textures(origin: String) -> Array[Texture2D]:
 var source: Array[Texture2D] = _original_run_textures(origin)
 if origin == "right" or origin == "up_right":
  # User has explicitly locked FULL native cycles for side/rear diagonal.
  return source
 # Other four mirrored/nonmirrored directions retain the preview's 12-slot
 # cadence from their eight or eighteen source poses.
 var result: Array[Texture2D] = []
 for slot in range(12):
  var source_index: int = clampi(int(floor(float(slot) * float(source.size()) / 12.0)), 0, source.size()-1)
  result.append(source[source_index])
 return result

func _setup_animations() -> void:
 var bank := SpriteFrames.new()
 if bank.has_animation("default"):
  bank.remove_animation("default")
 for direction in DIRECTIONS:
  var origin: String = _native_direction(direction)
  var frames: Array[Texture2D] = _run_textures(origin)
  var count: int = frames.size()
  assert(count == (26 if origin == "right" else (21 if origin == "up_right" else 12)),
   "RUN8 main scene original frames must remain intact")
  for state in ["walk", "run"]:
   var key: String = state + "_" + direction
   bank.add_animation(key)
   bank.set_animation_loop(key, true)
   if state == "run" and using_proportional_run:
    # Use ALL normalized poses, including the already baked left directions.
    bank.set_animation_speed(key, 10.0)
    for frame_id in range(proportional_run_bank.get_frame_count(key)):
     bank.add_frame(key, proportional_run_bank.get_frame_texture(key, frame_id))
   else:
    # Preserve the pre-existing WALK cadence (and legacy RUN fallback).
    var fps: float = float(RUN_FPS_BY_DIR[direction]) if state == "run" else float(count) / 1.5
    bank.set_animation_speed(key, fps)
    for original_frame in frames:
     bank.add_frame(key, original_frame)
  var idle_key: String = "idle_" + direction
  bank.add_animation(idle_key)
  bank.set_animation_loop(idle_key, false)
  bank.set_animation_speed(idle_key, 1.0)
  bank.add_frame(idle_key, _idle_texture(origin))
 $AnimatedSprite2D.sprite_frames = bank

func _setup_color_material(actor: AnimatedSprite2D) -> void:
 # Same hue-selective side RUN correction as test, with opaque alpha mask;
 # other 6 RUN directions and all user-uploaded idle images remain untouched.
 var shader := Shader.new()
 shader.code = """
shader_type canvas_item;
render_mode unshaded;
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

func _apply_color_state(direction: String, state: String) -> void:
 var grade: ShaderMaterial = $AnimatedSprite2D.material as ShaderMaterial
 if grade == null:
  return
 grade.set_shader_parameter("skin_gain", SKIN_GAIN)
 grade.set_shader_parameter("shirt_gain", SHIRT_GAIN)
 grade.set_shader_parameter("grading_enabled", 1.0 if state != "idle" and direction in ["left", "right"] and not (state == "run" and using_proportional_run) else 0.0)

func _apply_visual_proportions(direction: String, is_moving: bool, new_run: bool = false) -> void:
 var actor: AnimatedSprite2D = $AnimatedSprite2D
 var origin: String = _native_direction(direction)
 var original_height: float = float(SOURCE_VISIBLE_HEIGHT[direction])
 var source_foot: float = float(SOURCE_FOOT_BASELINE[direction])
 var source_mid_x: float = 384.0
 if new_run:
  # Baked canonical 512x768 frames: identical source scale and foot pivot for all 8 directions.
  original_height = 640.0
  source_foot = 708.0
  source_mid_x = 256.0
 elif not is_moving:
  original_height = float(IDLE_VISIBLE_HEIGHT[origin])
  source_foot = float(IDLE_FOOT[origin])
  source_mid_x = float(IDLE_PIVOT_X[origin])
 var scale_factor: float = CHARACTER_HEIGHT_WORLD / original_height
 actor.scale = Vector2(scale_factor, scale_factor)
 actor.offset = Vector2(-source_mid_x, -source_foot)
 actor.position = Vector2.ZERO

func _nearest_eight_direction(direction: Vector2) -> String:
 return DIRECTIONS[posmod(int(round(direction.angle() / (PI / 4.0))), 8)]

func _set_animation(next_state: String, direction: String) -> void:
 var actor: AnimatedSprite2D = $AnimatedSprite2D
 var key: String = next_state + "_" + direction
 var has_changed: bool = actor.animation != key
 var previous_phase: float = 0.0
 var was_moving: bool = animation_state != "idle" and actor.is_playing()
 if has_changed and next_state != "idle" and was_moving:
  var previous_count: int = maxi(1, actor.sprite_frames.get_frame_count(actor.animation))
  previous_phase = fposmod((float(actor.frame) + actor.frame_progress) / float(previous_count), 1.0)
 if has_changed:
  actor.animation = key
  if next_state != "idle" and was_moving:
   var next_count: int = actor.sprite_frames.get_frame_count(key)
   var target: float = previous_phase * float(next_count)
   var new_frame: int = clampi(int(floor(target)), 0, next_count - 1)
   actor.set_frame_and_progress(new_frame, target - float(new_frame))
 if has_changed or animation_state != next_state:
  _apply_visual_proportions(direction, next_state != "idle", next_state == "run" and using_proportional_run)
  _apply_color_state(direction, next_state)
 actor.flip_h = direction in ["left", "down_left", "up_left"] and not (next_state == "run" and using_proportional_run)
 if next_state == "idle":
  actor.stop()
  actor.frame = 0
 elif not actor.is_playing():
  actor.play()
 animation_state = next_state

func _physics_process(_delta: float) -> void:
 var direction := Vector2.ZERO
 if Input.is_key_pressed(KEY_A) or Input.is_action_pressed("ui_left"):
  direction.x -= 1.0
 if Input.is_key_pressed(KEY_D) or Input.is_action_pressed("ui_right"):
  direction.x += 1.0
 if Input.is_key_pressed(KEY_W) or Input.is_action_pressed("ui_up"):
  direction.y -= 1.0
 if Input.is_key_pressed(KEY_S) or Input.is_action_pressed("ui_down"):
  direction.y += 1.0
 if direction.length_squared() < 0.001:
  direction = mobile_direction.limit_length(1.0)
 else:
  direction = direction.normalized()

 var wants_to_move: bool = direction.length_squared() > 0.001
 var running: bool = wants_to_move and (mobile_run_held or Input.is_key_pressed(KEY_SHIFT) or Input.is_action_pressed("run"))
 velocity = direction * (run_speed if running else walk_speed)

 var before: Vector2 = global_position
 move_and_slide()
 var attempted: Vector2 = global_position
 if not is_walkable_foot(attempted):
  var horizontal := Vector2(attempted.x, before.y)
  var vertical := Vector2(before.x, attempted.y)
  if is_walkable_foot(horizontal):
   global_position = horizontal
  elif is_walkable_foot(vertical):
   global_position = vertical
  else:
   global_position = before

 if wants_to_move:
  facing = direction
  facing_name = _nearest_eight_direction(direction)
 var actual_movement: bool = global_position.distance_to(before) > 0.001
 var next_state: String = ("run" if running else "walk") if wants_to_move and actual_movement else "idle"
 _set_animation(next_state, facing_name)
