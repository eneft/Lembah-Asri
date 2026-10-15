extends Node2D
## Native Camera2D, original PSD pixel coordinates, no 3D transforms.
## Preserves stage1/PSD Camera3D and every original source asset unchanged.
const CANVAS_SIZE := Vector2(1672.0, 941.0)
const WALKABLE_LAYOUT = preload("res://scripts/psd_collision_layout.gd")
const DIRECTIONS := ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]
const FOOT_CLEARANCE_PX := 9.0
const MAX_MOVE_STEP_PX := 6.0
const LIGHTING_NAMES := ["06:00 PAGI", "12:00 SIANG", "17:00 SORE", "21:00 MALAM"]
const LIGHTING_TINTS := [
 Color(1.0, 0.88, 0.74), Color.WHITE,
 Color(1.0, 0.74, 0.59), Color(0.37, 0.51, 0.78)
]
const LIGHTING_STRENGTHS := [0.31, 0.0, 0.45, 0.81]
const PORCH_GLOW_STRENGTHS := [0.0, 0.0, 0.075, 0.26]
const PORCH_LIGHT_PX := Vector2(780.0, 292.0)

@export_group("Movement")
@export var walk_speed_px: float = 220.0
@export var run_speed_px: float = 325.0
@export var camera_smoothing: float = 4.0
# 100% original canvas means no camera travel. Crop modestly for true
# follow movement; 1.45x retains the homestead's painted perspective.
@export_range(1.10, 1.85, 0.05) var camera_follow_zoom: float = 1.45
@export_group("Character Painted Perspective")
@export_range(0.7, 1.0, 0.01) var far_character_scale: float = 0.88
@export_range(0.9, 1.1, 0.01) var middle_character_scale: float = 1.0
@export_range(1.0, 1.4, 0.01) var near_character_scale: float = 1.18
@export var far_reference_y: float = 360.0
@export var middle_reference_y: float = 570.0
@export var near_reference_y: float = 810.0
@export var bridge_scale_bonus: float = 0.07
@export var bridge_blend_start_x: float = 1070.0
@export var bridge_blend_full_x: float = 1320.0
@export var bridge_blend_start_y: float = 480.0
@export var bridge_blend_full_y: float = 625.0
@export_group("Painted Environment Lighting")
@export_range(0, 3, 1) var start_lighting_preset: int = 1
@export_range(0.25, 8.0, 0.25) var lighting_transition_speed: float = 2.25

@onready var player: CharacterBody2D = $Run8Player
@onready var visual: AnimatedSprite2D = $Run8Player/AnimatedSprite2D
@onready var shadow: AnimatedSprite2D = $ProjectedShadow
@onready var camera: Camera2D = $Camera2D
@onready var collision_container: Node2D = $CollisionBodies
@onready var collision_visual: Node2D = $WalkablePolygons
@onready var weather: Node2D = $RainWeather
@onready var mobile: Control = $TouchOverlay/TouchControls
@onready var lighting_picker: Control = $LightingControls/LightingPicker
@onready var atmosphere: ColorRect = $LightingOverlay/Atmosphere
@onready var porch_light: ColorRect = $LightingOverlay/PorchGlow

var psd_ready: bool = false
var walkable_regions: Dictionary = {}
var touch_direction: Vector2 = Vector2.ZERO
var touch_run: bool = false
var lighting_preset_index: int = 1
var lighting_target_tint: Color = Color.WHITE
var lighting_current_tint: Color = Color.WHITE
var lighting_target_strength: float = 0.0
var lighting_current_strength: float = 0.0
var lighting_target_glow: float = 0.0
var lighting_current_glow: float = 0.0

func _ready() -> void:
 psd_ready = true
 var background: Sprite2D = $Background
 if background.texture == null or background.texture.get_size() != CANVAS_SIZE:
  psd_ready = false
  push_error("PSD CAMERA2D: original single background missing or wrong dimensions")
 # Only one scenery sprite in this scene. The separated PSD components
 # remain available in the repo but are not layered on this Camera2D stage.
 walkable_regions = WALKABLE_LAYOUT.regions()
 _build_native_collision()
 collision_visual.set("walkable_regions", walkable_regions)
 collision_visual.set("clearance_radius", FOOT_CLEARANCE_PX)
 # Explicit global z ordering, independent of scene-tree sibling positions.
 # Back rain above background, front rain and impacts above character.
 for key in {"RainBack":1, "RainFront":10, "GroundPuddles":1,
  "GroundSplashes":7, "RiverRipples":6, "FootstepSplashes":8}:
  var item: Node2D = weather.get_node_or_null(key) as Node2D
  if item != null:
   item.z_index = int({"RainBack":1, "RainFront":10, "GroundPuddles":1,
    "GroundSplashes":7, "RiverRipples":6, "FootstepSplashes":8}[key])
 _configure_camera()
 get_viewport().size_changed.connect(_configure_camera)
 _sync_visual_scale()
 mobile.move_changed.connect(_on_touch_move)
 mobile.run_changed.connect(_on_touch_run)
 lighting_picker.connect("preset_delta", Callable(self, "_cycle_lighting_preset"))
 _set_lighting_preset(start_lighting_preset, true)
 if not _is_walkable_foot(player.position):
  push_error("PSD CAMERA2D: player spawn outside original walk polygon")
 print("LEMBAH ASRI PSD CAMERA2D PREVIEW READY: ONE original 1672x941 background, anchored RUN8/IDLE8, native collision, weather, lighting and shadow")

func _build_native_collision() -> void:
 # Geometry2D merges intersecting polygon footprints BEFORE constructing
 # segmented physics edges; otherwise bridge/yard seams turn into invisible walls.
 var islands: Array[PackedVector2Array] = []
 for label in walkable_regions:
  var proposed: PackedVector2Array = walkable_regions[label]
  var pending: Array[PackedVector2Array] = [proposed]
  var i: int = 0
  while i < islands.size():
   var changed: bool = false
   for poly in pending:
    var overlap: Array[PackedVector2Array] = Geometry2D.intersect_polygons(islands[i], poly)
    if not overlap.is_empty():
     pending.erase(poly)
     var merged: Array[PackedVector2Array] = Geometry2D.merge_polygons(islands[i], poly)
     for piece in merged:
      pending.append(piece)
     islands.remove_at(i)
     changed = true
     break
   if not changed:
    i += 1
  for polygon in pending:
   islands.append(polygon)
 for idx in range(islands.size()):
  var land: StaticBody2D = StaticBody2D.new()
  land.name = "PlayableBoundary_%d" % idx
  land.collision_layer = 2
  land.collision_mask = 0
  var shape: CollisionPolygon2D = CollisionPolygon2D.new()
  shape.name = "WalkableEdge"
  shape.build_mode = CollisionPolygon2D.BUILD_SEGMENTS
  shape.polygon = islands[idx]
  land.add_child(shape)
  collision_container.add_child(land)
 print("PSD CAMERA2D COLLISION READY: ", islands.size(), " merged native StaticBody2D boundary polygons")

func _walkable_pixel(foot: Vector2) -> bool:
 if foot.x < 0.0 or foot.y < 0.0 or foot.x >= CANVAS_SIZE.x or foot.y >= CANVAS_SIZE.y:
  return false
 for key in walkable_regions:
  if Geometry2D.is_point_in_polygon(foot, walkable_regions[key]):
   return true
 return false

func _is_walkable_foot(foot: Vector2) -> bool:
 for delta in [Vector2.ZERO, Vector2(FOOT_CLEARANCE_PX, 0.0),
  Vector2(-FOOT_CLEARANCE_PX, 0.0), Vector2(0.0, FOOT_CLEARANCE_PX),
  Vector2(0.0, -FOOT_CLEARANCE_PX)]:
  if not _walkable_pixel(foot + delta):
   return false
 return true

func _move_foot_on_map(origin: Vector2, travel: Vector2) -> Vector2:
 # The same swept-circle safety limit as the Camera3D prototype, now in native
 # image coordinates. CircleShape2D + merged StaticBody2D provide physics.
 var steps: int = maxi(1, ceili(travel.length() / MAX_MOVE_STEP_PX))
 var step: Vector2 = travel / float(steps)
 var current: Vector2 = origin
 for i in range(steps):
  var next: Vector2 = current + step
  if _is_walkable_foot(next):
   current = next
  else:
   var along_x: Vector2 = current + Vector2(step.x, 0.0)
   if _is_walkable_foot(along_x):
    current = along_x
   var along_y: Vector2 = current + Vector2(0.0, step.y)
   if _is_walkable_foot(along_y):
    current = along_y
 return current

func _read_motion() -> Vector2:
 var input: Vector2 = Vector2.ZERO
 if Input.is_action_pressed("ui_left") or Input.is_physical_key_pressed(KEY_A):
  input.x -= 1.0
 if Input.is_action_pressed("ui_right") or Input.is_physical_key_pressed(KEY_D):
  input.x += 1.0
 if Input.is_action_pressed("ui_up") or Input.is_physical_key_pressed(KEY_W):
  input.y -= 1.0
 if Input.is_action_pressed("ui_down") or Input.is_physical_key_pressed(KEY_S):
  input.y += 1.0
 if input.length_squared() < 0.001:
  input = touch_direction
 return input.normalized() if input.length_squared() > 0.001 else Vector2.ZERO

func _physics_process(delta: float) -> void:
 var motion: Vector2 = _read_motion()
 var origin: Vector2 = player.position
 if motion.length_squared() < 0.001:
  player.velocity = Vector2.ZERO
  if str(player.get("animation_state")) != "idle":
   player.call("set_idle_direction", str(player.get("facing")))
  return
 var running: bool = touch_run or Input.is_key_pressed(KEY_SHIFT)
 var speed: float = run_speed_px if running else walk_speed_px
 var safe_goal: Vector2 = _move_foot_on_map(origin, motion * speed * minf(delta, 0.09))
 player.velocity = (safe_goal - origin) / maxf(0.0001, delta)
 player.move_and_slide()
 if not _is_walkable_foot(player.position):
  player.position = origin
  player.velocity = Vector2.ZERO
 var moved: bool = player.position.distance_squared_to(origin) > 0.0025
 var octant: int = posmod(int(round(motion.angle() / (PI * 0.25))), 8)
 if moved:
  player.call("set_run_direction", DIRECTIONS[octant])
 else:
  player.call("set_idle_direction", str(player.get("facing")))
 weather.call("register_footstep", player.position, moved)

func _character_depth_multiplier(foot_pixel: Vector2) -> float:
 var factor: float
 if foot_pixel.y <= middle_reference_y:
  factor = lerpf(far_character_scale, middle_character_scale,
   smoothstep(far_reference_y, middle_reference_y, foot_pixel.y))
 else:
  factor = lerpf(middle_character_scale, near_character_scale,
   smoothstep(middle_reference_y, near_reference_y, foot_pixel.y))
 var weight: float = smoothstep(bridge_blend_start_x, bridge_blend_full_x, foot_pixel.x)
 weight *= smoothstep(bridge_blend_start_y, bridge_blend_full_y, foot_pixel.y)
 return clampf(factor + bridge_scale_bonus * weight, far_character_scale, near_character_scale + bridge_scale_bonus)

func _sync_visual_scale() -> void:
 var density: float = float(player.get("raster_density"))
 var base_scale: float = float(player.get("character_height_px")) / (640.0 * density)
 visual.scale = Vector2.ONE * base_scale * _character_depth_multiplier(player.position)

func _configure_camera() -> void:
 var viewport_size: Vector2 = get_viewport().get_visible_rect().size
 # Fit source artwork to both viewport axes, then zoom in enough that the
 # playfield exceeds the viewport. Camera boundaries can now move in X & Y.
 var fit_zoom: float = minf(viewport_size.x / CANVAS_SIZE.x,
  viewport_size.y / CANVAS_SIZE.y)
 camera.zoom = Vector2.ONE * fit_zoom * camera_follow_zoom
 camera.position_smoothing_speed = camera_smoothing
 _move_camera_to_player(true)

func _move_camera_to_player(instant: bool = false) -> void:
 var view: Vector2 = get_viewport().get_visible_rect().size / camera.zoom
 var half: Vector2 = view * 0.5
 var low: Vector2 = half
 var high: Vector2 = CANVAS_SIZE - half
 var target: Vector2 = Vector2(
  clampf(player.position.x, minf(low.x, high.x), maxf(low.x, high.x)),
  clampf(player.position.y, minf(low.y, high.y), maxf(low.y, high.y))
 )
 if high.x < low.x:
  target.x = CANVAS_SIZE.x * 0.5
 if high.y < low.y:
  target.y = CANVAS_SIZE.y * 0.5
 camera.position = target
 if instant:
  camera.reset_smoothing()

func _process(delta: float) -> void:
 _sync_visual_scale()
 _move_camera_to_player()
 _tick_lighting(delta)
 _sync_porch_glow()
 if collision_visual.visible:
  collision_visual.set("player_foot", player.position)
  collision_visual.queue_redraw()

func _sync_porch_glow() -> void:
 var viewport_size: Vector2 = get_viewport().get_visible_rect().size
 var screen_pt: Vector2 = get_viewport().get_canvas_transform() * PORCH_LIGHT_PX
 var glow: ShaderMaterial = porch_light.material as ShaderMaterial
 if glow != null:
  glow.set_shader_parameter("origin_uv", screen_pt / viewport_size)
  glow.set_shader_parameter("radius_uv", Vector2(175.0, 115.0) * camera.zoom / viewport_size)

func _set_lighting_preset(index: int, instant: bool = false) -> void:
 lighting_preset_index = posmod(index, LIGHTING_NAMES.size())
 lighting_target_tint = LIGHTING_TINTS[lighting_preset_index]
 lighting_target_strength = LIGHTING_STRENGTHS[lighting_preset_index]
 lighting_target_glow = PORCH_GLOW_STRENGTHS[lighting_preset_index]
 lighting_picker.call("set_lighting_label", LIGHTING_NAMES[lighting_preset_index])
 if instant:
  lighting_current_tint = lighting_target_tint
  lighting_current_strength = lighting_target_strength
  lighting_current_glow = lighting_target_glow
 _apply_lighting_material()

func _cycle_lighting_preset(step: int) -> void:
 _set_lighting_preset(lighting_preset_index + step)

func _apply_lighting_material() -> void:
 var grade: ShaderMaterial = atmosphere.material as ShaderMaterial
 var glow: ShaderMaterial = porch_light.material as ShaderMaterial
 grade.set_shader_parameter("scene_tint",
  Vector3(lighting_current_tint.r, lighting_current_tint.g, lighting_current_tint.b))
 grade.set_shader_parameter("atmosphere", lighting_current_strength)
 glow.set_shader_parameter("glow_strength", lighting_current_glow)
 porch_light.visible = lighting_current_glow > 0.0005

func _tick_lighting(delta: float) -> void:
 var weight: float = 1.0 - exp(-lighting_transition_speed * maxf(0.0, delta))
 lighting_current_tint = lighting_current_tint.lerp(lighting_target_tint, weight)
 lighting_current_strength = lerpf(lighting_current_strength, lighting_target_strength, weight)
 lighting_current_glow = lerpf(lighting_current_glow, lighting_target_glow, weight)
 _apply_lighting_material()

func _on_touch_move(direction: Vector2) -> void:
 touch_direction = direction

func _on_touch_run(active: bool) -> void:
 touch_run = active

func _unhandled_input(event: InputEvent) -> void:
 if event is InputEventKey and event.pressed and not event.echo:
  if event.keycode == KEY_R:
   weather.call("toggle_rain")
  elif event.keycode == KEY_C:
   collision_visual.visible = not collision_visual.visible
   collision_visual.queue_redraw()
  elif event.keycode == KEY_L:
   _cycle_lighting_preset(-1 if event.shift_pressed else 1)
  else:
   return
  get_viewport().set_input_as_handled()
