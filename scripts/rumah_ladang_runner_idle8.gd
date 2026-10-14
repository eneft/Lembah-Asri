extends "res://assets/characters/run8_proportional/Run8Player.gd"
## Isolated 8-direction IDLE for Rumah-Ladang; original RUN8 prefab untouched.
## Reuses five approved user-uploaded idle poses; other three are mirrored.
## RUN: 74 original normalized poses / 8 or 10 FPS, no resizing of the atlas.
## IDLE: 1 genuine static standing pose per direction; calibrated foot anchor.

const IDLE_DOWN: Texture2D = preload("res://assets/characters/idle_uploaded/front.png")
const IDLE_DOWN_RIGHT: Texture2D = preload("res://assets/characters/idle_uploaded/front_right.png")
const IDLE_RIGHT: Texture2D = preload("res://assets/characters/idle_uploaded/right.png")
const IDLE_UP_RIGHT: Texture2D = preload("res://assets/characters/idle_uploaded/back_right.png")
const IDLE_UP: Texture2D = preload("res://assets/characters/idle_uploaded/back.png")
const IDLE_HEIGHT := {
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
const MIRROR_DIRECTIONS := ["down_left", "left", "up_left"]

var animation_state: String = "idle"

func _ready() -> void:
 super._ready()
 _install_idles()
 set_idle_direction(facing)
 print("RUMAH LADANG IDLE8 READY: five native standing poses + three mirrored, 8 headings; approved RUN8 preserved")

func _idle_native_direction(direction: String) -> String:
 match direction:
  "left": return "right"
  "down_left": return "down_right"
  "up_left": return "up_right"
 return direction

func _idle_texture_for_native(native: String) -> Texture2D:
 match native:
  "down": return IDLE_DOWN
  "down_right": return IDLE_DOWN_RIGHT
  "right": return IDLE_RIGHT
  "up_right": return IDLE_UP_RIGHT
  "up": return IDLE_UP
 return null

func _install_idles() -> void:
 # The RUN8 SpriteFrames .tres is shared by /run8/ and the original game;
 # copy just the animation bank so this test never mutates the source asset.
 var bank: SpriteFrames = animated_sprite.sprite_frames.duplicate(false) as SpriteFrames
 assert(bank != null, "RUN8 SpriteFrames must be available for IDLE8")
 for direction in DIRECTIONS:
  var key: String = "idle_" + direction
  if bank.has_animation(key):
   bank.remove_animation(key)
  bank.add_animation(key)
  bank.set_animation_loop(key, false)
  bank.set_animation_speed(key, 1.0)
  var native: String = _idle_native_direction(direction)
  var texture: Texture2D = _idle_texture_for_native(native)
  assert(texture != null, "Missing native standing image for " + native)
  bank.add_frame(key, texture)
 animated_sprite.sprite_frames = bank

func set_idle_direction(direction: String) -> void:
 if not DIRECTIONS.has(direction):
  push_warning("Unknown idle direction " + direction)
  return
 facing = direction
 if not is_node_ready():
  return
 var key: StringName = StringName("idle_" + direction)
 if animation_state == "idle" and animated_sprite.animation == key and not animated_sprite.is_playing():
  return
 var native: String = _idle_native_direction(direction)
 var scale_factor: float = character_height_px / float(IDLE_HEIGHT[native])
 animated_sprite.scale = Vector2.ONE * scale_factor
 animated_sprite.offset = Vector2(-float(IDLE_PIVOT_X[native]), -float(IDLE_FOOT[native]))
 animated_sprite.flip_h = direction in MIRROR_DIRECTIONS
 animated_sprite.animation = key
 animated_sprite.set_frame_and_progress(0, 0.0)
 animated_sprite.stop()
 animation_state = "idle"

func set_run_direction(direction: String) -> void:
 if not DIRECTIONS.has(direction):
  push_warning("Unknown run direction " + direction)
  return
 if not is_node_ready():
  facing = direction
  return
 if animation_state != "run":
  # Reset native-idle scale, foot pivot and horizontal mirror before RUN.
  # RUN left-facing frames are already baked; they must NEVER be flipped.
  _apply_dimensions()
  animated_sprite.flip_h = false
  facing = direction
  animated_sprite.play(StringName("run_" + direction))
  animated_sprite.set_frame_and_progress(0, 0.0)
  animated_sprite.speed_scale = frames_per_second / 10.0
  animation_state = "run"
 else:
  super.set_direction(direction)

func set_character_height(height_in_pixels: float) -> void:
 super.set_character_height(height_in_pixels)
 if is_node_ready() and animation_state == "idle" and animated_sprite.sprite_frames.has_animation("idle_" + facing):
  # The base class calibrates for 640px RUN; restore per-view IDLE scale.
  var native: String = _idle_native_direction(facing)
  animated_sprite.scale = Vector2.ONE * (character_height_px / float(IDLE_HEIGHT[native]))
  animated_sprite.offset = Vector2(-float(IDLE_PIVOT_X[native]), -float(IDLE_FOOT[native]))
