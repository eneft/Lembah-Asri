extends Node3D
## True angled Camera3D + transparent independent Sprite3D planes.
## Camera-facing art rig avoids projecting an already-isometric illustration
## through a second perspective and keeps the Photoshop offsets aligned.
const ART_SCALE: float = 0.01
const CANVAS_SIZE: Vector2 = Vector2(1672.0, 941.0)
const DIRECTIONS := ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]
@export var walk_speed_px: float = 220.0
@export var run_speed_px: float = 325.0
@export var camera_distance: float = 24.0
@export var camera_smoothing: float = 4.0
@onready var camera: Camera3D = $Camera3D
@onready var art: Node3D = $ArtRig
@onready var player: Node3D = $Run8Player
@onready var mobile: Control = $TouchOverlay/TouchControls
var touch_direction := Vector2.ZERO
var touch_run := false
var psd_ready: bool = false

func _ready() -> void:
 camera.look_at(Vector3.ZERO, Vector3.UP)
 art.global_basis = camera.global_basis
 # Orient each PSD picture plane AND the player parallel to the Camera3D.
 # Flat image composition stays pixel-perfect despite genuine 3D depth.
 for name in ["Background", "Run8Player", "PSD_House", "PSD_Banana", "PSD_ForegroundTree"]:
  var item: Node3D = get_node(name) as Node3D
  var source_local: Vector3 = item.position
  item.global_transform = Transform3D(art.global_basis, art.to_global(source_local))
 _refresh_psd_layers()
 mobile.connect("move_changed", Callable(self, "_on_touch_move"))
 mobile.connect("run_changed", Callable(self, "_on_touch_run"))
 var label := Label.new()
 label.text = "LEMBAH ASRI | PSD 4 LAYER | CAMERA 3D ORTHOGRAPHIC" if psd_ready else "PSD CAMERA3D: SALIN PNG DARI ZIP KE REPO"
 label.position = Vector2(20, 20)
 label.add_theme_font_size_override("font_size", 16)
 $HUD.add_child(label)
 _position_camera(true)
 print("PSD CAMERA3D READY: Camera3D orthographic, 4 Sprite3D PSD planes and character after layer 1")

func _refresh_psd_layers() -> void:
 psd_ready = true
 var filenames := {
  "Background": "01_background.png",
  "PSD_House": "02_house.png",
  "PSD_Banana": "03_banana.png",
  "PSD_ForegroundTree": "04_foreground_tree.png"
 }
 for name in ["Background", "PSD_House", "PSD_Banana", "PSD_ForegroundTree"]:
  var layer: Sprite3D = get_node(name) as Sprite3D
  var path: String = "res://assets/art/psd_background/" + str(filenames[name])
  layer.texture = load(path) as Texture2D if ResourceLoader.exists(path) else null
  if layer.texture == null:
   psd_ready = false
 if not psd_ready:
  var background: Sprite3D = get_node("Background") as Sprite3D
  background.texture = load("res://assets/art/scenes/rumah_ladang_empty.png") as Texture2D
  for name in ["PSD_House", "PSD_Banana", "PSD_ForegroundTree"]:
   get_node(name).visible = false
  push_warning("PSD Camera3D: four transparent PNG layers missing; unpack the companion ZIP at project root")
 else:
  for name in ["PSD_House", "PSD_Banana", "PSD_ForegroundTree"]:
   get_node(name).visible = true

func _on_touch_move(direction: Vector2) -> void:
 touch_direction = direction

func _on_touch_run(enabled: bool) -> void:
 touch_run = enabled

func _process(delta: float) -> void:
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
 if motion.length_squared() > 0.001:
  motion = motion.normalized()
  var octant: int = posmod(int(round(motion.angle() / (PI * 0.25))), 8)
  player.call("set_run_direction", DIRECTIONS[octant])
  var speed: float = run_speed_px if touch_run or Input.is_key_pressed(KEY_SHIFT) else walk_speed_px
  var point := _local_to_pixel(art.to_local(player.global_position))
  point += motion * speed * minf(delta, 1.0 / 30.0)
  point = point.clamp(Vector2(110, 355), Vector2(1535, 795))
  player.global_position = art.to_global(_pixel_to_local(point, -0.10))
 elif str(player.get("animation_state")) != "idle":
  player.call("set_idle_direction", str(player.get("facing")))
 _position_camera(false, delta)

func _pixel_to_local(point: Vector2, z_depth: float = 0.0) -> Vector3:
 return Vector3((point.x - CANVAS_SIZE.x * 0.5) * ART_SCALE,
  (CANVAS_SIZE.y * 0.5 - point.y) * ART_SCALE, z_depth)

func _local_to_pixel(point: Vector3) -> Vector2:
 return Vector2(point.x / ART_SCALE + CANVAS_SIZE.x * 0.5,
  CANVAS_SIZE.y * 0.5 - point.y / ART_SCALE)

func _position_camera(instant: bool, delta: float = 0.0) -> void:
 var origin_on_art: Vector3 = art.to_local(player.global_position)
 var target: Vector3 = art.to_global(Vector3(origin_on_art.x, origin_on_art.y, camera_distance))
 if instant:
  camera.global_position = target
 else:
  camera.global_position = camera.global_position.lerp(target, 1.0 - exp(-camera_smoothing * delta))
