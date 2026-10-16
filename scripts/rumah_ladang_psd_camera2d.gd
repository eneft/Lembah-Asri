extends Node2D
## Native Camera2D, original PSD pixel coordinates, no 3D transforms.
## Preserves stage1/PSD Camera3D and every original source asset unchanged.
const CANVAS_SIZE := Vector2(1672.0, 941.0)
const PSD_COLLISION_JSON := "res://assets/art/psd_layered_scene/collision_polygons.json"
const PSD_MANIFEST_JSON := "res://assets/art/psd_layered_scene/manifest.json"
const NATIVE_SURFACES = preload("res://scripts/weather/native_surface_zones.gd")
const BRIDGE_WET_SHADER = preload("res://shaders/psd_bridge_wetness.gdshader")
const WEATHER_NAMES := ["CERAH", "MENDUNG", "HUJAN RINGAN", "HUJAN DERAS", "BADAI"]
const WEATHER_TINTS := [
 Color.WHITE, Color(0.71, 0.75, 0.78),
 Color(0.64, 0.71, 0.78), Color(0.55, 0.64, 0.73),
 Color(0.42, 0.53, 0.66)]
const PRECIPITATION_LEVELS := [0.0, 0.0, 0.48, 1.0, 1.22]
const WIND_LEVELS := [0.0, 0.13, 0.22, 0.40, 0.82]
const DIRECTIONS := ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]
const FOOT_CLEARANCE_PX := 9.0
# Additional close-fitting foot barrier under the left wooden fence by
# the banana trees. Extends the authored red-mask contour across its
# unpainted southern gap; no changes to the original Photoshop polygons.
const BANANA_FENCE_GUARD_VERTICES := [
 Vector2(65, 462), Vector2(292, 613),
 Vector2(265, 652), Vector2(46, 496)
]
const MAX_MOVE_STEP_PX := 6.0
const LIGHTING_NAMES := ["06:00 PAGI", "12:00 SIANG", "17:00 SORE", "21:00 MALAM"]
const LIGHTING_TINTS := [
 Color(1.0, 0.88, 0.74), Color.WHITE,
 Color(1.0, 0.74, 0.59), Color(0.37, 0.51, 0.78)
]
const LIGHTING_STRENGTHS := [0.31, 0.0, 0.45, 0.81]
const PORCH_GLOW_STRENGTHS := [0.0, 0.0, 0.075, 0.26]
const PORCH_LIGHT_PX := Vector2(780.0, 292.0)
const FRONT_DOOR_FOOT := Vector2(645.0, 405.0)
const FRONT_DOOR_REACH: float = 145.0

@export_group("Movement")
@export var walk_speed_px: float = 220.0
@export var run_speed_px: float = 325.0
@export var camera_smoothing: float = 4.0
# 100% original canvas means no camera travel. Crop modestly for true
# follow movement; 1.45x retains the homestead's painted perspective.
@export_range(1.10, 1.85, 0.05) var camera_follow_zoom: float = 1.45
# Mobile zoom keeps original image proportions; viewport follows player.
@export_range(1.0, 1.5, 0.01) var mobile_follow_zoom: float = 1.12
@export var force_mobile_fit_for_testing: bool = false
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
@export_group("Manual Weather and Storm")
@export_range(0, 4, 1) var start_weather_mode: int = 3
@export_range(0.5, 8.0, 0.25) var weather_transition_speed: float = 2.4
@export_range(7.0, 40.0, 1.0) var lightning_min_interval: float = 10.0

@onready var psd_layer_stack: Node2D = $PSDLayerStack
@onready var bridge_sprite: Sprite2D = $PSDLayerStack/WoodenBridge
@onready var house_door: Node2D = $HouseFrontDoor
@onready var player: CharacterBody2D = $Run8Player
@onready var visual: AnimatedSprite2D = $Run8Player/AnimatedSprite2D
@onready var shadow: AnimatedSprite2D = $ProjectedShadow
@onready var camera: Camera2D = $Camera2D
@onready var collision_container: Node2D = $CollisionBodies
@onready var collision_visual: Node2D = $WalkablePolygons
@onready var weather: Node2D = $RainWeather
@onready var mobile: Control = $TouchOverlay/TouchControls
@onready var rpg_hud: Control = $RPGHUD/HUDCanvas
@onready var lighting_picker: Control = $LightingControls/LightingPicker
@onready var atmosphere: ColorRect = $LightingOverlay/Atmosphere
@onready var porch_light: ColorRect = $LightingOverlay/PorchGlow
@onready var weather_picker: Control = $LightingControls/WeatherPicker
@onready var cloud_tint: ColorRect = $WeatherAtmosphere/CloudTint
@onready var lightning_flash: ColorRect = $StormLightning/Flash
@onready var lightning_bolt: Node2D = $StormLightning/LightningBolt
@onready var river_current: Node2D = $AnimatedRiverCurrent
@onready var wind_gusts: Node2D = $StormWindGusts

var psd_ready: bool = false
var touch_pre_modal_visible: bool = false
var bridge_wetness_current: float = 0.0
var walkable_regions: Dictionary = {}
# Additional known open-water exclusion; keeps authored PSD red polygons intact.
# Cached once; never rebuild polygon geometry during character movement.
var river_no_walk_regions: Array[PackedVector2Array] = []
var supplemental_barriers: Array[PackedVector2Array] = []
var touch_direction: Vector2 = Vector2.ZERO
var touch_run: bool = false
var lighting_preset_index: int = 1
var lighting_target_tint: Color = Color.WHITE
var lighting_current_tint: Color = Color.WHITE
var lighting_target_strength: float = 0.0
var lighting_current_strength: float = 0.0
var lighting_target_glow: float = 0.0
var lighting_current_glow: float = 0.0
var weather_mode_index: int = 3
var weather_tint_current: Color = Color.WHITE
var weather_tint_target: Color = Color.WHITE
var weather_strength_current: float = 0.0
var weather_strength_target: float = 0.0
var wind_clock: float = 0.0
var storm_clock: float = 0.0
var next_lightning_time: float = 10.0
var lightning_elapsed: float = -10.0
var lightning_active: bool = false
var storm_rng := RandomNumberGenerator.new()

func _ready() -> void:
 psd_ready = true
 var background: Sprite2D = $Background
 if background.texture == null or background.texture.get_size() != CANVAS_SIZE:
  psd_ready = false
  push_error("PSD CAMERA2D: authentic layered PSD background missing")
 if psd_layer_stack.get_child_count() != 11:
  psd_ready = false
  push_error("PSD CAMERA2D: expected precisely ten authentic editable overlay objects")
 for art_node in psd_layer_stack.get_children():
  var sprite: Sprite2D = art_node as Sprite2D
  if sprite == null or sprite.texture == null or sprite.centered:
   psd_ready = false
   push_error("PSD CAMERA2D: missing or incorrectly positioned editable PSD sprite")
 _apply_psd_layer_manifest()
 # A material changes wood shading only; original bridge art, layer order,
 # pivot, collision mask and scene coordinates are intentionally unchanged.
 var bridge_material := ShaderMaterial.new()
 bridge_material.shader = BRIDGE_WET_SHADER
 bridge_sprite.material = bridge_material
 _load_psd_authored_collision()
 # Only supplementary guard in this scene: the left banana fence's lower
 # painted edge. The original PSD mask remains authoritative everywhere else.
 supplemental_barriers = [PackedVector2Array(BANANA_FENCE_GUARD_VERTICES)]
 river_no_walk_regions = NATIVE_SURFACES.river_water()
 if psd_ready:
  _build_native_collision()
 collision_visual.set("walkable_regions", walkable_regions)
 collision_visual.set("clearance_radius", FOOT_CLEARANCE_PX)
 # The single-baked PNG contains roof/rocks/bridge: opt into conservative
 # soil/water footprint masks without changing shared legacy RainWeather.
 # Blocked polygons come directly from the latest Photoshop Collision mask.
 # Reject FULL puddle footprints touching house, fence, stone wall or river.
 var puddle_obstacles: Array[PackedVector2Array] = []
 for blocked in walkable_regions.values():
  puddle_obstacles.append(blocked)
 for barrier in supplemental_barriers:
  puddle_obstacles.append(barrier)
 var unused_fixed_puddles: Array[Vector2] = []
 weather.call("configure_native2d_surfaces",
  NATIVE_SURFACES.bare_soil(),
  unused_fixed_puddles,
  NATIVE_SURFACES.river_water(),
  puddle_obstacles,
  NATIVE_SURFACES.rain_contact_soil())
 # Explicit global z ordering, independent of scene-tree sibling positions.
 # Back rain above background, front rain and impacts above character.
 for key in {"RainBack":3, "RainFront":30, "GroundPuddles":1,
  "GroundSplashes":7, "RiverRipples":7, "FootstepSplashes":8, "BridgeSplashes":15}:
  var item: Node2D = weather.get_node_or_null(key) as Node2D
  if item != null:
   item.z_index = int({"RainBack":3, "RainFront":30, "GroundPuddles":1,
    "GroundSplashes":7, "RiverRipples":7, "FootstepSplashes":8, "BridgeSplashes":15}[key])
 # Mobile browser only: let the Godot canvas use the real screen aspect.
 # The actual 1672x941 painted scene remains a uniformly scaled inset.
 # Main Camera3D and desktop project settings are unaffected.
 get_viewport().size_changed.connect(_configure_camera)
 if _is_mobile_screen():
  get_window().content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
 _configure_camera()
 _sync_visual_scale()
 mobile.move_changed.connect(_on_touch_move)
 mobile.run_changed.connect(_on_touch_run)
 mobile.interact_requested.connect(_on_action_requested)
 mobile.action_enabled = false
 rpg_hud.call("bind_player", player)
 rpg_hud.call("set_area", "RUMAH MASA KECIL")
 rpg_hud.call("set_objective", "Jelajahi rumah masa kecilmu")
 rpg_hud.connect("weather_delta", Callable(self, "_cycle_weather_mode"))
 rpg_hud.connect("lighting_delta", Callable(self, "_cycle_lighting_preset"))
 rpg_hud.connect("modal_changed", Callable(self, "_on_hud_modal_changed"))
 # Existing manual weather/time logic remains. The new RPG panel replaces
 # the two old floating debug widgets without changing their signals.
 lighting_picker.visible = false
 weather_picker.visible = false
 lighting_picker.connect("preset_delta", Callable(self, "_cycle_lighting_preset"))
 _set_lighting_preset(start_lighting_preset, true)
 weather_picker.connect("weather_delta", Callable(self, "_cycle_weather_mode"))
 storm_rng.seed = 20261015
 _set_weather_mode(start_weather_mode, true)
 if not _is_walkable_foot(player.position):
  push_error("PSD CAMERA2D: player spawn outside original walk polygon")
 print("LEMBAH ASRI PSD CAMERA2D PREVIEW READY: %d AUTHENTIC PSD LAYERS, %d red-authored collision solids, RUN8+IDLE8 at Photoshop marker, Camera2D and weather" % [psd_layer_stack.get_child_count() + 1, walkable_regions.size()])

func _apply_psd_layer_manifest() -> void:
 # The PSD itself defines the draw order. Never hardcode which foliage or
 # fence goes before/after the hero: each Photoshop edit may change order.
 var raw: String = FileAccess.get_file_as_string(PSD_MANIFEST_JSON)
 var manifest: Variant = JSON.parse_string(raw)
 if not (manifest is Dictionary):
  psd_ready = false
  push_error("PSD CAMERA2D: missing layer manifest")
  return
 var layers: Array = manifest.get("layers", [])
 if layers.size() != psd_layer_stack.get_child_count() + 1 or layers.is_empty():
  psd_ready = false
  push_error("PSD CAMERA2D: scene artwork count does not match Photoshop manifest")
  return
 var art_by_file: Dictionary = {}
 for child in psd_layer_stack.get_children():
  var sprite: Sprite2D = child as Sprite2D
  if sprite == null or sprite.texture == null:
   psd_ready = false
   return
  art_by_file[sprite.texture.resource_path.get_file()] = sprite
 var seen: Dictionary = {}
 for layer_data in layers:
  if not (layer_data is Dictionary):
   psd_ready = false
   return
  var filename: String = str(layer_data.get("filename", ""))
  var coordinates: Array = layer_data.get("bbox", [])
  var source_order: int = int(layer_data.get("source_order", -1))
  if coordinates.size() != 4 or source_order < 0 or seen.has(source_order):
   psd_ready = false
   push_error("PSD CAMERA2D: invalid or duplicate Photoshop layer metadata")
   return
  seen[source_order] = true
  var offset := Vector2(float(coordinates[0]), float(coordinates[1]))
  var expected_size := Vector2(float(coordinates[2]) - float(coordinates[0]), float(coordinates[3]) - float(coordinates[1]))
  var target: Sprite2D
  if filename == "00_background.png":
   target = $Background
   if source_order != 0:
    psd_ready = false
    push_error("PSD CAMERA2D: Background must remain the bottom PSD layer")
    return
  else:
   target = art_by_file.get(filename) as Sprite2D
  if target == null or target.texture == null or target.texture.get_size() != expected_size:
   psd_ready = false
   push_error("PSD CAMERA2D: PSD layer texture missing/mismatched for " + filename)
   return
  target.position = offset
  target.z_index = source_order * 2
  target.visible = bool(layer_data.get("visible", true))
 var marker_order: int = int(manifest.get("hero_marker_source_order", -1))
 if marker_order < 1 or seen.has(marker_order):
  psd_ready = false
  push_error("PSD CAMERA2D: character placeholder order absent/overlaps image")
  return
 # Shadows sit immediately below the player, with source ordering unchanged.
 player.z_index = marker_order * 2
 shadow.z_index = player.z_index - 1
 $FootContactShadow.z_index = player.z_index - 1
 print("PSD LAYER STACK READY: Background bottom; %d overlays and player at Photoshop source order %d" % [art_by_file.size(), marker_order])

func _load_psd_authored_collision() -> void:
 # Red translucent pixels from the author's Photoshop Collision group are
 # impassable SOLIDS, not the green legacy walkable polygons. Exported contours
 # are aligned with exactly the same 1672x941 Photoshop image coordinates.
 var raw: String = FileAccess.get_file_as_string(PSD_COLLISION_JSON)
 var parsed: Variant = JSON.parse_string(raw)
 if not (parsed is Dictionary):
  push_error("PSD CAMERA2D: authored Collision mask JSON missing or invalid")
  psd_ready = false
  return
 if parsed.get("type", "") != "solid_blocked":
  push_error("PSD CAMERA2D: Collision Photoshop mask is not a blocked zone")
  psd_ready = false
  return
 var regions: Array = parsed.get("polygons", [])
 if regions.is_empty() or regions.size() > 128:
  push_error("PSD CAMERA2D: Photoshop Collision layer has no valid solid areas or too many")
  psd_ready = false
  return
 if int(parsed.get("obstacle_count", regions.size())) != regions.size():
  push_error("PSD CAMERA2D: Photoshop Collision count inconsistent with mask metadata")
  psd_ready = false
  return
 walkable_regions.clear()
 for i in range(regions.size()):
  var points := PackedVector2Array()
  for coordinate in regions[i]:
   points.append(Vector2(float(coordinate[0]), float(coordinate[1])))
  if points.size() < 3:
   psd_ready = false
   push_error("PSD CAMERA2D: empty Photoshop Collision polygon")
   return
  walkable_regions["PSD BLOCK %02d" % i] = points
 var marker: Array = parsed.get("hero_spawn_foot", [])
 if marker.size() == 2:
  player.position = Vector2(float(marker[0]), float(marker[1]))
 print("PSD NATIVE2D AUTHOR COLLISION READY: %d masked obstacles; hero foot=%s" % [walkable_regions.size(), player.position])

func _build_native_collision() -> void:
 # Solid blocked areas: move_and_slide() now collides with exactly the authored
 # red shape. Never transform the art or infer an arbitrary rectangle.
 for key in walkable_regions:
  var obstacle := StaticBody2D.new()
  obstacle.name = str(key).replace(" ", "_")
  obstacle.collision_layer = 2
  obstacle.collision_mask = 0
  var shape := CollisionPolygon2D.new()
  shape.name = "PSD_RedBlockedArea"
  shape.build_mode = CollisionPolygon2D.BUILD_SOLIDS
  shape.polygon = walkable_regions[key]
  obstacle.add_child(shape)
  collision_container.add_child(obstacle)
 # An explicit real collider supplements the 8 unchanged PSD solids,
 # preventing diagonal motion or physics sliding through banana fence rails.
 for i in range(supplemental_barriers.size()):
  var guard := StaticBody2D.new()
  guard.name = "LeftBananaFenceGuard"
  guard.collision_layer = 2
  guard.collision_mask = 0
  var guard_shape := CollisionPolygon2D.new()
  guard_shape.name = "SupplementalFenceFootprint"
  guard_shape.build_mode = CollisionPolygon2D.BUILD_SOLIDS
  guard_shape.polygon = supplemental_barriers[i]
  guard.add_child(guard_shape)
  collision_container.add_child(guard)
 # Close edges outside the Photoshop 1672x941 canvas.
 var border := StaticBody2D.new()
 border.name = "CanvasBoundary"
 border.collision_layer = 2
 border.collision_mask = 0
 var loop := CollisionPolygon2D.new()
 loop.name = "CanvasEdge"
 loop.build_mode = CollisionPolygon2D.BUILD_SEGMENTS
 loop.polygon = PackedVector2Array([
  Vector2.ZERO, Vector2(CANVAS_SIZE.x, 0.0),
  CANVAS_SIZE, Vector2(0.0, CANVAS_SIZE.y)
 ])
 border.add_child(loop)
 collision_container.add_child(border)
 print("PSD CAMERA2D COLLISION READY: %d original red solids + outer boundary" % walkable_regions.size())

func _walkable_pixel(foot: Vector2) -> bool:
 if foot.x < 0.0 or foot.y < 0.0 or foot.x >= CANVAS_SIZE.x or foot.y >= CANVAS_SIZE.y:
  return false
 # A player must never step on painted water away from the bridge deck.
 # River masks are physically excluded even when the PSD solid mask has
 # no red paint there. The wooden bridge itself remains fully traversable.
 for water_region in river_no_walk_regions:
  if Geometry2D.is_point_in_polygon(foot, water_region):
   return false
 # Paired to the real static-body guard; swept-foot checks use identical
 # geometry so the character cannot clip the fence on low-FPS mobile.
 for fence_region in supplemental_barriers:
  if Geometry2D.is_point_in_polygon(foot, fence_region):
   return false
 for key in walkable_regions:
  if Geometry2D.is_point_in_polygon(foot, walkable_regions[key]):
   return false
 return true

func _is_walkable_foot(foot: Vector2) -> bool:
 # Sweep a circle-foot with clearance from authored Photoshop edges.
 for delta in [Vector2.ZERO, Vector2(FOOT_CLEARANCE_PX,0),
  Vector2(-FOOT_CLEARANCE_PX,0), Vector2(0,FOOT_CLEARANCE_PX),
  Vector2(0,-FOOT_CLEARANCE_PX)]:
  if not _walkable_pixel(foot+delta):
   return false
 return true

func _move_foot_on_map(origin: Vector2, travel: Vector2) -> Vector2:
 var steps: int = maxi(1,ceili(travel.length()/MAX_MOVE_STEP_PX))
 var step: Vector2 = travel / float(steps)
 var current: Vector2 = origin
 for i in range(steps):
  var proposed: Vector2 = current + step
  if _is_walkable_foot(proposed):
   current = proposed
   continue
  var x_only: Vector2 = current + Vector2(step.x,0)
  if _is_walkable_foot(x_only):
   current = x_only
  var y_only: Vector2 = current + Vector2(0,step.y)
  if _is_walkable_foot(y_only):
   current = y_only
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
 if bool(rpg_hud.call("is_modal_open")):
  player.velocity = Vector2.ZERO
  if str(player.get("animation_state")) != "idle":
   player.call("set_idle_direction", str(player.get("facing")))
  return
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

func _is_mobile_screen() -> bool:
 if force_mobile_fit_for_testing or OS.has_feature("mobile") or DisplayServer.is_touchscreen_available():
  return true
 if OS.has_feature("web"):
  var touch: Variant = JavaScriptBridge.eval(
   "Boolean((navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches))",
   true)
  return touch is bool and touch
 return false

func _configure_camera() -> void:
 var viewport_size: Vector2 = get_viewport().get_visible_rect().size
 if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
  return
 # Mobile: fill the real device viewport with UNIFORM zoom, never
 # non-uniformly stretch the art. Only the camera's visible window crops
 # the world; the entire original PSD and collision map remain unchanged.
 # A little extra zoom gives the player room to move the camera on both axes.
 # On rotation/resize the viewport signal recalculates the framing.
 var mobile_fit: bool = _is_mobile_screen()
 if mobile_fit:
  var cover_zoom: float = maxf(viewport_size.x / CANVAS_SIZE.x,
   viewport_size.y / CANVAS_SIZE.y)
  camera.zoom = Vector2.ONE * cover_zoom * mobile_follow_zoom
  # Keep the view inside the authored PSD. Player follow is clamped below.
  camera.limit_left = 0
  camera.limit_top = 0
  camera.limit_right = roundi(CANVAS_SIZE.x)
  camera.limit_bottom = roundi(CANVAS_SIZE.y)
 else:
  # Desktop retains the original uniform follow zoom.
  var fit_zoom: float = minf(viewport_size.x / CANVAS_SIZE.x,
   viewport_size.y / CANVAS_SIZE.y)
  camera.limit_left = 0
  camera.limit_top = 0
  camera.limit_right = roundi(CANVAS_SIZE.x)
  camera.limit_bottom = roundi(CANVAS_SIZE.y)
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
 _update_door_action_ui()
 _tick_lighting(delta)
 _tick_weather(delta)
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
 rpg_hud.call("set_phase", ["PAGI","SIANG","SORE","MALAM"][lighting_preset_index])
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

func _set_weather_mode(index: int, instant: bool = false) -> void:
 weather_mode_index = posmod(index, WEATHER_NAMES.size())
 weather_picker.call("set_weather_label", WEATHER_NAMES[weather_mode_index])
 rpg_hud.call("set_weather", WEATHER_NAMES[weather_mode_index])
 weather_tint_target = WEATHER_TINTS[weather_mode_index]
 weather_strength_target = 0.0 if weather_mode_index == 0 else 1.0
 weather.call("set_precipitation", PRECIPITATION_LEVELS[weather_mode_index])
 river_current.call("set_rain_boost", weather_mode_index >= 2, weather_mode_index == 4)
 if weather_mode_index != 4:
  lightning_active = false
  lightning_flash.visible = false
  lightning_bolt.call("set_flash", 0.0)
 else:
  storm_clock = 0.0
  next_lightning_time = lightning_min_interval
 if instant:
  weather_tint_current = weather_tint_target
  weather_strength_current = weather_strength_target
  bridge_wetness_current = minf(1.0, PRECIPITATION_LEVELS[weather_mode_index])
 var wet_material: ShaderMaterial = bridge_sprite.material as ShaderMaterial
 if wet_material != null:
  wet_material.set_shader_parameter("wetness", bridge_wetness_current)
  wet_material.set_shader_parameter("rain_intensity",
   minf(1.0, PRECIPITATION_LEVELS[weather_mode_index]))
 _apply_weather_tint()
 print("PSD NATIVE2D WEATHER: " + WEATHER_NAMES[weather_mode_index])

func _cycle_weather_mode(step: int) -> void:
 _set_weather_mode(weather_mode_index + step)

func _apply_weather_tint() -> void:
 var grade: ShaderMaterial = cloud_tint.material as ShaderMaterial
 grade.set_shader_parameter("scene_tint",
  Vector3(weather_tint_current.r, weather_tint_current.g, weather_tint_current.b))
 grade.set_shader_parameter("atmosphere", weather_strength_current)

func _trigger_lightning() -> void:
 if weather_mode_index != 4:
  return
 lightning_active = true
 lightning_elapsed = 0.0
 lightning_flash.visible = true

func _tick_weather(delta: float) -> void:
 var step: float = minf(delta, 0.05)
 # Wood wets with rain and dries more slowly once precipitation stops.
 var rain_level: float = minf(1.0, PRECIPITATION_LEVELS[weather_mode_index])
 var wet_rate: float = 1.6 if rain_level > bridge_wetness_current else 0.16
 var wet_blend: float = 1.0 - exp(-wet_rate * step)
 bridge_wetness_current = lerpf(bridge_wetness_current, rain_level, wet_blend)
 var wet_material: ShaderMaterial = bridge_sprite.material as ShaderMaterial
 if wet_material != null:
  wet_material.set_shader_parameter("wetness", bridge_wetness_current)
 var blend: float = 1.0 - exp(-weather_transition_speed * step)
 weather_tint_current = weather_tint_current.lerp(weather_tint_target, blend)
 weather_strength_current = lerpf(weather_strength_current, weather_strength_target, blend)
 _apply_weather_tint()
 wind_clock += step
 var gust_base: float = WIND_LEVELS[weather_mode_index]
 var gust: float = gust_base * (0.77 + 0.23 * sin(wind_clock * 1.7))
 weather.call("set_wind_strength", gust)
 wind_gusts.call("set_gust", gust)
 if weather_mode_index == 4:
  storm_clock += step
  if not lightning_active and storm_clock >= next_lightning_time:
   _trigger_lightning()
   next_lightning_time = storm_clock + storm_rng.randf_range(lightning_min_interval, lightning_min_interval + 11.0)
 if lightning_active:
  lightning_elapsed += step
  # Two quick, asymmetric pulses over ~0.30s, followed by darkness.
  var primary: float = maxf(0.0, 1.0 - absf(lightning_elapsed - 0.065) / 0.065)
  var bounce: float = maxf(0.0, 1.0 - absf(lightning_elapsed - 0.205) / 0.065)
  var brightness: float = clampf(primary * 0.75 + bounce * 0.35, 0.0, 0.78)
  lightning_flash.color = Color(0.86, 0.93, 1.0, brightness)
  lightning_bolt.call("set_flash", brightness)
  if lightning_elapsed > 0.32:
   lightning_active = false
   lightning_flash.visible = false
   lightning_bolt.call("set_flash", 0.0)

func _can_use_front_door() -> bool:
 return player.position.distance_to(FRONT_DOOR_FOOT) <= FRONT_DOOR_REACH

func _update_door_action_ui() -> void:
 var nearby: bool = _can_use_front_door()
 if nearby:
  var door_open: bool = bool(house_door.get("is_open"))
  rpg_hud.call("set_context", "AKSI • Tutup pintu" if door_open else "AKSI • Buka pintu")
 else:
  rpg_hud.call("set_context", "")
 if mobile.action_enabled != nearby:
  mobile.action_enabled = nearby
  mobile.queue_redraw()

func _on_action_requested() -> void:
 if _can_use_front_door():
  house_door.call("toggle")

func _on_hud_modal_changed(opened: bool) -> void:
 # Keep touch move/run/Action untouched when in normal exploration.
 # Hide them only behind a full-screen menu, restoring their exact state.
 if opened:
  touch_pre_modal_visible = mobile.visible
  mobile.call("cancel_touches")
  touch_direction = Vector2.ZERO
  touch_run = false
  mobile.visible = false
  mobile.set_process_input(false)
 else:
  mobile.visible = touch_pre_modal_visible
  mobile.set_process_input(mobile.visible)

func _on_touch_move(direction: Vector2) -> void:
 touch_direction = direction

func _on_touch_run(active: bool) -> void:
 touch_run = active

func _unhandled_input(event: InputEvent) -> void:
 if bool(rpg_hud.call("is_modal_open")):
  return
 if event is InputEventKey and event.pressed and not event.echo:
  if event.keycode == KEY_E or event.keycode == KEY_F:
   _on_action_requested()
  elif event.keycode == KEY_R:
   _set_weather_mode(3 if weather_mode_index < 2 else 0)
  elif event.keycode == KEY_T:
   _cycle_weather_mode(1)
  elif event.keycode == KEY_C:
   collision_visual.visible = not collision_visual.visible
   collision_visual.queue_redraw()
  elif event.keycode == KEY_L:
   _cycle_lighting_preset(-1 if event.shift_pressed else 1)
  else:
   return
  get_viewport().set_input_as_handled()
