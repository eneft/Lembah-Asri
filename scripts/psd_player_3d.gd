extends Node3D
## Approved native RUN8 + IDLE8 displayed on a genuine 3D animated sprite.
const RUN8: SpriteFrames = preload("res://assets/characters/run8_proportional/Run8_SpriteFrames.tres")
const IDLE8: SpriteFrames = preload("res://assets/characters/idle8_new/Idle8_SpriteFrames.tres")
const DIRECTIONS := ["down", "down_right", "right", "up_right", "up", "up_left", "left", "down_left"]
const BODY_NATIVE: float = 640.0
const FOOT_Y: float = 708.0
const IMAGE_HEIGHT: float = 768.0
const PX_TO_UNIT: float = 0.01
@export_range(0.25, 1.0, 0.25) var raster_density: float = 0.25
@export_range(60.0, 180.0, 1.0) var character_height_px: float = 112.0
@onready var sprite: AnimatedSprite3D = $AnimatedSprite3D
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
 sprite.sprite_frames = bank
 sprite.pixel_size = PX_TO_UNIT * character_height_px / (BODY_NATIVE * raster_density)
 sprite.position = Vector3(0.0, (FOOT_Y - IMAGE_HEIGHT * 0.5) * raster_density * sprite.pixel_size, 0.0)
 sprite.centered = true
 sprite.flip_h = false
 sprite.shaded = false
 sprite.transparent = true
 set_idle_direction("down")
 print("PSD 3D CHARACTER READY: RUN8+IDLE8, 112px world, 8 directions, atlas_count=" + str(generated_atlas_count))

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
