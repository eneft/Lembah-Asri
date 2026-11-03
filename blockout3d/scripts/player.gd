extends CharacterBody3D

const WALK_SPEED := 5.2
const RUN_SPEED := 8.4
const GRAVITY := 18.0
const JUMP_SPEED := 8.6

var _jump_was_down := false
# Opt-in only for Terrain V3. Other preview worlds keep their old controls.
var camera_relative_movement := false
var movement_camera: Camera3D

# Physics positions for smooth camera sampling in _process() between fixed
# physics ticks. Opt-in only: the original gameplay movement remains unchanged.
var _render_previous_position := Vector3.ZERO
var _render_current_position := Vector3.ZERO
var _render_position_initialized := false

func get_camera_follow_position() -> Vector3:
    if not _render_position_initialized:
        return global_position
    var blend := clampf(Engine.get_physics_interpolation_fraction(), 0.0, 1.0)
    return _render_previous_position.lerp(_render_current_position, blend)

func reset_camera_follow_interpolation() -> void:
    # Scene spawn/teleport: never blend across the previous location.
    _render_previous_position = global_position
    _render_current_position = global_position
    _render_position_initialized = true
    var visual := get_node_or_null("Visual") as Node3D
    if visual != null and camera_relative_movement:
        visual.position = Vector3.ZERO

func _process(_delta: float) -> void:
    # Godot 4.3 interpolates 2D render transforms only, not 3D physics nodes.
    # Camera was already sampling this interpolated position, but the VISUAL
    # avatar was still rendered at stepped CharacterBody3D physics coordinates.
    # Use the identical interpolated target for BOTH. Keep collision physics
    # and raw CharacterBody3D translation untouched.
    if not camera_relative_movement:
        return
    var visual := get_node_or_null("Visual") as Node3D
    if visual == null:
        return
    visual.position = get_camera_follow_position() - global_position


func _ready() -> void:
    floor_snap_length = 0.35
    floor_max_angle = deg_to_rad(50.0)
    floor_stop_on_slope = true
    safe_margin = 0.02
    max_slides = 6

func _read_movement_direction() -> Vector3:
    # Keyboard remains digital. Mobile joystick applies its real analog
    # strength, so a slight stick tilt walks slowly and diagonals stay smooth.
    var keyboard := Vector3.ZERO
    if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
        keyboard.z -= 1.0
    if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
        keyboard.z += 1.0
    if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
        keyboard.x -= 1.0
    if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
        keyboard.x += 1.0
    var joystick := Vector3.ZERO
    if InputMap.has_action("touch_forward"):
        joystick.x = Input.get_action_strength("touch_right") - Input.get_action_strength("touch_left")
        joystick.z = Input.get_action_strength("touch_back") - Input.get_action_strength("touch_forward")
    return (keyboard + joystick).limit_length(1.0)

func _camera_relative_direction(screen_input: Vector3) -> Vector3:
    # Input direction is SCREEN-SPACE: right/down/up correspond to joystick
    # or WASD. Camera orbit must not swap controls when the view turns 180°.
    # Rotate only horizontal motion; never transfer camera pitch into Y.
    if not camera_relative_movement or not is_instance_valid(movement_camera):
        return screen_input
    var flat_right := movement_camera.global_transform.basis.x
    var flat_forward := -movement_camera.global_transform.basis.z
    flat_right.y = 0.0
    flat_forward.y = 0.0
    if flat_right.length_squared() < 0.0001:
        return screen_input
    flat_right = flat_right.normalized()
    # When the camera looks STRAIGHT down or up in full free orbit, its
    # projected forward vector vanishes. Preserve camera-relative horizontal
    # movement instead of snapping the joystick back to world axes.
    if flat_forward.length_squared() < 0.0001:
        flat_forward = Vector3(flat_right.z, 0.0, -flat_right.x)
    else:
        flat_forward = flat_forward.normalized()
    return (flat_right * screen_input.x - flat_forward * screen_input.z).limit_length(1.0)


func _physics_process(delta: float) -> void:
    # Keep last complete physics-step positions. The render-follow camera can
    # interpolate these instead of receiving 60 Hz stair-step transforms.
    if _render_position_initialized:
        _render_previous_position = _render_current_position
    else:
        _render_previous_position = global_position
        _render_position_initialized = true
    var direction := _camera_relative_direction(_read_movement_direction())
    var sprinting := Input.is_key_pressed(KEY_SHIFT) or Input.is_action_pressed("touch_run")
    var jump_down := Input.is_key_pressed(KEY_SPACE) or Input.is_action_pressed("touch_jump")
    var grounded_before := is_on_floor()
    if jump_down and not _jump_was_down and grounded_before:
        velocity.y = JUMP_SPEED
    elif not grounded_before:
        velocity.y -= GRAVITY * delta
    else:
        velocity.y = -0.12
    _jump_was_down = jump_down

    var speed := RUN_SPEED if sprinting else WALK_SPEED
    velocity.x = direction.x * speed
    velocity.z = direction.z * speed
    var impact_velocity := velocity.y
    move_and_slide()
    _render_current_position = global_position
    # A teleport/reset must not create a huge interpolation streak.
    if _render_previous_position.distance_to(_render_current_position) > 2.0:
        _render_previous_position = _render_current_position

    var next_animation := "idle"
    if not is_on_floor():
        next_animation = "jump"
    elif direction.length_squared() > 0.001:
        next_animation = "run" if sprinting else "walk"
    var animated_model := get_node_or_null("Visual/FbxCharacter")
    if animated_model != null and animated_model.has_method("update_motion"):
        var landed := not grounded_before and is_on_floor()
        animated_model.call("update_motion", next_animation, velocity.y, landed, -impact_velocity, delta)

    if direction.length_squared() > 0.01:
        var goal := atan2(direction.x, direction.z)
        $Visual.rotation.y = lerp_angle($Visual.rotation.y, goal, minf(1.0, delta * 12.0))
