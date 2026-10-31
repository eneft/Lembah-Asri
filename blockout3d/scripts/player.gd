extends CharacterBody3D

const WALK_SPEED := 5.2
const RUN_SPEED := 8.4
const GRAVITY := 18.0
const JUMP_SPEED := 8.6

var _jump_was_down := false

func _physics_process(delta: float) -> void:
    var direction := Vector3.ZERO
    if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
        direction.z -= 1.0
    if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
        direction.z += 1.0
    if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
        direction.x -= 1.0
    if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
        direction.x += 1.0
    direction = direction.normalized()

    var sprinting := Input.is_key_pressed(KEY_SHIFT)
    var jump_down := Input.is_key_pressed(KEY_SPACE)
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
    move_and_slide()

    var next_animation := "idle"
    if not is_on_floor():
        next_animation = "jump"
    elif direction.length_squared() > 0.001:
        next_animation = "run" if sprinting else "walk"
    var animated_model := get_node_or_null("Visual/FbxCharacter")
    if animated_model != null and animated_model.has_method("play_state"):
        animated_model.call("play_state", next_animation)

    if direction.length_squared() > 0.01:
        var goal := atan2(direction.x, direction.z)
        $Visual.rotation.y = lerp_angle($Visual.rotation.y, goal, minf(1.0, delta * 12.0))
