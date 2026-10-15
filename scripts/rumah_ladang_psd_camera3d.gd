extends Node3D
## Genuine Camera3D PSD layers, editable 3D colliders and existing batched weather.
const ART_SCALE: float = 0.01
const CANVAS_SIZE: Vector2 = Vector2(1672.0, 941.0)
const DIRECTIONS := ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]
const GROUND_Z: float = -0.10
const WALKABLE_LAYOUT = preload("res://scripts/psd_collision_layout.gd")
const FOOT_CLEARANCE_PX: float = 9.0
const MAX_MOVE_STEP_PX: float = 6.0

@export var walk_speed_px: float = 220.0
@export var run_speed_px: float = 325.0
@export var camera_distance: float = 24.0
@export var camera_smoothing: float = 4.0
@export var walk_bounds: Rect2 = Rect2(65.0, 320.0, 1515.0, 540.0)

# The scene is hand-painted three-quarter perspective, not a physically
# projected 3D terrain. Scale the 2D visual only; the player's 3D foot,
# collision, movement speed, and atlas pivot never change.
@export_group("Character Painted Perspective")
@export_range(0.7, 1.0, 0.01) var far_character_scale: float = 0.88
@export_range(0.9, 1.1, 0.01) var middle_character_scale: float = 1.0
@export_range(1.0, 1.4, 0.01) var near_character_scale: float = 1.18
@export_range(0.0, 940.0, 1.0) var far_reference_y: float = 360.0
@export_range(0.0, 940.0, 1.0) var middle_reference_y: float = 570.0
@export_range(0.0, 940.0, 1.0) var near_reference_y: float = 810.0
@export_range(0.0, 0.15, 0.005) var bridge_scale_bonus: float = 0.07
@export_range(0.0, 1672.0, 1.0) var bridge_blend_start_x: float = 1070.0
@export_range(0.0, 1672.0, 1.0) var bridge_blend_full_x: float = 1320.0
@export_range(0.0, 941.0, 1.0) var bridge_blend_start_y: float = 480.0
@export_range(0.0, 941.0, 1.0) var bridge_blend_full_y: float = 625.0

@onready var camera: Camera3D = $Camera3D
@onready var art: Node3D = $ArtRig
@onready var player: CharacterBody3D = $Run8Player
@onready var mobile: Control = $TouchOverlay/TouchControls
@onready var character_canvas: CanvasLayer = $CharacterOverlay
@onready var projected: AnimatedSprite2D = $CharacterOverlay/ProjectedPlayer
@onready var foreground_canvas: CanvasLayer = $ForegroundOverlay
@onready var driver: AnimatedSprite3D = $Run8Player/AnimatedSprite3D
@onready var collision_debug_canvas: CanvasLayer = $CollisionDebugOverlay
@onready var collision_debug_visual: Node2D = $CollisionDebugOverlay/WalkablePolygons
@onready var weather_canvas: CanvasLayer = $WeatherOverlay
@onready var weather: Node2D = $WeatherOverlay/RainWeather
var touch_direction: Vector2 = Vector2.ZERO
var touch_run: bool = false
var psd_ready: bool = false
var walkable_regions: Dictionary = {}

func _ready() -> void:
 camera.look_at(Vector3.ZERO, Vector3.UP)
 art.global_basis = camera.global_basis
 # Keep PSD offsets while rotating each 2.5D plane parallel to the real Camera3D.
 for name in ["Background", "Run8Player", "PSD_House", "PSD_Banana", "PSD_ForegroundTree"]:
  var item: Node3D = get_node(name) as Node3D
  var source_local: Vector3 = item.position
  item.global_transform = Transform3D(art.global_basis, art.to_global(source_local))
 walkable_regions = WALKABLE_LAYOUT.regions()
 collision_debug_visual.set("walkable_regions", walkable_regions)
 collision_debug_visual.set("clearance_radius", FOOT_CLEARANCE_PX)
 _refresh_psd_layers()
 _initialize_camera_projected_art()
 mobile.move_changed.connect(_on_touch_move)
 mobile.run_changed.connect(_on_touch_run)
 # The old large debug banner is intentionally absent in playable scenes.
 _position_camera(true)
 _sync_camera_overlays()
 _sync_projected_player()
 if psd_ready:
  print("LEMBAH ASRI MAIN PSD READY: four original layers, orthographic Camera3D, collision and RUN8/IDLE8")
 else:
  push_error("PSD CAMERA3D: scene missing original exported assets")
 print("PSD COLLISION MAP READY: polygonal yard, narrow walkable bridge, far shore; F3 outlines (no river rectangle)")

func _refresh_psd_layers() -> void:
 psd_ready = true
 var filenames := {
  "Background": "01_background.png",
  "PSD_House": "02_house.png",
  "PSD_Banana": "03_banana.png",
  "PSD_ForegroundTree": "04_foreground_tree.png"
 }
 for name in filenames:
  var layer: Sprite3D = get_node(name) as Sprite3D
  var path: String = "res://assets/art/psd_background/" + str(filenames[name])
  if name == "Background" and not ResourceLoader.exists(path):
   path = "res://assets/art/psd_background/01_background_lossless.webp"
  layer.texture = load(path) as Texture2D if ResourceLoader.exists(path) else null
  if layer.texture == null:
   psd_ready = false
 if not psd_ready:
  # Visible fallback is for debugging only; build tests reject missing originals.
  var background: Sprite3D = $Background
  background.texture = load("res://assets/art/scenes/rumah_ladang_empty.png") as Texture2D
  for name in ["PSD_House", "PSD_Banana", "PSD_ForegroundTree"]:
   get_node(name).visible = false
 else:
  for name in ["PSD_House", "PSD_Banana", "PSD_ForegroundTree"]:
   get_node(name).visible = true

func _initialize_camera_projected_art() -> void:
 # Godot 4 Compatibility did not render Sprite3D children of our actor:
 # independent GPU pixel tests gave zero protagonist pixels. Keep the genuine
 # 3D physical player and editable PSD source nodes, but draw source sprite
 # frames on Camera3D-aligned CanvasLayers, in original PSD occlusion order.
 if not psd_ready:
  return
 projected.sprite_frames = driver.sprite_frames
 projected.centered = false
 projected.offset = Vector2(-256.0, -708.0) * float(player.get("raster_density"))
 var density: float = float(player.get("raster_density"))
 projected.scale = Vector2.ONE * (float(player.get("character_height_px")) / (640.0 * density))
 projected.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
 driver.visible = false
 for name in ["PSD_House", "PSD_Banana", "PSD_ForegroundTree"]:
  # Still individually visible/editable in native Godot 3D editor, hidden
  # only while running to prevent duplicate layering in final compositing.
  get_node(name).visible = false
 _sync_projected_player()
 print("PSD PLAYER PROJECTED READY: Camera3D world with real visible 2D sprite between background and front art")

func _character_depth_multiplier(foot_pixel: Vector2) -> float:
 # Smooth C1-continuous scaling instead of abrupt per-area scale jumps.
 # Use the world/PSD foot position, not viewport coordinates, so camera
 # smoothing and resizing do not make the character pulse in size.
 var scale_factor: float
 if foot_pixel.y <= middle_reference_y:
  var far_blend: float = smoothstep(far_reference_y, middle_reference_y, foot_pixel.y)
  scale_factor = lerpf(far_character_scale, middle_character_scale, far_blend)
 else:
  var near_blend: float = smoothstep(middle_reference_y, near_reference_y, foot_pixel.y)
  scale_factor = lerpf(middle_character_scale, near_character_scale, near_blend)
 # The bottom-right bridge has more foreground visual mass than the middle
 # yard. A softly blended horizontal * vertical correction matches this art
 # without changing character size when walking sideways across the yard.
 var bridge_weight: float = smoothstep(bridge_blend_start_x, bridge_blend_full_x, foot_pixel.x)
 bridge_weight *= smoothstep(bridge_blend_start_y, bridge_blend_full_y, foot_pixel.y)
 return clampf(scale_factor + bridge_scale_bonus * bridge_weight,
  far_character_scale, near_character_scale + bridge_scale_bonus)

func _sync_projected_player() -> void:
 if not psd_ready or projected.sprite_frames == null:
  return
 var foot_pixel: Vector2 = _local_to_pixel(art.to_local(player.global_position))
 projected.position = foot_pixel
 var density: float = float(player.get("raster_density"))
 var native_height_px: float = float(player.get("character_height_px"))
 var base_scale: float = native_height_px / (640.0 * density)
 projected.scale = Vector2.ONE * (base_scale * _character_depth_multiplier(foot_pixel))
 if projected.animation != driver.animation:
  projected.animation = driver.animation
 if projected.frame != driver.frame:
  projected.set_frame_and_progress(driver.frame, driver.frame_progress)
 # Driver controls RUN8 timing; pause the presentation clock without resetting frame 0.
 projected.pause()

func _walkable_pixel(point: Vector2) -> bool:
 if point.x < 0.0 or point.y < 0.0 or point.x >= CANVAS_SIZE.x or point.y >= CANVAS_SIZE.y:
  return false
 for label in walkable_regions:
  var polygon: PackedVector2Array = walkable_regions[label]
  if Geometry2D.is_point_in_polygon(point, polygon):
   return true
 return false

func _is_walkable_foot(point: Vector2) -> bool:
 # A foot is a circle, not a mathematical zero-width point: reject narrow
 # seams along rails, wall bases and shoreline on every side of the avatar.
 for offset in [Vector2.ZERO, Vector2(FOOT_CLEARANCE_PX, 0), Vector2(-FOOT_CLEARANCE_PX, 0),
  Vector2(0, FOOT_CLEARANCE_PX), Vector2(0, -FOOT_CLEARANCE_PX)]:
  if not _walkable_pixel(point + offset):
   return false
 return true

func _move_foot_on_map(origin: Vector2, travel: Vector2) -> Vector2:
 # Bounded substeps stop sprinting across a thin river or fence edge on
 # low-FPS devices. Independent X/Y probes let movement slide along borders.
 var step_count: int = maxi(1, ceili(travel.length() / MAX_MOVE_STEP_PX))
 var one_step: Vector2 = travel / float(step_count)
 var current: Vector2 = origin
 for i in range(step_count):
  var next: Vector2 = current + one_step
  if _is_walkable_foot(next):
   current = next
   continue
  var along_x: Vector2 = current + Vector2(one_step.x, 0.0)
  if _is_walkable_foot(along_x):
   current = along_x
  var along_y: Vector2 = current + Vector2(0.0, one_step.y)
  if _is_walkable_foot(along_y):
   current = along_y
 return current

func _on_touch_move(direction: Vector2) -> void:
 touch_direction = direction

func _on_touch_run(enabled: bool) -> void:
 touch_run = enabled

func _unhandled_input(event: InputEvent) -> void:
 if event is InputEventKey and event.pressed and not event.echo:
  if event.keycode == KEY_R:
   weather.call("toggle_rain")
   get_viewport().set_input_as_handled()
  elif event.keycode == KEY_F3:
   collision_debug_canvas.visible = not collision_debug_canvas.visible
   collision_debug_visual.queue_redraw()
   get_viewport().set_input_as_handled()

func _read_motion() -> Vector2:
 var motion := Vector2.ZERO
 if Input.is_action_pressed("ui_left") or Input.is_physical_key_pressed(KEY_A):
  motion.x -= 1.0
 if Input.is_action_pressed("ui_right") or Input.is_physical_key_pressed(KEY_D):
  motion.x += 1.0
 if Input.is_action_pressed("ui_up") or Input.is_physical_key_pressed(KEY_W):
  motion.y -= 1.0
 if Input.is_action_pressed("ui_down") or Input.is_physical_key_pressed(KEY_S):
  motion.y += 1.0
 if motion.length_squared() < 0.001:
  motion = touch_direction
 return motion.normalized() if motion.length_squared() > 0.001 else Vector2.ZERO

func _physics_process(delta: float) -> void:
 var motion: Vector2 = _read_motion()
 var before: Vector2 = _local_to_pixel(art.to_local(player.global_position))
 var moving: bool = motion.length_squared() > 0.001
 var changed: bool = false
 if moving:
  var running: bool = touch_run or Input.is_key_pressed(KEY_SHIFT)
  var speed: float = run_speed_px if running else walk_speed_px
  var delta_px: Vector2 = motion * speed * minf(delta, 0.09)
  var new_foot: Vector2 = _move_foot_on_map(before, delta_px)
  changed = new_foot.distance_squared_to(before) > 0.0025
  player.global_position = art.to_global(_pixel_to_local(new_foot, GROUND_Z))
  player.velocity = art.global_basis * Vector3(motion.x, -motion.y, 0.0) * speed * ART_SCALE if changed else Vector3.ZERO
  var octant: int = posmod(int(round(motion.angle() / (PI * 0.25))), 8)
  if changed:
   player.call("set_run_direction", DIRECTIONS[octant])
  else:
   player.call("set_idle_direction", str(player.get("facing")))
  weather.call("register_footstep", new_foot, changed)
 else:
  player.velocity = Vector3.ZERO
  if str(player.get("animation_state")) != "idle":
   player.call("set_idle_direction", str(player.get("facing")))

func _process(delta: float) -> void:
 _position_camera(false, delta)
 _sync_camera_overlays()
 _sync_projected_player()
 if collision_debug_canvas.visible:
  collision_debug_visual.set("player_foot", _local_to_pixel(art.to_local(player.global_position)))
  collision_debug_visual.queue_redraw()

func _pixel_to_local(point: Vector2, z_depth: float = 0.0) -> Vector3:
 return Vector3((point.x - CANVAS_SIZE.x * 0.5) * ART_SCALE, (CANVAS_SIZE.y * 0.5 - point.y) * ART_SCALE, z_depth)

func _local_to_pixel(point: Vector3) -> Vector2:
 return Vector2(point.x / ART_SCALE + CANVAS_SIZE.x * 0.5, CANVAS_SIZE.y * 0.5 - point.y / ART_SCALE)

func _position_camera(instant: bool, delta: float = 0.0) -> void:
 var viewport_size: Vector2 = get_viewport().get_visible_rect().size
 var half_height: float = camera.size * 0.5
 var half_width: float = half_height * viewport_size.x / maxf(1.0, viewport_size.y)
 var x_limit: float = maxf(0.0, CANVAS_SIZE.x * ART_SCALE * 0.5 - half_width)
 var y_limit: float = maxf(0.0, CANVAS_SIZE.y * ART_SCALE * 0.5 - half_height)
 var origin_on_art: Vector3 = art.to_local(player.global_position)
 var target: Vector3 = art.to_global(Vector3(clampf(origin_on_art.x, -x_limit, x_limit), clampf(origin_on_art.y, -y_limit, y_limit), camera_distance))
 if instant:
  camera.global_position = target
 else:
  camera.global_position = camera.global_position.lerp(target, 1.0 - exp(-camera_smoothing * delta))

func _sync_camera_overlays() -> void:
 # All RGBA overlay layers share the identical Camera3D projection transform.
 var viewport_size: Vector2 = get_viewport().get_visible_rect().size
 var zoom: float = viewport_size.y / (camera.size / ART_SCALE)
 var center_pixel: Vector2 = _local_to_pixel(art.to_local(camera.global_position))
 var offset: Vector2 = viewport_size * 0.5 - center_pixel * zoom
 var projection := Transform2D(Vector2(zoom, 0.0), Vector2(0.0, zoom), offset)
 character_canvas.transform = projection
 foreground_canvas.transform = projection
 weather_canvas.transform = projection
 collision_debug_canvas.transform = projection
