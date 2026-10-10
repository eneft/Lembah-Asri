extends CharacterBody2D
## Original approved player artwork — transparent static sprite, not a placeholder capsule.
## Walk frames and true 4-direction animated sheets are scheduled for the next art pass.

@export var walk_speed: float = 160.0
var facing: Vector2 = Vector2.DOWN
var walk_clock: float = 0.0

# Polygon is defined by valid ground FOOT positions in the approved concept.
# Prevents walking into rooftops, river, painted hills and distant village.
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
    var previous: Vector2 = global_position
    move_and_slide()
    var attempted: Vector2 = global_position
    if not is_walkable_foot(attempted):
        var try_horizontal := Vector2(attempted.x, previous.y)
        var try_vertical := Vector2(previous.x, attempted.y)
        if is_walkable_foot(try_horizontal):
            global_position = try_horizontal
        elif is_walkable_foot(try_vertical):
            global_position = try_vertical
        else:
            global_position = previous
    if direction.length_squared() > 0.0:
        facing = direction
        walk_clock += delta * 11.0
        $Avatar.position.y = -176.0 + sin(walk_clock) * 1.4
        if abs(direction.x) > 0.2:
            $Avatar.flip_h = direction.x < 0.0
    else:
        $Avatar.position.y = move_toward($Avatar.position.y, -176.0, 15.0 * delta)
