extends "res://scripts/world.gd"
## Independent terrain-only gameplay preview.
## The original /blockout3d/ island, original FBX assets and all animation
## timings stay untouched. Only this clean /terrain-test/ world changes.

# Godot world unit = meter. The original FBX is fitted to 1.78m by
# fbx_character.gd. Preserve the original FBX animations, but make the
# playable hero EXACTLY 168cm in the village's architectural scale.
const AVATAR_TARGET_HEIGHT_METERS := 1.68
const FBX_FITTED_HEIGHT_METERS := 1.78
const TERRAIN_CHARACTER_SCALE := AVATAR_TARGET_HEIGHT_METERS / FBX_FITTED_HEIGHT_METERS
const TERRAIN_CAMERA_OFFSETS := [
    Vector3(3.1, 4.4, 7.3),  # C: elevated 3/4; closer than before
    Vector3(2.05, 3.05, 5.95) # Default: close 3/4; avatar scaled independently
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
const CAMERA_FOCUS_Y := 1.00 # upper torso / face for 1.68m protagonist
var _camera_render_yaw := 0.0
# Free yaw with physically safe elevation limits, not fixed 3/4 presets.
const CAMERA_MIN_ELEVATION := deg_to_rad(10.0)
const CAMERA_MAX_ELEVATION := deg_to_rad(70.0)
const CAMERA_GROUND_MARGIN := 0.38
const CAMERA_OBSTACLE_MARGIN := 0.34
var camera_pitch := 0.0
var _camera_render_pitch := 0.0
var _camera_last_collision := false


func _world_light() -> void:
    # Scene-local illustrated daytime palette. Avoid blown-out warm rock
    # highlights and near-black timber undersides; do NOT modify legacy game.
    super._world_light()
    var sun := get_node_or_null("PagiJawa") as DirectionalLight3D
    if sun != null:
        sun.light_color = Color("fff0dd")
        sun.light_energy = 0.92
        sun.shadow_enabled = true
        sun.shadow_bias = 0.045
        sun.shadow_normal_bias = 0.48
    var atmosphere := get_node_or_null("Atmosphere") as WorldEnvironment
    if atmosphere != null and atmosphere.environment != null:
        atmosphere.environment.ambient_light_color = Color("e2ecdf")
        atmosphere.environment.ambient_light_energy = 0.56
        atmosphere.environment.background_color = Color("bed8dc")

func _load_island() -> void:
    # Do not instantiate the old island, houses, roads, trees, or collision.
    pass

# Terrain-preview toon pass is NON-DESTRUCTIVE: only duplicate imported
# material resources for this scene. Albedo textures, transparency, mesh,
# skeleton weights and all four FBX animation clips remain exactly as loaded.
var toon_character_materials := 0

func _apply_character_toon() -> void:
    var visual := player.get_node_or_null("Visual") as Node3D
    if visual == null:
        return
    toon_character_materials = 0
    for node in visual.find_children("*", "MeshInstance3D", true, false):
        var body_mesh := node as MeshInstance3D
        if body_mesh.mesh == null:
            continue
        for i in range(body_mesh.mesh.get_surface_count()):
            var original := body_mesh.get_active_material(i) as BaseMaterial3D
            if original == null:
                continue
            var toon := original.duplicate() as BaseMaterial3D
            if toon == null:
                continue
            toon.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
            toon.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
            toon.metallic = 0.0
            toon.roughness = 0.78
            body_mesh.set_surface_override_material(i,toon)
            toon_character_materials += 1
    print("TERRAIN V3 CHARACTER TOON PASS: ",toon_character_materials,
          " preserved FBX material surfaces use scene-local toon diffuse")

func _make_player() -> void:
    super._make_player()
    _apply_character_toon()
    player.collision_mask = 1
    # The FBX loader normalizes to 1.78m. Apply 1.68/1.78 to the avatar
    # visual ONLY; do not stretch the level/house meshes or FBX animations.
    var visual := player.get_node_or_null("Visual") as Node3D
    if visual != null:
        visual.scale = Vector3.ONE * TERRAIN_CHARACTER_SCALE
    # Match the capsule to the new avatar height to prevent floating above
    # the collision surface or a misleading invisible full-height obstacle.
    var body := player.get_node_or_null("PlayerCollision") as CollisionShape3D
    if body != null:
        var capsule := CapsuleShape3D.new()
        # Full human-height collision in meters. Feet remain 5mm above
        # body origin, preserving the terrain ray spawn and bridge ramps.
        capsule.radius = 0.30
        capsule.height = AVATAR_TARGET_HEIGHT_METERS
        body.shape = capsule
        body.position.y = AVATAR_TARGET_HEIGHT_METERS * 0.5 + 0.005
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
    # Keep mobile aspect natural while preserving the approved free camera.
    cam.keep_aspect = Camera3D.KEEP_HEIGHT
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
    _camera_render_pitch = camera_pitch
    _position_free_camera()

func _base_camera_elevation() -> float:
    var offset: Vector3 = TERRAIN_CAMERA_OFFSETS[camera_mode]
    return atan2(offset.y, Vector2(offset.x, offset.z).length())

func _safe_elevation(angle: float) -> float:
    return clampf(angle, CAMERA_MIN_ELEVATION, CAMERA_MAX_ELEVATION)

func _ground_at_camera(x: float, z: float) -> Dictionary:
    var q := PhysicsRayQueryParameters3D.create(
        Vector3(x, 120.0, z), Vector3(x, -60.0, z))
    q.collision_mask = 1 << 7
    return get_world_3d().direct_space_state.intersect_ray(q)

func _position_free_camera() -> void:
    # Physics-aware spring arm: the camera cannot tunnel into hills, terrain
    # or house walls even when the player hugs a cliff or building.
    var offset: Vector3 = TERRAIN_CAMERA_OFFSETS[camera_mode]
    var heading: float = atan2(offset.x, offset.z)
    var elevation: float = _safe_elevation(_base_camera_elevation() + _camera_render_pitch)
    var basis := Basis(Vector3.UP, _camera_render_yaw + heading) * Basis(Vector3.RIGHT, -elevation)
    var direction: Vector3 = basis.z.normalized()
    var requested: float = offset.length() * terrain_camera_zoom
    var safe_distance: float = requested
    _camera_last_collision = false
    var q := PhysicsRayQueryParameters3D.create(_camera_focus,
        _camera_focus + direction * requested)
    q.collision_mask = (1 << 7) | 1
    if is_instance_valid(player):
        q.exclude = [player.get_rid()]
    var hit := get_world_3d().direct_space_state.intersect_ray(q)
    if not hit.is_empty():
        safe_distance = clampf(_camera_focus.distance_to(hit.position)
            - CAMERA_OBSTACLE_MARGIN, 0.55, requested)
        _camera_last_collision = true
    var position_m: Vector3 = _camera_focus + direction * safe_distance
    # Second guard covers short cliff edges missed by the camera center ray.
    var ground := _ground_at_camera(position_m.x, position_m.z)
    if not ground.is_empty() and position_m.y < float(ground.position.y) + CAMERA_GROUND_MARGIN:
        for i in range(10):
            safe_distance *= 0.68
            position_m = _camera_focus + direction * safe_distance
            ground = _ground_at_camera(position_m.x, position_m.z)
            if ground.is_empty() or position_m.y >= float(ground.position.y) + CAMERA_GROUND_MARGIN:
                break
        _camera_last_collision = true
    cam.global_transform = Transform3D(basis, position_m)

func _orbit_camera(yaw_delta: float, pitch_delta: float) -> void:
    camera_yaw = wrapf(camera_yaw + yaw_delta, -PI, PI)
    var baseline := _base_camera_elevation()
    camera_pitch = _safe_elevation(baseline + camera_pitch + pitch_delta) - baseline
    _update_camera_mode_label()

func _reset_camera_rotation() -> void:
    camera_yaw = 0.0
    camera_pitch = 0.0
    _update_camera_mode_label()

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
    _camera_render_pitch = lerpf(_camera_render_pitch, camera_pitch, orbit_lerp)
    _position_free_camera()

func _apply_camera_preset() -> void:
    # Unlike the original blockout, the terrain test NEVER uses orthographic.
    if is_instance_valid(cam):
        cam.projection = Camera3D.PROJECTION_PERSPECTIVE
        cam.fov = TERRAIN_CAMERA_FOV[camera_mode]
    camera_pitch = _safe_elevation(_base_camera_elevation() + camera_pitch) - _base_camera_elevation()
    _update_camera_mode_label()

func _update_camera_mode_label() -> void:
    if is_instance_valid(camera_mode_label):
        var mode := "3/4 Elevated" if camera_mode == 0 else "3/4 Close"
        camera_mode_label.text = "Kamera bebas: %s | Sudut 10°–70° | Geser kanan / RMB | R: Reset" % mode

func _unhandled_input(event: InputEvent) -> void:
    # Mobile drag on free right-side screen rotates BOTH yaw and pitch.
    # Joystick / Run / Jump touch events are handled by their own controls.
    # On desktop right-mouse drag or PgUp/PgDn controls vertical orbit.
    if event is InputEventScreenDrag:
        var drag := event as InputEventScreenDrag
        var screen_size := get_viewport().get_visible_rect().size
        if drag.position.x > screen_size.x * 0.43 and drag.position.y < screen_size.y * 0.79:
            _orbit_camera(-drag.relative.x * CAMERA_DRAG_SENSITIVITY,
                          -drag.relative.y * CAMERA_DRAG_SENSITIVITY)
            get_viewport().set_input_as_handled()
            return
    if event is InputEventMouseMotion:
        var motion := event as InputEventMouseMotion
        if (motion.button_mask & MOUSE_BUTTON_MASK_RIGHT) != 0:
            _orbit_camera(-motion.relative.x * CAMERA_DRAG_SENSITIVITY,
                          -motion.relative.y * CAMERA_DRAG_SENSITIVITY)
            get_viewport().set_input_as_handled()
            return
    if event is InputEventKey and event.pressed and not event.echo:
        if event.keycode == KEY_PAGEUP:
            _orbit_camera(0.0, deg_to_rad(15.0))
            return
        if event.keycode == KEY_PAGEDOWN:
            _orbit_camera(0.0, -deg_to_rad(15.0))
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
        title.text = "LEMBAH ASRI | V7.2 | KAMERA AMAN"
    var house_status := get_node_or_null("BlockoutHUD/HouseAssetStatus") as Label
    if house_status != null:
        house_status.text = "V7.7 | PAINTERLY • DESA 168 CM • VEGETASI"
    var control_label := get_node_or_null("BlockoutHUD/Controls") as Label
    if control_label != null:
        control_label.text = "HP: Geser area kanan untuk orbit | PC: Klik kanan + geser / PgUp-PgDn / Q-E"

func _physics_process(_delta: float) -> void:
    if is_instance_valid(player) and player.global_position.y < -8.0:
        player.global_position = terrain_spawn_position
        player.velocity = Vector3.ZERO
        player.reset_camera_follow_interpolation()
        _place_camera_immediately()
