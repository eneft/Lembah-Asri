extends "res://scripts/world.gd"
## Independent terrain-only gameplay preview.
## The original /blockout3d/ island, original FBX assets and all animation
## timings stay untouched. Only this clean /terrain-test/ world changes.

const TERRAIN_CHARACTER_SCALE := 0.55
const TERRAIN_CAMERA_OFFSETS := [
    Vector3(3.1, 4.4, 7.3),  # C: elevated 3/4; closer than before
    Vector3(2.05, 3.05, 5.95) # Default: close 3/4, character smaller
]
const TERRAIN_CAMERA_FOV := [46.0, 48.0]
var terrain_camera_zoom := 1.0
var terrain_spawn_position := Vector3(0.0, 0.5, 0.0)
# One smoothed focus for both camera position AND look_at. The previous
# camera chased an interpolated position but aimed at raw physics-frame motion,
# which visibly shook every step, especially on uneven terrain.
var _camera_focus := Vector3.ZERO
var _camera_focus_ready := false
const CAMERA_FOLLOW_XZ := 10.0
const CAMERA_FOLLOW_Y := 4.0
const CAMERA_ORBIT_SMOOTH := 11.0
const CAMERA_FOCUS_Y := 0.62
var _camera_render_yaw := 0.0


func _world_light() -> void:
    # Scene-local illustrated daytime palette. Avoid blown-out warm rock
    # highlights and near-black timber undersides; do NOT modify legacy game.
    super._world_light()
    var sun := get_node_or_null("PagiJawa") as DirectionalLight3D
    if sun != null:
        sun.light_color = Color("fff0d7")
        sun.light_energy = 0.87
        sun.shadow_enabled = true
    var atmosphere := get_node_or_null("Atmosphere") as WorldEnvironment
    if atmosphere != null and atmosphere.environment != null:
        atmosphere.environment.ambient_light_color = Color("e5ede1")
        atmosphere.environment.ambient_light_energy = 0.60

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
        capsule.radius = 0.19
        capsule.height = 0.99
        body.shape = capsule
        body.position.y = 0.505
    # The level wrapper explicitly enables physics only after a grounded
    # spawn and the imported terrain collider are both ready.
    player.set_physics_process(false)

func _make_camera() -> void:
    # Godot 4.3 has no native 3D physics interpolation. Our render-frame
    # player/camera interpolation replaces the engine's default jitter fix.
    # This scene-only entrypoint must not change other published game routes.
    Engine.physics_jitter_fix = 0.0
    super._make_camera()
    cam.projection = Camera3D.PROJECTION_PERSPECTIVE
    cam.fov = TERRAIN_CAMERA_FOV[camera_mode]
    cam.near = 0.075
    cam.far = 350.0
    # Screen-space movement follows camera yaw, including touch drag / orbit.
    # Camera itself remains freely orbitable and smoothly follows the player.
    player.set("camera_relative_movement", true)
    player.set("movement_camera", cam)
    _place_camera_immediately()

func _place_camera_immediately() -> void:
    if not is_instance_valid(cam) or not is_instance_valid(player):
        return
    # Snap only at load / respawn; never snap ordinary walking frames.
    _camera_focus = player.global_position + Vector3(0.0, CAMERA_FOCUS_Y, 0.0)
    _camera_focus_ready = true
    _camera_render_yaw = camera_yaw
    var offset: Vector3 = Basis(Vector3.UP, _camera_render_yaw) * TERRAIN_CAMERA_OFFSETS[camera_mode] * terrain_camera_zoom
    cam.global_position = _camera_focus + offset
    cam.look_at(_camera_focus, Vector3.UP)

func _process(delta: float) -> void:
    if not is_instance_valid(player) or not is_instance_valid(cam):
        return
    # CharacterBody3D moves on fixed physics ticks. Sample the interpolated
    # position at render time, not the last stepped transform.
    var follow_position: Vector3 = player.call("get_camera_follow_position")
    var desired_focus := follow_position + Vector3(0.0, CAMERA_FOCUS_Y, 0.0)
    if not _camera_focus_ready:
        _camera_focus = desired_focus
        _camera_focus_ready = true
    else:
        var follow_xz := 1.0 - exp(-CAMERA_FOLLOW_XZ * delta)
        var follow_y := 1.0 - exp(-CAMERA_FOLLOW_Y * delta)
        _camera_focus.x = lerpf(_camera_focus.x, desired_focus.x, follow_xz)
        _camera_focus.z = lerpf(_camera_focus.z, desired_focus.z, follow_xz)
        _camera_focus.y = lerpf(_camera_focus.y, desired_focus.y, follow_y)
    # One smoothed yaw and ONE camera position derived from the same pivot.
    # A second position smoothing pass caused rubber-banding and pitch jitter.
    var orbit_lerp := 1.0 - exp(-CAMERA_ORBIT_SMOOTH * delta)
    _camera_render_yaw = lerp_angle(_camera_render_yaw, camera_yaw, orbit_lerp)
    var offset: Vector3 = Basis(Vector3.UP, _camera_render_yaw) * TERRAIN_CAMERA_OFFSETS[camera_mode] * terrain_camera_zoom
    cam.global_position = _camera_focus + offset
    cam.look_at(_camera_focus, Vector3.UP)

func _apply_camera_preset() -> void:
    # Unlike the original blockout, the terrain test NEVER uses orthographic.
    if is_instance_valid(cam):
        cam.projection = Camera3D.PROJECTION_PERSPECTIVE
        cam.fov = TERRAIN_CAMERA_FOV[camera_mode]
    _update_camera_mode_label()

func _update_camera_mode_label() -> void:
    if is_instance_valid(camera_mode_label):
        var mode := "3/4 Elevated" if camera_mode == 0 else "3/4 Close"
        camera_mode_label.text = "Kamera bebas: %s | Swipe kanan / Q-E: Putar | R: Reset" % mode

func _unhandled_input(event: InputEvent) -> void:
    # On mobile, a second finger swiping the free gameplay area rotates the
    # view continuously. Joystick / Run / Jump touch events are consumed by
    # their own controls. Keep camera orbit independent from movement input.
    if event is InputEventScreenDrag:
        var drag := event as InputEventScreenDrag
        var screen_size := get_viewport().get_visible_rect().size
        if drag.position.x > screen_size.x * 0.43 and drag.position.y < screen_size.y * 0.79:
            _rotate_camera(-drag.relative.x * CAMERA_DRAG_SENSITIVITY)
            get_viewport().set_input_as_handled()
            return
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
        title.text = "LEMBAH ASRI | TERRAIN V3 | KAMERA BEBAS"
    var house_status := get_node_or_null("BlockoutHUD/HouseAssetStatus") as Label
    if house_status != null:
        house_status.text = "V3 | SMOOTH CAMERA | KARAKTER 55% | JOYSTICK 3/4"
    var control_label := get_node_or_null("BlockoutHUD/Controls") as Label
    if control_label != null:
        control_label.text = "HP: Joystick + Geser layar untuk kamera | PC: WASD / Shift / Space / Q-E"

func _physics_process(_delta: float) -> void:
    if is_instance_valid(player) and player.global_position.y < -8.0:
        player.global_position = terrain_spawn_position
        player.velocity = Vector3.ZERO
        player.reset_camera_follow_interpolation()
        _place_camera_immediately()
