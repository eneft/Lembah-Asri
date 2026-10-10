extends CharacterBody3D
## Player prototype: capsule placeholder, NOT approved final character artwork.

@export var move_speed: float = 5.0
@export var rotate_speed: float = 11.0

func _ready() -> void:
    var body: MeshInstance3D = $PlaceholderBody
    var material := StandardMaterial3D.new()
    material.albedo_color = Color("668b56")
    material.roughness = 1.0
    body.material_override = material

func _physics_process(delta: float) -> void:
    var input_dir := Vector2.ZERO
    if Input.is_key_pressed(KEY_A) or Input.is_action_pressed("ui_left"):
        input_dir.x -= 1.0
    if Input.is_key_pressed(KEY_D) or Input.is_action_pressed("ui_right"):
        input_dir.x += 1.0
    if Input.is_key_pressed(KEY_W) or Input.is_action_pressed("ui_up"):
        input_dir.y -= 1.0
    if Input.is_key_pressed(KEY_S) or Input.is_action_pressed("ui_down"):
        input_dir.y += 1.0
    input_dir = input_dir.normalized()
    velocity.x = input_dir.x * move_speed
    velocity.z = input_dir.y * move_speed
    if is_on_floor():
        velocity.y = -0.1
    else:
        velocity.y -= 16.0 * delta
    move_and_slide()
    if input_dir.length_squared() > 0.01:
        var goal := atan2(input_dir.x, input_dir.y)
        $PlaceholderBody.rotation.y = lerp_angle($PlaceholderBody.rotation.y, goal, min(1.0, delta * rotate_speed))
