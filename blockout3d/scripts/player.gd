extends CharacterBody3D

const WALK_SPEED := 5.2
const RUN_SPEED := 8.4
const GRAVITY := 18.0

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
    var speed := RUN_SPEED if Input.is_key_pressed(KEY_SHIFT) else WALK_SPEED
    velocity.x = direction.x * speed
    velocity.z = direction.z * speed
    if not is_on_floor():
        velocity.y -= GRAVITY * delta
    else:
        velocity.y = -0.1
    move_and_slide()
    if direction.length_squared() > 0.01:
        var goal := atan2(direction.x, direction.z)
        $Visual.rotation.y = lerp_angle($Visual.rotation.y, goal, delta * 12.0)
