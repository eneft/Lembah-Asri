extends CharacterBody2D
## Lembah Asri: 8-direction illustrated character animation.
## Preserves the original walkable courtyard and collision rules.
@export var walk_speed: float = 160.0
@export var run_speed: float = 255.0

## Pixel dimensions unchanged from 2D HD turnaround source; Godot uses lossless PNG.
## Eight approved HD direction masters are used for idle; walk uses available atlases.
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
const BASE_DIR := "res://assets/characters/player_base_8dir/"
const BASE_CANVAS := Vector2i(1152, 1632)
const BASE_SPRITE_SCALE := 0.15
const BASE_SPRITE_POSITION := Vector2(0.0, -115.35) # (1585 - 816)*0.15
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
    print("LEMBAH ASRI: 8-direction RGBA base character active (static poses)")
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

