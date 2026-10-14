extends "res://assets/characters/run8_proportional/Run8Player.gd"
## New 8-way normalized IDLE, exclusively for the Rumah-Ladang test.
## Each of the eight poses is a NEW separately generated standing image;
## NONE reuse the old idle_uploaded assets or mirrored run frames.
## Frames are normalized exactly like the approved RUN8: 512x768 canvas,
## visible body 640px, native foot pivot (256,708), world body 112px.
const IDLE8_SOURCE = preload("res://assets/characters/idle8_new/Idle8_SpriteFrames.tres")
const IDLE8_ATLAS_PATH := "res://assets/characters/idle8_new/Idle8_Normalized.png"
const IDLE_HEIGHT: float = 640.0
const FOOT_ANCHOR := Vector2(256.0,708.0)
var animation_state: String = "idle"

func _ready() -> void:
 super._ready()
 _install_idles()
 set_idle_direction(facing)
 print("RUMAH LADANG IDLE8 NEW READY: eight individually generated normalized standing poses; RUN8 preserved")
 
func _install_idles() -> void:
 # Never mutate the shared proportional RUN8 SpriteFrames, used elsewhere.
 var bank: SpriteFrames = animated_sprite.sprite_frames.duplicate(false) as SpriteFrames
 assert(bank != null, "Approved RUN8 bank missing")
 for direction in DIRECTIONS:
  var key: String = "idle_" + direction
  assert(IDLE8_SOURCE.has_animation(key), "Missing new IDLE8 pose " + key)
  assert(IDLE8_SOURCE.get_frame_count(key) == 1, "IDLE8 frame inventory mismatch " + key)
  if bank.has_animation(key):
   bank.remove_animation(key)
  bank.add_animation(key)
  bank.set_animation_loop(key, false)
  bank.set_animation_speed(key, 1.0)
  bank.add_frame(key, IDLE8_SOURCE.get_frame_texture(key,0))
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
 # No change of scale/pivot between RUN and IDLE. This prevents character
 # height popping, foot slipping, and alignment shifts on transitions.
 _apply_dimensions()
 animated_sprite.flip_h = false
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
  _apply_dimensions()
  animated_sprite.flip_h = false # Left RUN frames are already baked.
  facing = direction
  animated_sprite.play(StringName("run_" + direction))
  animated_sprite.set_frame_and_progress(0, 0.0)
  animated_sprite.speed_scale = frames_per_second / 10.0
  animation_state = "run"
 else:
  super.set_direction(direction)

func set_character_height(height_in_pixels: float) -> void:
 # Both IDLE8 and RUN8 use the same native 640px visible body geometry.
 super.set_character_height(height_in_pixels)
