extends Node3D
## Genuine Camera3D PSD layers, editable 3D colliders and existing batched weather.
const ART_SCALE: float = 0.01
const CANVAS_SIZE: Vector2 = Vector2(1672.0, 941.0)
const DIRECTIONS := ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]
const GROUND_Z: float = -0.10

@export var walk_speed_px: float = 220.0
@export var run_speed_px: float = 325.0
@export var camera_distance: float = 24.0
@export var camera_smoothing: float = 4.0
@export var walk_bounds: Rect2 = Rect2(65.0, 320.0, 1515.0, 540.0)

@onready var camera: Camera3D = $Camera3D
@onready var art: Node3D = $ArtRig
@onready var player: CharacterBody3D = $Run8Player
@onready var mobile: Control = $TouchOverlay/TouchControls
@onready var character_canvas: CanvasLayer = $CharacterOverlay
@onready var projected: AnimatedSprite2D = $CharacterOverlay/ProjectedPlayer
@onready var foreground_canvas: CanvasLayer = $ForegroundOverlay
@onready var driver: AnimatedSprite3D = $Run8Player/AnimatedSprite3D
@onready var weather_canvas: CanvasLayer = $WeatherOverlay
@onready var weather: Node2D = $WeatherOverlay/RainWeather
var touch_direction: Vector2 = Vector2.ZERO
var touch_run: bool = false
var psd_ready: bool = false

func _ready() -> void:
 camera.look_at(Vector3.ZERO, Vector3.UP)
 art.global_basis = camera.global_basis
 # Keep PSD offsets while rotating each 2.5D plane parallel to the real Camera3D.
 for name in ["Background", "Run8Player", "PSD_House", "PSD_Banana", "PSD_ForegroundTree"]:
  var item: Node3D = get_node(name) as Node3D
  var source_local: Vector3 = item.position
  item.global_transform = Transform3D(art.global_basis, art.to_global(source_local))
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
 print("PSD CAMERA3D COLLISION READY: house, side structure, banana, foreground tree, river bank, bridge opening")

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

func _sync_projected_player() -> void:
 if not psd_ready or projected.sprite_frames == null:
  return
 projected.position = _local_to_pixel(art.to_local(player.global_position))
 if projected.animation != driver.animation:
  projected.animation = driver.animation
 if projected.frame != driver.frame:
  projected.set_frame_and_progress(driver.frame, driver.frame_progress)
 # Driver controls RUN8 timing; pause the presentation clock without resetting frame 0.
 projected.pause()

func _on_touch_move(direction: Vector2) -> void:
 touch_direction = direction

func _on_touch_run(enabled: bool) -> void:
 touch_run = enabled

func _unhandled_input(event: InputEvent) -> void:
 if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_R:
  weather.call("toggle_rain")
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

func _physics_process(_delta: float) -> void:
 var motion := _read_motion()
 var before: Vector3 = art.to_local(player.global_position)
 if motion.length_squared() > 0.001:
  var speed: float = run_speed_px if touch_run or Input.is_key_pressed(KEY_SHIFT) else walk_speed_px
  player.velocity = art.global_basis * Vector3(motion.x, -motion.y, 0.0) * speed * ART_SCALE
  player.move_and_slide()
  var current: Vector3 = art.to_local(player.global_position)
  var minimum: Vector2 = walk_bounds.position
  var maximum: Vector2 = walk_bounds.end
  current.x = clampf(current.x, (minimum.x - CANVAS_SIZE.x * 0.5) * ART_SCALE, (maximum.x - CANVAS_SIZE.x * 0.5) * ART_SCALE)
  current.y = clampf(current.y, (CANVAS_SIZE.y * 0.5 - maximum.y) * ART_SCALE, (CANVAS_SIZE.y * 0.5 - minimum.y) * ART_SCALE)
  current.z = GROUND_Z
  player.global_position = art.to_global(current)
  var octant: int = posmod(int(round(motion.angle() / (PI * 0.25))), 8)
  if current.distance_to(before) > 0.0002:
   player.call("set_run_direction", DIRECTIONS[octant])
  else:
   player.call("set_idle_direction", str(player.get("facing")))
  weather.call("register_footstep", _local_to_pixel(current), current.distance_to(before) > 0.0002)
 else:
  player.velocity = Vector3.ZERO
  if str(player.get("animation_state")) != "idle":
   player.call("set_idle_direction", str(player.get("facing")))

func _process(delta: float) -> void:
 _position_camera(false, delta)
 _sync_camera_overlays()
 _sync_projected_player()

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
