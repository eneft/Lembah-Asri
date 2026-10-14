extends Node2D
## Isolated 74-pose proportional RUN8 test on the unoccupied rumah-ladang art.
## Does NOT modify main gameplay or its animation resources.
const BACKGROUND_PATH := "res://assets/art/scenes/rumah_ladang_empty.png"
const BACKGROUND_FALLBACK: Texture2D = preload("res://assets/art/separated/terrain_clean.webp")
const WORLD_SIZE := Vector2(1672.0, 941.0)
# Cap exceptional browser frame times to avoid the camera jumping on dropped frames.
const MAX_VISUAL_DELTA := 1.0 / 30.0
const DIRECTIONS := ["down", "down_right", "right", "up_right", "up", "up_left", "left", "down_left"]
const DIR_DISPLAY := {
 "down": "Depan", "down_right": "Depan-kanan", "right": "Kanan",
 "up_right": "Belakang-kanan", "up": "Belakang", "up_left": "Belakang-kiri",
 "left": "Kiri", "down_left": "Depan-kiri"
}
@export var run_move_speed: float = 220.0
@export var fast_move_speed: float = 325.0
@export var preview_character_height: float = 112.0

@onready var scene_background: Sprite2D = $Background
@onready var actor: AnimatedSprite2D = $Run8Player/AnimatedSprite2D
@onready var camera: Camera2D = $Run8Player/FollowCamera
var runner: Variant = null
var touch_direction: Vector2 = Vector2.ZERO
var touch_fast: bool = false
var direction_name: String = "down"
var auto_rotate: bool = false
var rotate_elapsed: float = 0.0
var status_label: Label
var asset_label: Label
var background_installed: bool = false

func _ready() -> void:
 runner = get_node("Run8Player")
 runner.set_character_height(preview_character_height)
 _load_background()
 _make_foot_shadow()
 _build_ui()
 var touch: Control = $TouchOverlay/TouchControls
 touch.connect("move_changed", Callable(self, "_on_touch_move"))
 touch.connect("run_changed", Callable(self, "_on_touch_fast"))
 runner.set_idle_direction(direction_name)
 _update_status()
 print("RUMAH LADANG RUN8 TEST ACTIVE: 74 normalized poses; left/right 8fps; other six 10fps; background=" + ("original" if background_installed else "fallback"))
 print("RUMAH LADANG RUN8: original main scene and run8 browser test remain unchanged")
 print("RUMAH LADANG IDLE8 SCENE READY: stationary=idle, moving=run, remembers last of 8 headings")
 print("RUMAH LADANG CAMERA SYNC PASS: runner and Camera2D render-idle updates; capped visual delta")

func _load_background() -> void:
 # When the approved PNG is not yet in Git, fall back visibly, not silently.
 # The export preset already contains export_filter=all_resources.
 scene_background.texture = BACKGROUND_FALLBACK
 background_installed = false
 if ResourceLoader.exists(BACKGROUND_PATH):
  var original_texture: Texture2D = load(BACKGROUND_PATH) as Texture2D
  if original_texture != null and original_texture.get_size() == WORLD_SIZE:
   scene_background.texture = original_texture
   background_installed = true
  else:
   push_warning("Rumah ladang PNG must be exactly 1672x941; displaying fallback.")
 else:
  push_warning("Rumah ladang background not in GitHub yet: " + BACKGROUND_PATH)
 if asset_label != null:
  _update_asset_label()

func _make_foot_shadow() -> void:
 var pts := PackedVector2Array()
 for i in range(32):
  var angle: float = float(i) * TAU / 32.0
  pts.append(Vector2(cos(angle) * 18.0, sin(angle) * 7.0))
 var shadow := Polygon2D.new()
 shadow.name = "FootContactShadow"
 shadow.polygon = pts
 shadow.color = Color(0.06, 0.09, 0.05, 0.26)
 shadow.z_index = -1
 runner.add_child(shadow)

## This art-only scene does not use physics collision. Updating motion at
## the same render cadence as the Camera2D (idle) avoids the 60 Hz physics
## versus variable browser FPS mismatch that caused background judder.
func _process(delta: float) -> void:
 var step: float = minf(delta, MAX_VISUAL_DELTA)
 var motion := Vector2.ZERO
 if Input.is_action_pressed("ui_left") or Input.is_physical_key_pressed(KEY_A):
  motion.x -= 1.0
 if Input.is_action_pressed("ui_right") or Input.is_physical_key_pressed(KEY_D):
  motion.x += 1.0
 if Input.is_action_pressed("ui_up") or Input.is_physical_key_pressed(KEY_W):
  motion.y -= 1.0
 if Input.is_action_pressed("ui_down") or Input.is_physical_key_pressed(KEY_S):
  motion.y += 1.0
 if motion.length_squared() <= 0.001:
  motion = touch_direction
 if motion.length_squared() > 0.001:
  auto_rotate = false
  rotate_elapsed = 0.0
  motion = motion.normalized()
  var sector: int = posmod(int(round(motion.angle() / (PI / 4.0))), 8)
  var current_dir: String = DIRECTIONS[sector]
  var was_idle: bool = str(runner.get("animation_state")) == "idle"
  runner.set_run_direction(current_dir)
  if current_dir != direction_name or was_idle:
   direction_name = current_dir
   _update_status()
  var speed: float = fast_move_speed if touch_fast or Input.is_key_pressed(KEY_SHIFT) else run_move_speed
  runner.position = (runner.position + motion * speed * step).clamp(Vector2(110, 355), Vector2(1535, 795))
 else:
  if str(runner.get("animation_state")) != "idle":
   runner.set_idle_direction(direction_name)
   _update_status()
  if auto_rotate:
   rotate_elapsed += step
   if rotate_elapsed >= 1.25:
    rotate_elapsed = 0.0
    var next_index: int = (DIRECTIONS.find(direction_name) + 1) % DIRECTIONS.size()
    _set_facing(DIRECTIONS[next_index])

func _set_facing(direction: String) -> void:
 direction_name = direction
 runner.set_idle_direction(direction)
 _update_status()

func _choose_direction(direction: String) -> void:
 auto_rotate = false
 _set_facing(direction)

func _toggle_auto(enabled: bool) -> void:
 auto_rotate = enabled
 rotate_elapsed = 0.0

func _on_touch_move(direction: Vector2) -> void:
 touch_direction = direction

func _on_touch_fast(pressed: bool) -> void:
 touch_fast = pressed

func _update_status() -> void:
 if status_label == null or actor.sprite_frames == null:
  return
 var state: String = str(runner.get("animation_state"))
 var anim: String = state + "_" + direction_name
 var total: int = actor.sprite_frames.get_frame_count(anim)
 if state == "idle":
  status_label.text = "IDLE  |  %s  |  diam  |  %d pose" % [str(DIR_DISPLAY[direction_name]), total]
 else:
  var native_fps: float = actor.sprite_frames.get_animation_speed(anim)
  status_label.text = "RUN  |  %s  |  %d frame  |  %.0f FPS" % [str(DIR_DISPLAY[direction_name]), total, native_fps]

func _update_asset_label() -> void:
 if asset_label == null:
  return
 if background_installed:
  asset_label.text = "BACKGROUND: Rumah & Ladang (gambar asli tanpa karakter)"
  asset_label.add_theme_color_override("font_color", Color(0.10, 0.43, 0.21))
 else:
  asset_label.text = "BACKGROUND BELUM TERPASANG DI GITHUB — scene lama sementara"
  asset_label.add_theme_color_override("font_color", Color(0.75, 0.19, 0.10))

func _build_ui() -> void:
 var overlay := Control.new()
 overlay.name = "HUDRoot"
 overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
 $HUD.add_child(overlay)
 overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 var panel := PanelContainer.new()
 panel.name = "InfoPanel"
 panel.position = Vector2(14, 14)
 panel.custom_minimum_size = Vector2(485, 125)
 overlay.add_child(panel)
 var info := VBoxContainer.new()
 panel.add_child(info)
 var title := Label.new()
 title.text = "LEMBAH ASRI  |  TEST RUMAH & LADANG"
 title.add_theme_font_size_override("font_size", 19)
 info.add_child(title)
 asset_label = Label.new()
 asset_label.add_theme_font_size_override("font_size", 13)
 info.add_child(asset_label)
 var description := Label.new()
 description.text = "IDLE8 saat diam | RUN8 saat bergerak | WASD/panah | Shift"
 info.add_child(description)
 status_label = Label.new()
 status_label.add_theme_font_size_override("font_size", 15)
 info.add_child(status_label)
 _update_asset_label()

 var chooser := PanelContainer.new()
 chooser.name = "DirectionPanel"
 chooser.anchor_left = 1.0
 chooser.anchor_right = 1.0
 chooser.offset_left = -247.0
 chooser.offset_right = -14.0
 chooser.offset_top = 14.0
 chooser.offset_bottom = 268.0
 overlay.add_child(chooser)
 var stack := VBoxContainer.new()
 chooser.add_child(stack)
 var h := Label.new()
 h.text = "UJI IDLE + RUN 8 ARAH"
 stack.add_child(h)
 var grid := GridContainer.new()
 grid.columns = 3
 stack.add_child(grid)
 var keys := ["NW", "N", "NE", "W", "AUTO", "E", "SW", "S", "SE"]
 var mapped := ["up_left", "up", "up_right", "left", "", "right", "down_left", "down", "down_right"]
 for i in range(keys.size()):
  var btn := Button.new()
  btn.text = keys[i]
  btn.custom_minimum_size = Vector2(71, 39)
  grid.add_child(btn)
  if mapped[i] == "":
   btn.pressed.connect(_start_auto)
  else:
   btn.pressed.connect(_choose_direction.bind(mapped[i]))
 var cb := CheckButton.new()
 cb.text = "Ganti arah otomatis"
 cb.toggled.connect(_toggle_auto)
 stack.add_child(cb)
 var note := Label.new()
 note.text = "IDLE 8 pose | RUN kiri/kanan 8 FPS"
 note.add_theme_font_size_override("font_size", 12)
 stack.add_child(note)

func _start_auto() -> void:
 auto_rotate = true
 rotate_elapsed = 0.0
