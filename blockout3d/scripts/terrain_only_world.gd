extends "res://scripts/world.gd"
## Independent terrain-only gameplay preview.
## The original /blockout3d/ island, original FBX assets and all animation
## timings stay untouched. Only this clean /terrain-test/ world changes.

const TERRAIN_CHARACTER_SCALE := 0.74
const TERRAIN_CAMERA_OFFSETS := [
    Vector3(3.8, 5.3, 9.4), # C: elevated 3/4 perspective
    Vector3(2.7, 3.8, 7.5)  # Default: close low 3/4 perspective
]
const TERRAIN_CAMERA_FOV := [46.0, 48.0]
var terrain_camera_zoom := 1.0
var terrain_spawn_position := Vector3(0.0, 0.5, 0.0)

func _load_island() -> void:
    # Do not instantiate the old island, houses, roads, trees, or collision.
    pass

func _make_player() -> void:
    super._make_player()
    player.collision_mask = 1
    # The existing FBX is auto-fitted to 1.78m. Scale ONLY the visible avatar,
    # leaving its original rig, skeleton and animation times unchanged.
    var visual := player.get_node_or_null("Visual") as Node3D
    if visual != null:
        visual.scale = Vector3.ONE * TERRAIN_CHARACTER_SCALE
    # Match the capsule to the new avatar height to prevent floating above
    # the collision surface or a misleading invisible full-height obstacle.
    var body := player.get_node_or_null("PlayerCollision") as CollisionShape3D
    if body != null:
        var capsule := CapsuleShape3D.new()
        capsule.radius = 0.245
        capsule.height = 1.31
        body.shape = capsule
        body.position.y = 0.67
    # The level wrapper explicitly enables physics only after a grounded
    # spawn and the imported terrain collider are both ready.
    player.set_physics_process(false)

func _make_camera() -> void:
    super._make_camera()
    cam.projection = Camera3D.PROJECTION_PERSPECTIVE
    cam.fov = TERRAIN_CAMERA_FOV[camera_mode]
    cam.near = 0.075
    cam.far = 350.0
    _place_camera_immediately()

func _place_camera_immediately() -> void:
    if not is_instance_valid(cam) or not is_instance_valid(player):
        return
    var focus := player.global_position + Vector3(0.0, 0.85, 0.0)
    var offset: Vector3 = Basis(Vector3.UP, camera_yaw) * TERRAIN_CAMERA_OFFSETS[camera_mode] * terrain_camera_zoom
    cam.global_position = focus + offset
    cam.look_at(focus, Vector3.UP)

func _process(delta: float) -> void:
    if is_instance_valid(player) and is_instance_valid(cam):
        var focus := player.global_position + Vector3(0.0, 0.85, 0.0)
        var offset: Vector3 = Basis(Vector3.UP, camera_yaw) * TERRAIN_CAMERA_OFFSETS[camera_mode] * terrain_camera_zoom
        cam.global_position = cam.global_position.lerp(focus + offset, minf(1.0, delta * 6.0))
        cam.look_at(focus, Vector3.UP)

func _apply_camera_preset() -> void:
    # Unlike the original blockout, the terrain test NEVER uses orthographic.
    if is_instance_valid(cam):
        cam.projection = Camera3D.PROJECTION_PERSPECTIVE
        cam.fov = TERRAIN_CAMERA_FOV[camera_mode]
    _update_camera_mode_label()

func _update_camera_mode_label() -> void:
    if is_instance_valid(camera_mode_label):
        var mode := "3/4 Elevated" if camera_mode == 0 else "3/4 Close"
        camera_mode_label.text = "Kamera: %s Perspective | C: Mode | Q/E: Putar | R: Reset" % mode

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventMouseButton and event.pressed:
        # True perspective dolly zoom; Camera3D.size only works for orthographic.
        if event.button_index == MOUSE_BUTTON_WHEEL_UP:
            terrain_camera_zoom = maxf(0.68, terrain_camera_zoom * 0.90)
            return
        if event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
            terrain_camera_zoom = minf(1.7, terrain_camera_zoom * 1.10)
            return
    super._unhandled_input(event)

func _make_hud() -> void:
    super._make_hud()
    var title := get_node_or_null("BlockoutHUD/Title") as Label
    if title != null:
        title.text = "LEMBAH ASRI | BAKED RETEXTURE | CAMERA 3/4"
    var house_status := get_node_or_null("BlockoutHUD/HouseAssetStatus") as Label
    if house_status != null:
        house_status.text = "V2 | JOYSTICK ANALOG HP | COLLISION FIX | Karakter 74%"
    var control_label := get_node_or_null("BlockoutHUD/Controls") as Label
    if control_label != null:
        control_label.text = "HP: Joystick / LARI / LOMPAT  |  PC: WASD / Shift / Space"

func _physics_process(_delta: float) -> void:
    if is_instance_valid(player) and player.global_position.y < -8.0:
        player.global_position = terrain_spawn_position
        player.velocity = Vector3.ZERO
