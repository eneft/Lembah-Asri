extends CharacterBody2D
## Same approved RUN8/IDLE8 frames, now rendered natively by Godot 2D.
const RUN8: SpriteFrames = preload("res://assets/characters/run8_proportional/Run8_SpriteFrames.tres")
const IDLE8: SpriteFrames = preload("res://assets/characters/idle8_new/Idle8_SpriteFrames.tres")
const DIRECTIONS := ["down", "down_right", "right", "up_right", "up", "up_left", "left", "down_left"]
const BODY_NATIVE: float = 640.0
const FOOT_Y: float = 708.0
const IMAGE_HEIGHT: float = 768.0
const PX_TO_UNIT: float = 0.01
@export_range(0.25, 1.0, 0.25) var raster_density: float = 0.25
@export_range(60.0, 180.0, 1.0) var character_height_px: float = 112.0
@export_range(0.0, 16.0, 0.5) var foot_grounding_limit_px: float = 8.0
var _grounding_cache: Dictionary = {}
@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D
var facing: String = "down"
var animation_state: String = "idle"
var generated_atlas_count: int = 0

func _ready() -> void:
 var bank: SpriteFrames = RUN8.duplicate(false) as SpriteFrames
 for direction in DIRECTIONS:
  var key: String = "idle_" + direction
  assert(IDLE8.has_animation(key) and IDLE8.get_frame_count(key) == 1)
  if bank.has_animation(key):
   bank.remove_animation(key)
  bank.add_animation(key)
  bank.set_animation_loop(key, false)
  bank.set_animation_speed(key, 1.0)
  bank.add_frame(key, IDLE8.get_frame_texture(key, 0))
 if raster_density < 0.999:
  bank = _reduce_sprite_bank(bank)
 # Decode the source atlas into frames once, retaining identical visual size.
 # Native2D no longer needs Camera3D or atlas-margin projection.
 bank = _bake_native_sprite3d_frames(bank)
 sprite.sprite_frames = bank
 sprite.centered = false
 sprite.offset = Vector2(-256.0, -FOOT_Y) * raster_density
 sprite.scale = Vector2.ONE * (character_height_px / (BODY_NATIVE * raster_density))
 sprite.flip_h = false
 sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
 set_idle_direction("down")
 _stabilize_run_foot()
 print("PSD NATIVE2D PLAYER READY: RUN8+IDLE8, 112px feet anchored, 8 directions, atlas_count=" + str(generated_atlas_count))

func _reduce_sprite_bank(source_bank: SpriteFrames) -> SpriteFrames:
 var bank := source_bank.duplicate(false) as SpriteFrames
 var cache := {}
 for animation in source_bank.get_animation_names():
  for i in range(source_bank.get_frame_count(animation)):
   var source_frame := source_bank.get_frame_texture(animation, i) as AtlasTexture
   assert(source_frame != null and source_frame.atlas != null)
   var source_key: int = source_frame.atlas.get_instance_id()
   if not cache.has(source_key):
    var image: Image = source_frame.atlas.get_image()
    if image.is_compressed():
     assert(image.decompress() == OK)
    image.resize(maxi(1, roundi(image.get_width() * raster_density)),
     maxi(1, roundi(image.get_height() * raster_density)), Image.INTERPOLATE_LANCZOS)
    cache[source_key] = ImageTexture.create_from_image(image)
   var frame := AtlasTexture.new()
   frame.atlas = cache[source_key]
   frame.region = Rect2(source_frame.region.position * raster_density,
    source_frame.region.size * raster_density)
   frame.margin = Rect2(source_frame.margin.position * raster_density,
    source_frame.margin.size * raster_density)
   frame.filter_clip = source_frame.filter_clip
   bank.set_frame(animation, i, frame, source_bank.get_frame_duration(animation, i))
 generated_atlas_count = cache.size()
 return bank

func _bake_native_sprite3d_frames(source_bank: SpriteFrames) -> SpriteFrames:
 # Small independent 128x192 / cropped ImageTexture frames, generated once.
 # Avoids AtlasTexture region/margin state being invisible in Godot Sprite3D.
 var bank: SpriteFrames = source_bank.duplicate(false) as SpriteFrames
 var count: int = 0
 for animation in source_bank.get_animation_names():
  for i in range(source_bank.get_frame_count(animation)):
   var source_texture: Texture2D = source_bank.get_frame_texture(animation, i)
   var frame_image: Image = source_texture.get_image()
   if frame_image == null or frame_image.is_empty():
    push_error("PSD character missing GPU source frame: " + str(animation) + " / " + str(i))
    continue
   if frame_image.is_compressed() and frame_image.decompress() != OK:
    push_error("PSD character could not decode " + str(animation) + " frame " + str(i))
    continue
   var direct_frame: ImageTexture = ImageTexture.create_from_image(frame_image)
   bank.set_frame(animation, i, direct_frame, source_bank.get_frame_duration(animation, i))
   count += 1
 print("PSD NATIVE2D TEXTURES BAKED: ", count, " native ImageTexture frames; no runtime AtlasTexture geometry")
 return bank

func set_idle_direction(direction: String) -> void:
 if not DIRECTIONS.has(direction):
  return
 facing = direction
 animation_state = "idle"
 if not is_node_ready():
  return
 sprite.animation = StringName("idle_" + direction)
 sprite.set_frame_and_progress(0, 0.0)
 sprite.stop()

func set_run_direction(direction: String) -> void:
 if not DIRECTIONS.has(direction):
  return
 facing = direction
 animation_state = "run"
 if not is_node_ready():
  return
 var target := StringName("run_" + direction)
 if sprite.animation != target or not sprite.is_playing():
  sprite.play(target)

func _process(_delta: float) -> void:
 # The source RUN8 cycle contains natural body bobbing. Correct only the
 # small frame-to-frame difference in the lowest opaque shoe pixel, keeping
 # the physical foot at CharacterBody2D.origin and the contact shadow fixed.
 _stabilize_run_foot()

func _stabilize_run_foot() -> void:
 if sprite == null or sprite.sprite_frames == null:
  return
 var key: String = str(sprite.animation) + ":" + str(sprite.frame)
 if not _grounding_cache.has(key):
  var raw_adjustment: float = 0.0
  if animation_state == "run":
   var texture: Texture2D = sprite.sprite_frames.get_frame_texture(sprite.animation, sprite.frame)
   if texture != null:
    var image: Image = texture.get_image()
    if image != null and not image.is_empty():
     var visible: Rect2i = image.get_used_rect()
     if visible.size.y > 10:
      var source_bottom: float = float(visible.end.y)
      # Reference source atlas has 708px foot pivot; images are already
      # raster_density scaled. Keep the correction subtle, never reshape
      # the body or change foot collision.
      var ideal_bottom: float = FOOT_Y * raster_density
      raw_adjustment = clampf((ideal_bottom - source_bottom) * 0.85,
       -foot_grounding_limit_px / maxf(0.001, sprite.scale.y),
       foot_grounding_limit_px / maxf(0.001, sprite.scale.y))
  _grounding_cache[key] = raw_adjustment
 sprite.offset = Vector2(-256.0, -FOOT_Y) * raster_density + Vector2(0.0, float(_grounding_cache[key]))
