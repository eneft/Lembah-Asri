extends CharacterBody2D
## Lembah Asri: 8-direction illustrated character animation.
## Preserves the original walkable courtyard and collision rules.
@export var walk_speed: float = 160.0
@export var run_speed: float = 255.0

## Pixel dimensions unchanged from 2D HD turnaround source; Godot uses lossless PNG.
## One fixed full-body art source per direction. No mix with prior AI motion frames.
const DIRECTION_TEXTURES = {
    "right": preload("res://assets/characters/player_hd/right.png"),
    "down_right": preload("res://assets/characters/player_hd/down_right.png"),
    "down": preload("res://assets/characters/player_hd/down.png"),
    "down_left": preload("res://assets/characters/player_hd/down_left.png"),
    "left": preload("res://assets/characters/player_hd/left.png"),
    "up_left": preload("res://assets/characters/player_hd/up_left.png"),
    "up": preload("res://assets/characters/player_hd/up.png"),
    "up_right": preload("res://assets/characters/player_hd/up_right.png")
}
const DIRECTIONS := ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]
const STATES := ["idle", "walk", "run"]
const FPS := 12.0
const GAIT_SHADER = preload("res://shaders/hero_gait.gdshader")

var facing: Vector2 = Vector2(1.0, 1.0).normalized()
var facing_name: String = "down_right"
var animation_state: String = "idle"
var gait_phase: float = 0.0
var gait_strength: float = 0.0
var gait_material: ShaderMaterial

# Valid FOOT positions in the approved illustrated concept.
var walk_polygon: PackedVector2Array = PackedVector2Array([
    Vector2(245,545), Vector2(325,509), Vector2(435,480), Vector2(545,463),
    Vector2(620,473), Vector2(665,496), Vector2(733,495), Vector2(807,515),
    Vector2(927,530), Vector2(1060,551), Vector2(1090,584), Vector2(1044,607),
    Vector2(936,598), Vector2(878,614), Vector2(800,630), Vector2(730,652),
    Vector2(652,648), Vector2(593,630), Vector2(511,622), Vector2(410,637),
    Vector2(312,623), Vector2(251,590)
])

func is_walkable_foot(point: Vector2) -> bool:
    return Geometry2D.is_point_in_polygon(point, walk_polygon)

func _ready() -> void:
    if not InputMap.has_action("run"):
        InputMap.add_action("run")
    var shift := InputEventKey.new()
    shift.physical_keycode = KEY_SHIFT
    if not InputMap.action_has_event("run", shift):
        InputMap.action_add_event("run", shift)
    _setup_animations()
    _setup_gait_material()
    $Avatar.visible = false
    $AnimatedSprite2D.play("idle_" + facing_name)

func _setup_animations() -> void:
    var frames := SpriteFrames.new()
    if frames.has_animation("default"):
        frames.remove_animation("default")
    for state in STATES:
        for direction in DIRECTIONS:
            var name: String = state + "_" + direction
            frames.add_animation(name)
            frames.set_animation_speed(name, FPS)
            frames.set_animation_loop(name, true)
            # Walk/run intentionally retain the SAME approved HD silhouette
            # until true rigged animation is produced from a single master.
            # Never mix HD idle art with the old low-resolution chibi atlas.
            frames.add_frame(name, DIRECTION_TEXTURES[direction])
    $AnimatedSprite2D.sprite_frames = frames

func _nearest_eight_direction(v: Vector2) -> String:
    var octant: int = posmod(int(round(v.angle() / (PI / 4.0))), 8)
    return DIRECTIONS[octant]

func _physics_process(_delta: float) -> void:
    var direction := Vector2.ZERO
    if Input.is_key_pressed(KEY_A) or Input.is_action_pressed("ui_left"):
        direction.x -= 1.0
    if Input.is_key_pressed(KEY_D) or Input.is_action_pressed("ui_right"):
        direction.x += 1.0
    if Input.is_key_pressed(KEY_W) or Input.is_action_pressed("ui_up"):
        direction.y -= 1.0
    if Input.is_key_pressed(KEY_S) or Input.is_action_pressed("ui_down"):
        direction.y += 1.0
    direction = direction.normalized()

    var wants_to_move := direction.length_squared() > 0.001
    var running := wants_to_move and (Input.is_key_pressed(KEY_SHIFT) or Input.is_action_pressed("run"))
    velocity = direction * (run_speed if running else walk_speed)

    var previous: Vector2 = global_position
    move_and_slide()
    var attempted: Vector2 = global_position
    if not is_walkable_foot(attempted):
        var horizontal := Vector2(attempted.x, previous.y)
        var vertical := Vector2(previous.x, attempted.y)
        if is_walkable_foot(horizontal):
            global_position = horizontal
        elif is_walkable_foot(vertical):
            global_position = vertical
        else:
            global_position = previous

    if wants_to_move:
        facing = direction
        facing_name = _nearest_eight_direction(direction)
    var moved_px: float = global_position.distance_to(previous)
    var really_moved := moved_px > 0.001
    animation_state = ("run" if running else "walk") if (wants_to_move and really_moved) else "idle"
    var key := animation_state + "_" + facing_name
    var actor: AnimatedSprite2D = $AnimatedSprite2D
    if actor.animation != key or not actor.is_playing():
        actor.play(key)
    # Foot motion is tied to *actual* travelled distance, not elapsed time.
    # Colliding with a fence/wall cannot cause feet to run in place.
    _advance_gait(_delta, moved_px if wants_to_move else 0.0, running)

func _setup_gait_material() -> void:
    gait_material = ShaderMaterial.new()
    gait_material.shader = GAIT_SHADER
    $AnimatedSprite2D.material = gait_material
    gait_material.set_shader_parameter("strength", 0.0)

func _advance_gait(delta: float, moved_px: float, running: bool) -> void:
    var moving: bool = moved_px > 0.001
    var target_strength: float = 0.0
    if moving:
        # Cycle is driven by ground distance: consistent foot placement
        # across 8 directions, variable FPS and collisions.
        # Running has a longer stride and stronger, faster deformation.
        var stride_px: float = 112.0 if running else 90.0
        target_strength = 0.82 if running else 0.52
        gait_phase = wrapf(gait_phase + TAU * moved_px / stride_px, 0.0, TAU)
    # Blend in/out smoothly; idle settles to the original unchanged pose.
    gait_strength = move_toward(gait_strength, target_strength, delta * 6.0)
    gait_material.set_shader_parameter("phase", gait_phase)
    gait_material.set_shader_parameter("strength", gait_strength)
    gait_material.set_shader_parameter("profile", absf(facing.x))
    gait_material.set_shader_parameter("direction_sign", -1.0 if facing.x < -0.001 else 1.0)

