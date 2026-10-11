extends CharacterBody2D
## Lembah Asri: 8-direction illustrated character animation.
## Preserves the original walkable courtyard and collision rules.
@export var walk_speed: float = 160.0
@export var run_speed: float = 255.0

## Pixel dimensions unchanged from 2D HD turnaround source; Godot uses lossless PNG.
## Approved 8 HD masters stay as-is. Walking is a 12-phase GPU deformation,
## not hand-drawn frames. The shader animates both legs/feet and opposing arms.
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
# Eight native, individually rendered RGBA masters (no horizontal mirroring).
# All eight files must be present to activate the new base-form character.
# If someone checks out this code before the large PNG assets have been added,
# the existing animated 16-frame character remains intact as a safe fallback.
# Render-only treatment. Tune lighting and contrast through this material
# in the Godot Inspector; do not alter source images for environmental grading.
const HERO_ENVIRONMENT_GRADE = preload("res://assets/materials/hero_environment_grade.tres")
const BASE_DIR := "res://assets/characters/player_base_8dir/"
const BASE_CANVAS := Vector2i(1152, 1632)
const BASE_SPRITE_SCALE := 0.105 # 30% smaller; more appropriate to the painted courtyard
const BASE_SPRITE_POSITION := Vector2(0.0, -80.745) # (1585 - 816) * 0.105, feet remain at ground origin
# 12 distinct time samples over one full left/right step cycle.
const GAIT_POSES: int = 12
const WALK_POSES_PER_SECOND: float = 12.0
const RUN_POSES_PER_SECOND: float = 16.0
const STATES := ["idle", "walk", "run"]
const FPS := 12.0
const WALK_ATLASES = {
    "up": preload("res://assets/characters/player_hd/walk16/up.png"),
    "up_right": preload("res://assets/characters/player_hd/walk16/up_right.png"),
    "right": preload("res://assets/characters/player_hd/walk16/right.png"),
    "down_right": preload("res://assets/characters/player_hd/walk16/down_right.png"),
    "down": preload("res://assets/characters/player_hd/walk16/down.png")
}
const WALK_FRAMES: int = 16
const FRAME_W: float = 512.0
const FRAME_H: float = 640.0
const WALK_FPS: float = 12.0
const RUN_FPS: float = 16.0

var facing: Vector2 = Vector2(1.0, 1.0).normalized()
var facing_name: String = "down_right"
var animation_state: String = "idle"
var using_base_form: bool = false
var base_textures: Dictionary = {}
# Independent touch input merges with WASD without simulating keyboard presses.
var mobile_direction: Vector2 = Vector2.ZERO
var mobile_run_held: bool = false
# Kept independently of AnimatedSprite2D's one-frame original direction art.
var gait_frame_index: int = 0
var gait_time_frames: float = 0.0
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
    using_base_form = _load_base_forms()
    _setup_animations()
    # Duplicate per character so animation uniforms cannot leak into other actors.
    # The existing color grade stays active on every animated pose.
    gait_material = HERO_ENVIRONMENT_GRADE.duplicate() as ShaderMaterial
    $AnimatedSprite2D.material = gait_material
    _update_gait_shader()
    if using_base_form:
        # Foot baseline is world Y = 0, i.e. the CharacterBody2D collision origin.
        $AnimatedSprite2D.scale = Vector2.ONE * BASE_SPRITE_SCALE
        $AnimatedSprite2D.position = BASE_SPRITE_POSITION
    $Avatar.visible = false
    $AnimatedSprite2D.play("idle_" + facing_name)

func _load_base_forms() -> bool:
    var loaded: Dictionary = {}
    for direction in DIRECTIONS:
        var path: String = BASE_DIR + direction + ".png"
        if not ResourceLoader.exists(path):
            return false
        var tex: Texture2D = load(path) as Texture2D
        if tex == null or tex.get_width() != BASE_CANVAS.x or tex.get_height() != BASE_CANVAS.y:
            push_warning("Lembah Asri: invalid HD base image " + path)
            return false
        loaded[direction] = tex
    base_textures = loaded
    print("LEMBAH ASRI: 8-direction original RGBA masters loaded for 12-phase walk")
    return true

func _atlas_direction(direction: String) -> String:
    match direction:
        "up_left":
            return "up_right"
        "left":
            return "right"
        "down_left":
            return "down_right"
        _:
            return direction

func _setup_animations() -> void:
    var frames := SpriteFrames.new()
    if frames.has_animation("default"):
        frames.remove_animation("default")
    for state in STATES:
        for direction in DIRECTIONS:
            var name: String = state + "_" + direction
            frames.add_animation(name)
            frames.set_animation_loop(name, true)
            frames.set_animation_speed(name, 1.0 if state == "idle" else (RUN_FPS if state == "run" else WALK_FPS))
            if using_base_form:
                # These are authored direction bases, not fake walk/run frames.
                # Preserve keyboard movement while artwork remains a still pose.
                frames.add_frame(name, base_textures[direction])
            elif state == "idle":
                # Legacy master poses stay available until all new assets are added.
                frames.add_frame(name, DIRECTION_TEXTURES[direction])
            else:
                var atlas: Texture2D = WALK_ATLASES[_atlas_direction(direction)]
                for i in range(WALK_FRAMES):
                    var f := AtlasTexture.new()
                    f.atlas = atlas
                    f.region = Rect2(float(i % 4) * FRAME_W, float(int(i / 4)) * FRAME_H, FRAME_W, FRAME_H)
                    frames.add_frame(name, f)
    $AnimatedSprite2D.sprite_frames = frames

# The 12 steps are temporal samples, not duplicates of the original PNG.
# Rear views must keep their own hair/backpack art and never be flipped.
func _gait_profile() -> float:
    if facing_name == "left" or facing_name == "right":
        return 1.0
    if facing_name.ends_with("_left") or facing_name.ends_with("_right"):
        return 0.55
    return 0.0

func _gait_sign() -> float:
    # Opposite screen directions reverse which leg enters the contact pose.
    if facing_name == "left" or facing_name == "down_left" or facing_name == "up_left" or facing_name == "up":
        return -1.0
    return 1.0

func _update_gait_shader() -> void:
    if gait_material == null:
        return
    # Original idle stays perfectly still; same eight image assets for all states.
    var playing_gait := using_base_form and animation_state != "idle"
    gait_material.set_shader_parameter("gait_strength", (1.25 if animation_state == "run" else 1.0) if playing_gait else 0.0)
    gait_material.set_shader_parameter("gait_phase", TAU * float(gait_frame_index) / float(GAIT_POSES))
    gait_material.set_shader_parameter("gait_profile", _gait_profile())
    gait_material.set_shader_parameter("gait_sign", _gait_sign())

func _nearest_eight_direction(v: Vector2) -> String:
    var octant: int = posmod(int(round(v.angle() / (PI / 4.0))), 8)
    return DIRECTIONS[octant]

func _physics_process(delta: float) -> void:
    var direction := Vector2.ZERO
    if Input.is_key_pressed(KEY_A) or Input.is_action_pressed("ui_left"):
        direction.x -= 1.0
    if Input.is_key_pressed(KEY_D) or Input.is_action_pressed("ui_right"):
        direction.x += 1.0
    if Input.is_key_pressed(KEY_W) or Input.is_action_pressed("ui_up"):
        direction.y -= 1.0
    if Input.is_key_pressed(KEY_S) or Input.is_action_pressed("ui_down"):
        direction.y += 1.0
    # A joystick is analog and may be held while the second finger runs/acts.
    # Real keyboard input takes priority if both input methods are used.
    if direction.length_squared() < 0.001:
        direction = mobile_direction.limit_length(1.0)
    else:
        direction = direction.normalized()

    var wants_to_move := direction.length_squared() > 0.001
    var running := wants_to_move and (mobile_run_held or Input.is_key_pressed(KEY_SHIFT) or Input.is_action_pressed("run"))
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
    if using_base_form:
        if animation_state == "idle":
            gait_time_frames = 0.0
            gait_frame_index = 0
        else:
            gait_time_frames = fmod(
                gait_time_frames + delta * (RUN_POSES_PER_SECOND if running else WALK_POSES_PER_SECOND),
                float(GAIT_POSES)
            )
            gait_frame_index = int(floor(gait_time_frames)) % GAIT_POSES
        _update_gait_shader()
    var key := animation_state + "_" + facing_name
    var actor: AnimatedSprite2D = $AnimatedSprite2D
    # New masters are eight unique hand-rendered directions; never flip hair/backpack.
    # Legacy walk atlases still mirror missing left directions when fallback is active.
    actor.flip_h = not using_base_form and animation_state != "idle" and (facing_name == "left" or facing_name == "up_left" or facing_name == "down_left")
    if actor.animation != key:
        var old_name: String = actor.animation
        var old_frame: int = actor.frame
        actor.play(key)
        # Keep the stride phase when switching directions while moving.
        if not using_base_form and animation_state != "idle" and (old_name.begins_with("walk_") or old_name.begins_with("run_")):
            actor.set_frame_and_progress(old_frame % WALK_FRAMES, 0.0)
    elif not actor.is_playing():
        actor.play(key)

