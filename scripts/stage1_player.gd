extends CharacterBody2D
## Original approved player artwork — transparent static sprite, not a placeholder capsule.
## Walk frames and true 4-direction animated sheets are scheduled for the next art pass.

@export var walk_speed: float = 160.0
var facing: Vector2 = Vector2.DOWN
var walk_clock: float = 0.0

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
    direction = direction.normalized()
    velocity = direction * walk_speed
    move_and_slide()
    if direction.length_squared() > 0.0:
        facing = direction
        walk_clock += delta * 11.0
        $Avatar.position.y = -176.0 + sin(walk_clock) * 1.4
        if abs(direction.x) > 0.2:
            $Avatar.flip_h = direction.x < 0.0
    else:
        $Avatar.position.y = move_toward($Avatar.position.y, -176.0, 15.0 * delta)
    # Solid outer map bounds. Physical obstacles handled by move_and_slide().
    global_position = global_position.clamp(Vector2(35.0, 200.0), Vector2(1635.0, 901.0))
