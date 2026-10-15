extends AnimatedSprite2D
## Native 2D projected silhouette shadow, synced to the actual RUN8/IDLE8 frame.
const CAST_LENGTHS := [0.44, 0.24, 0.51, 0.24]
const CAST_SHEARS := [-0.32, -0.055, 0.37, -0.07]
const CAST_ALPHAS := [0.26, 0.20, 0.29, 0.14]
const FOOT_OFFSETS := [Vector2(1, 1), Vector2(0, 1), Vector2(-1, 2), Vector2(0, 1)]
@export_range(0.0, 2.0, 0.05) var silhouette_size: float = 1.0
@export_range(0.0, 1.0, 0.05) var silhouette_opacity: float = 1.0
@onready var stage: Node2D = get_node("..") as Node2D
@onready var hero: AnimatedSprite2D = get_node("../Run8Player/AnimatedSprite2D") as AnimatedSprite2D
@onready var avatar: CharacterBody2D = get_node("../Run8Player") as CharacterBody2D
@onready var driver: AnimatedSprite2D = get_node("../Run8Player/AnimatedSprite2D") as AnimatedSprite2D
var shadow_length: float = 0.24
var shadow_shear: float = -0.055
var shadow_alpha: float = 0.20
var foot_offset: Vector2 = Vector2(0, 1)

func _ready() -> void:
 process_priority = 10
 z_index = 2 # Above opaque ground Sprite2D z=0, below hero z=3
 texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
 call_deferred("_sync_shadow", 0.0, true)
 print("PSD NATIVE2D HUMAN SHADOW READY: RUN8/IDLE8 silhouette ground projection")

func _process(delta: float) -> void:
 _sync_shadow(delta)

func _sync_shadow(delta: float, instant: bool = false) -> void:
 if hero == null or hero.sprite_frames == null or driver == null:
  return
 if sprite_frames != hero.sprite_frames:
  sprite_frames = hero.sprite_frames
 centered = false
 offset = hero.offset
 if animation != driver.animation:
  animation = driver.animation
 if frame != driver.frame:
  set_frame_and_progress(driver.frame, driver.frame_progress)
 pause()
 var preset: int = clampi(int(stage.get("lighting_preset_index")), 0, 3)
 var speed: float = maxf(0.1, float(stage.get("lighting_transition_speed")))
 var weight: float = 1.0 if instant else (1.0 - exp(-speed * maxf(0.0, delta)))
 shadow_length = lerpf(shadow_length, CAST_LENGTHS[preset], weight)
 shadow_shear = lerpf(shadow_shear, CAST_SHEARS[preset], weight)
 shadow_alpha = lerpf(shadow_alpha, CAST_ALPHAS[preset], weight)
 foot_offset = foot_offset.lerp(FOOT_OFFSETS[preset], weight)
 var density: float = float(avatar.get("raster_density"))
 var base_scale: float = float(avatar.get("character_height_px")) / (640.0 * density)
 var depth: float = hero.scale.x / maxf(0.0001, base_scale)
 var shadow_scale: float = hero.scale.x * silhouette_size
 # Upright head pixels are negative relative to their foot; negative Y scale
 # flattens the entire moving silhouette onto the painted ground.
 transform = Transform2D(
  Vector2(shadow_scale, 0.0),
  Vector2(shadow_shear * shadow_scale, -shadow_length * shadow_scale),
  avatar.position + foot_offset * depth
 )
 var mat: ShaderMaterial = material as ShaderMaterial
 if mat != null:
  mat.set_shader_parameter("shadow_opacity", shadow_alpha * silhouette_opacity)
