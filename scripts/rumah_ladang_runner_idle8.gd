extends "res://assets/characters/run8_proportional/Run8Player.gd"
## Isolated Rumah-Ladang IDLE8 + RUN8 renderer. Source art stays untouched.
## Raster density only changes texture detail, never the avatar's world height.
## Approved native RUN8/IDLE8 use a 512x768 canvas, 640px visible body,
## shared foot pivot (256,708), and character_height_px=112 world pixels.
const IDLE8_SOURCE: SpriteFrames = preload("res://assets/characters/idle8_new/Idle8_SpriteFrames.tres")
const IDLE8_ATLAS_PATH := "res://assets/characters/idle8_new/Idle8_Normalized.png"
const NATIVE_BODY_HEIGHT: float = 640.0
const FOOT_ANCHOR := Vector2(256.0, 708.0)
@export_range(0.25, 1.0, 0.25) var raster_density: float = 0.25
var active_raster_density: float = 1.0
var animation_state: String = "idle"

func _ready() -> void:
 super._ready()
 _install_idles()
 _install_reduced_resolution()
 set_idle_direction(facing)
 print("RUMAH LADANG IDLE8 NEW READY: eight individually generated normalized standing poses; RUN8 preserved")
 print("RUMAH LADANG CHARACTER DENSITY: %d percent source resolution; %d effective body pixels; %d world pixels; linear filtering" % [roundi(active_raster_density * 100.0), roundi(NATIVE_BODY_HEIGHT * active_raster_density), roundi(character_height_px)])

func _install_idles() -> void:
 # Never modify the shared HD RUN8 SpriteFrames; used by the main scene.
 var bank: SpriteFrames = animated_sprite.sprite_frames.duplicate(false) as SpriteFrames
 assert(bank != null, "Approved RUN8 SpriteFrames missing")
 for direction in DIRECTIONS:
  var key: String = "idle_" + direction
  assert(IDLE8_SOURCE.has_animation(key), "Missing new IDLE8 pose " + key)
  assert(IDLE8_SOURCE.get_frame_count(key) == 1, "IDLE8 inventory mismatch " + key)
  if bank.has_animation(key):
   bank.remove_animation(key)
  bank.add_animation(key)
  bank.set_animation_loop(key, false)
  bank.set_animation_speed(key, 1.0)
  bank.add_frame(key, IDLE8_SOURCE.get_frame_texture(key, 0))
 animated_sprite.sprite_frames = bank

func _install_reduced_resolution() -> void:
 # Build an independent quarter-resolution texture bank in memory, rather
 # than swapping the HD PNGs on disk or changing the character's world scale.
 # The three source atlases (RUN base, RUN mirrored, IDLE8) are each resized
 # only once; AtlasTexture region AND margin are scaled by the same factor.
 if raster_density >= 0.999:
  return
 var original_bank: SpriteFrames = animated_sprite.sprite_frames
 var reduced_bank: SpriteFrames = original_bank.duplicate(false) as SpriteFrames
 if reduced_bank == null:
  push_warning("Cannot make a separate reduced SpriteFrames bank; keeping HD")
  return
 var converted_atlases: Dictionary = {}
 for animation in original_bank.get_animation_names():
  for index in range(original_bank.get_frame_count(animation)):
   var src: AtlasTexture = original_bank.get_frame_texture(animation, index) as AtlasTexture
   if src == null or src.atlas == null:
    push_warning("Density conversion unavailable for " + str(animation) + "; keeping HD")
    return
   var atlas_id: int = src.atlas.get_instance_id()
   if not converted_atlases.has(atlas_id):
    var bitmap: Image = src.atlas.get_image()
    if bitmap == null or bitmap.is_empty():
     push_warning("Source atlas unreadable; keeping HD")
     return
    if bitmap.is_compressed() and bitmap.decompress() != OK:
     push_warning("Source atlas cannot decompress; keeping HD")
     return
    var low_w: int = maxi(1, roundi(float(bitmap.get_width()) * raster_density))
    var low_h: int = maxi(1, roundi(float(bitmap.get_height()) * raster_density))
    # Lanczos retains silhouettes and soft painted edges rather than
    # creating large, jagged pixel blocks against the illustrated background.
    bitmap.resize(low_w, low_h, Image.INTERPOLATE_LANCZOS)
    var reduced_texture: ImageTexture = ImageTexture.create_from_image(bitmap)
    if reduced_texture == null:
     push_warning("Could not generate scaled atlas; keeping HD")
     return
    converted_atlases[atlas_id] = reduced_texture
   var frame := AtlasTexture.new()
   frame.atlas = converted_atlases[atlas_id]
   frame.region = Rect2(src.region.position * raster_density, src.region.size * raster_density)
   frame.margin = Rect2(src.margin.position * raster_density, src.margin.size * raster_density)
   frame.filter_clip = src.filter_clip
   reduced_bank.set_frame(animation, index, frame, original_bank.get_frame_duration(animation, index))
 animated_sprite.sprite_frames = reduced_bank
 active_raster_density = raster_density
 animated_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
 _apply_dimensions()

func _apply_dimensions() -> void:
 # In Godot, pixel density and WORLD scale are different properties.
 # At 25% texture density: 640px body becomes 160px, but still draws 112px
 # tall. Scaling the native offset proportionally keeps the same foot anchor.
 super._apply_dimensions()
 if active_raster_density < 0.999:
  animated_sprite.scale /= active_raster_density
  animated_sprite.offset *= active_raster_density

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
  animated_sprite.flip_h = false # RUN8 left frames are baked separately.
  facing = direction
  animated_sprite.play(StringName("run_" + direction))
  animated_sprite.set_frame_and_progress(0, 0.0)
  animated_sprite.speed_scale = frames_per_second / 10.0
  animation_state = "run"
 else:
  super.set_direction(direction)

func set_character_height(height_in_pixels: float) -> void:
 # Both RUN8 and IDLE8 still occupy exactly the same 112px world height.
 super.set_character_height(height_in_pixels)
