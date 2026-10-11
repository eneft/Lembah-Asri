extends CharacterBody2D
## New source: user-provided Run_godot4 (1).zip, 31 genuine right-facing frames.
## Right authentic, left mirrored; up/down remain placeholders (no 8-way run asset).
## Trimmed mid-stride cycle improves loop; walk still reuses run poses until
## separately drawn walk frames exist. No procedural deformation.
@export var walk_speed: float = 160.0
@export var run_speed: float = 325.0

const SOURCE_FRAMES: SpriteFrames = preload("res://assets/characters/run_cycle/Run.tres")
const HERO_GRADE: ShaderMaterial = preload("res://assets/materials/hero_environment_grade.tres")
const DIRECTIONS := ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]
const STATES := ["idle", "walk", "run"]
const RUN_SCALE := 0.182
const RUN_ORIGIN := Vector2(0.0, -70.798) # 778px frame, feet aligned with body collider
# Run.tres frame durations are 0.5, therefore 6.0=12 visible fps
# and 13.0=26 visible fps. Do not replay the startup/stop poses in loop.
const WALK_FPS := 6.0
const RUN_FPS := 13.0
const LOOP_FIRST := 15 # zero-based frame 15
const LOOP_AFTER_LAST := 29 # exclusive frame 29 (14 poses)
var facing: Vector2 = Vector2(1.0, 1.0).normalized()
var facing_name: String = "down_right"
var animation_state: String = "idle"
var using_imported_run: bool = true
var mobile_direction: Vector2 = Vector2.ZERO
var mobile_run_held: bool = false

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
    var actor: AnimatedSprite2D = $AnimatedSprite2D
    actor.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
    actor.centered = true
    actor.scale = Vector2.ONE * RUN_SCALE
    actor.position = RUN_ORIGIN
    actor.material = HERO_GRADE.duplicate() as ShaderMaterial
    _setup_animations()
    actor.play("idle_" + facing_name)
    print("LEMBAH ASRI: imported runner looping source frames 15-28 (14 poses), walk 12fps, run 26fps")

func _setup_animations() -> void:
    assert(SOURCE_FRAMES.has_animation("row_1"))
    assert(SOURCE_FRAMES.get_frame_count("row_1") == 31)
    assert(SOURCE_FRAMES.has_animation("row_6"))
    var frames := SpriteFrames.new()
    if frames.has_animation("default"):
        frames.remove_animation("default")
    for state in STATES:
        for heading in DIRECTIONS:
            var name: String = state + "_" + heading
            frames.add_animation(name)
            frames.set_animation_loop(name, state != "idle")
            frames.set_animation_speed(name, 1.0 if state == "idle" else (RUN_FPS if state == "run" else WALK_FPS))
            if state == "idle":
                frames.add_frame(name, SOURCE_FRAMES.get_frame_texture("row_6", 0), 1.0)
            else:
                # Original row_1 includes anticipation/acceleration frames 0-13
                # and the braking pose at frame 30. Replaying those on every
                # lap made the character appear to stop and restart.
                # Frames 15..28 form a continuous mid-stride section whose
                # closing pose closely resembles its first pose.
                for idx in range(LOOP_FIRST, LOOP_AFTER_LAST):
                    var duration: float = SOURCE_FRAMES.get_frame_duration("row_1", idx)
                    if idx == LOOP_AFTER_LAST - 1:
                        duration *= 0.78 # no extra hold at the loop seam
                    frames.add_frame(name, SOURCE_FRAMES.get_frame_texture("row_1", idx), duration)
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
    var key := animation_state + "_" + facing_name
    var actor: AnimatedSprite2D = $AnimatedSprite2D
    # The supplied ZIP only has right-profile art, not 8 true directions.
    # Left and left diagonals mirror the actual animated frames temporarily.
    actor.flip_h = facing_name == "left" or facing_name == "up_left" or facing_name == "down_left"
    if actor.animation != key:
        var old_name: String = actor.animation
        var old_frame: int = actor.frame
        actor.play(key)
        # Retain real sprite-cycle phase while turning or changing speed.
        if animation_state != "idle" and (old_name.begins_with("walk_") or old_name.begins_with("run_")):
            actor.set_frame_and_progress(old_frame % actor.sprite_frames.get_frame_count(key), 0.0)
    elif not actor.is_playing():
        actor.play(key)

