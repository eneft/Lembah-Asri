extends Node2D
## 8-direction high-resolution run: equal body proportions for every direction.
## Normalized frame size: 512x768, foot pivot on (256,708).
## Uniform scaling in every facing direction (never distort X/Y separately).

const DIRECTIONS: Array[String] = [
    "right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"
]
const FOOT_PIVOT := Vector2(-256.0, -708.0)

@export_range(100.0, 400.0, 1.0) var character_height_px: float = 244.0
@export_range(4.0, 20.0, 0.5) var frames_per_second: float = 10.0
@onready var animated_sprite: AnimatedSprite2D = $AnimatedSprite2D
var facing: String = "down"

func _ready() -> void:
    _apply_dimensions()
    set_direction(facing)

func _apply_dimensions() -> void:
    # Source character median visible height is 640 px across all directions.
    var shared_scale: float = character_height_px / 640.0
    animated_sprite.scale = Vector2.ONE * shared_scale
    animated_sprite.offset = FOOT_PIVOT

func set_character_height(height_in_pixels: float) -> void:
    character_height_px = clampf(height_in_pixels, 100.0, 400.0)
    if is_node_ready():
        _apply_dimensions()

func set_from_vector(motion: Vector2) -> void:
    if motion.length_squared() < 0.001:
        return
    var sector: int = posmod(int(round(motion.angle() / (PI / 4.0))), 8)
    set_direction(DIRECTIONS[sector])

func set_direction(direction: String) -> void:
    if not DIRECTIONS.has(direction):
        push_warning("Unknown run direction: " + direction)
        return
    facing = direction
    if not is_node_ready():
        return
    var target := StringName("run_" + direction)
    if animated_sprite.animation != target:
        var old_count: int = animated_sprite.sprite_frames.get_frame_count(animated_sprite.animation)
        var phase: float = 0.0
        if old_count > 0:
            phase = (float(animated_sprite.frame) + animated_sprite.frame_progress) / float(old_count)
        var new_count: int = animated_sprite.sprite_frames.get_frame_count(target)
        if new_count <= 0:
            return
        var target_phase: float = phase * float(new_count)
        animated_sprite.play(target)
        animated_sprite.set_frame_and_progress(int(floor(target_phase)) % new_count, fposmod(target_phase, 1.0))
    elif not animated_sprite.is_playing():
        animated_sprite.play()
    animated_sprite.speed_scale = frames_per_second / 10.0
    # Important: NO direction-specific scale/offset changes.

func set_fps(fps: float) -> void:
    frames_per_second = clampf(fps, 4.0, 20.0)
    if is_node_ready():
        animated_sprite.speed_scale = frames_per_second / 10.0
