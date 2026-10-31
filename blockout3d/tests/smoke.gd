extends SceneTree

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var loaded: PackedScene = load("res://scenes/world.tscn")
    if loaded == null:
        push_error("BLOCKOUT3D FAIL: scene not loaded")
        quit(1)
        return
    var world: Node3D = loaded.instantiate() as Node3D
    root.add_child(world)
    await process_frame
    for path in [
        "TanahUtama", "01_RumahTerpisahDanKebun",
        "02_DesaJawa", "03_LapanganKumpulWarga", "04_HutanTropis",
        "05_Bukit", "06_SungaiJembatan", "07_Sawah",
        "08_LautPantai", "09_DermagaNelayan", "Player3D",
        "IsometricCamera", "BlockoutHUD"
    ]:
        if world.get_node_or_null(path) == null:
            push_error("BLOCKOUT3D FAIL: missing region " + path)
            quit(1)
            return
    var camera: Camera3D = world.get_node("IsometricCamera")
    if camera.projection != Camera3D.PROJECTION_ORTHOGONAL:
        push_error("BLOCKOUT3D FAIL: camera must be orthogonal")
        quit(1)
        return
    # Lower, front-facing camera must be active by default, not the old high angle.
    if not is_equal_approx(camera.size, 16.0) or int(world.get("camera_mode")) != 1:
        push_error("BLOCKOUT3D FAIL: default low-angle camera preset was not selected")
        quit(1)
        return
    var zoom_in := InputEventMouseButton.new()
    zoom_in.button_index = MOUSE_BUTTON_WHEEL_UP
    zoom_in.pressed = true
    world._unhandled_input(zoom_in)
    if not is_equal_approx(camera.size, 14.0):
        push_error("BLOCKOUT3D FAIL: mouse wheel zoom-in did not work")
        quit(1)
        return
    for i in range(20):
        world._unhandled_input(zoom_in)
    if not is_equal_approx(camera.size, 9.0):
        push_error("BLOCKOUT3D FAIL: minimum camera size must be 9")
        quit(1)
        return
    var zoom_out := InputEventMouseButton.new()
    zoom_out.button_index = MOUSE_BUTTON_WHEEL_DOWN
    zoom_out.pressed = true
    for i in range(40):
        world._unhandled_input(zoom_out)
    if not is_equal_approx(camera.size, 65.0):
        push_error("BLOCKOUT3D FAIL: maximum zoom-out should be capped at 65")
        quit(1)
        return
    # C alternates to the former high isometric angle and back to low face view.
    var toggle := InputEventKey.new()
    toggle.keycode = KEY_C
    toggle.pressed = true
    world._unhandled_input(toggle)
    if int(world.get("camera_mode")) != 0 or not is_equal_approx(camera.size, 22.0):
        push_error("BLOCKOUT3D FAIL: C did not switch to elevated isometric camera")
        quit(1)
        return
    world._unhandled_input(toggle)
    if int(world.get("camera_mode")) != 1 or not is_equal_approx(camera.size, 16.0):
        push_error("BLOCKOUT3D FAIL: C did not restore low angle and closer zoom")
        quit(1)
        return
    var camera_label: Label = world.get_node_or_null("BlockoutHUD/CameraMode") as Label
    if camera_label == null or camera_label.text.find("Low Angle") < 0:
        push_error("BLOCKOUT3D FAIL: camera HUD does not reflect the selected mode")
        quit(1)
        return
    # Orbit controls: Q/E keyboard, right-mouse drag, reset key and touch buttons.
    var q_key := InputEventKey.new()
    q_key.keycode = KEY_Q
    q_key.pressed = true
    world._unhandled_input(q_key)
    if absf(float(world.get("camera_yaw")) + PI / 6.0) > 0.001:
        push_error("BLOCKOUT3D FAIL: Q must rotate camera left by 30 degrees")
        quit(1)
        return
    var e_key := InputEventKey.new()
    e_key.keycode = KEY_E
    e_key.pressed = true
    world._unhandled_input(e_key)
    if absf(float(world.get("camera_yaw"))) > 0.001:
        push_error("BLOCKOUT3D FAIL: E must rotate camera right by 30 degrees")
        quit(1)
        return
    var mouse_drag := InputEventMouseMotion.new()
    mouse_drag.button_mask = MOUSE_BUTTON_MASK_RIGHT
    mouse_drag.relative = Vector2(100.0, 0.0)
    world._unhandled_input(mouse_drag)
    if absf(float(world.get("camera_yaw")) + 0.9) > 0.001:
        push_error("BLOCKOUT3D FAIL: right mouse drag did not orbit camera")
        quit(1)
        return
    var reset_key := InputEventKey.new()
    reset_key.keycode = KEY_R
    reset_key.pressed = true
    world._unhandled_input(reset_key)
    if absf(float(world.get("camera_yaw"))) > 0.001:
        push_error("BLOCKOUT3D FAIL: R must reset camera orbit")
        quit(1)
        return
    var button_left: Button = world.get_node_or_null("BlockoutHUD/OrbitControls/OrbitLeft") as Button
    var button_reset: Button = world.get_node_or_null("BlockoutHUD/OrbitControls/OrbitReset") as Button
    var button_right: Button = world.get_node_or_null("BlockoutHUD/OrbitControls/OrbitRight") as Button
    if button_left == null or button_reset == null or button_right == null:
        push_error("BLOCKOUT3D FAIL: on-screen camera orbit buttons missing")
        quit(1)
        return
    button_right.pressed.emit()
    if absf(float(world.get("camera_yaw")) - PI / 6.0) > 0.001:
        push_error("BLOCKOUT3D FAIL: orbit right button is not connected")
        quit(1)
        return
    button_left.pressed.emit()
    if absf(float(world.get("camera_yaw"))) > 0.001:
        push_error("BLOCKOUT3D FAIL: orbit left button is not connected")
        quit(1)
        return
    button_right.pressed.emit()
    button_reset.pressed.emit()
    if absf(float(world.get("camera_yaw"))) > 0.001:
        push_error("BLOCKOUT3D FAIL: reset orbit button did not work")
        quit(1)
        return
    # The mobile input component must be present, even when hidden on desktop.
    var touch_buttons := world.get_node_or_null("TouchControls/Buttons")
    if touch_buttons == null:
        push_error("BLOCKOUT3D FAIL: responsive multi-touch controls missing")
        quit(1)
        return
    for button_name in ["Forward", "Back", "Left", "Right", "Run", "Jump"]:
        var touch_button := touch_buttons.get_node_or_null(button_name) as TouchScreenButton
        if touch_button == null:
            push_error("BLOCKOUT3D FAIL: missing mobile control " + button_name)
            quit(1)
            return
        if not InputMap.has_action(touch_button.action) or touch_button.texture_normal == null or touch_button.shape == null:
            push_error("BLOCKOUT3D FAIL: mobile action or visible hit target missing: " + button_name)
            quit(1)
            return
    var touch_player: CharacterBody3D = world.get_node("Player3D")
    touch_player.set_physics_process(false)
    Input.action_press("touch_forward")
    Input.action_press("touch_right")
    Input.action_press("touch_run")
    Input.action_press("touch_jump")
    var mobile_direction: Vector3 = touch_player.call("_read_movement_direction")
    if mobile_direction.distance_to(Vector3(1.0, 0.0, -1.0).normalized()) > 0.01:
        push_error("BLOCKOUT3D FAIL: multi-touch diagonal movement is incorrect")
        quit(1)
        return
    if not Input.is_action_pressed("touch_run") or not Input.is_action_pressed("touch_jump"):
        push_error("BLOCKOUT3D FAIL: multi-touch sprint and jump cannot be held together")
        quit(1)
        return
    for mobile_action in ["touch_forward", "touch_right", "touch_run", "touch_jump"]:
        Input.action_release(mobile_action)
    var old_yaw: float = float(world.get("camera_yaw"))
    var bottom_drag := InputEventScreenDrag.new()
    bottom_drag.position = Vector2(100, root.get_visible_rect().size.y - 65.0)
    bottom_drag.relative = Vector2(120, 0)
    world._unhandled_input(bottom_drag)
    if absf(float(world.get("camera_yaw")) - old_yaw) > 0.001:
        push_error("BLOCKOUT3D FAIL: dragging in mobile control area should not orbit camera")
        quit(1)
        return
    var upper_drag := InputEventScreenDrag.new()
    upper_drag.position = Vector2(100, 240)
    upper_drag.relative = Vector2(100, 0)
    world._unhandled_input(upper_drag)
    if absf(float(world.get("camera_yaw")) - old_yaw) < 0.1:
        push_error("BLOCKOUT3D FAIL: gameplay swipe no longer orbits camera")
        quit(1)
        return
    world._reset_camera_rotation()
    var character: CharacterBody3D = world.get_node("Player3D")
    var height_above_player := camera.global_position.y - character.global_position.y
    if height_above_player > 14.0:
        push_error("BLOCKOUT3D FAIL: the camera angle is still too elevated for face view")
        quit(1)
        return
    if world.get_node("03_LapanganKumpulWarga").get_child_count() < 3:
        push_error("BLOCKOUT3D FAIL: missing community square props")
        quit(1)
        return
    if world.get_node("09_DermagaNelayan").get_child_count() < 4:
        push_error("BLOCKOUT3D FAIL: fishing boats or dock missing")
        quit(1)
        return
    # Visual art regression: roofs must be pitched UV meshes with actual painted
    # textures and normal maps; tree leaves must no longer be primitive spheres.
    var family_house: Node3D = world.get_node_or_null("01_RumahTerpisahDanKebun/RumahMasaKecilTerbengkalai") as Node3D
    if family_house == null:
        push_error("BLOCKOUT3D FAIL: childhood house missing")
        quit(1)
        return
    var roof: MeshInstance3D = family_house.get_node_or_null("GentengTanahLiatKiri") as MeshInstance3D
    var roof_other: MeshInstance3D = family_house.get_node_or_null("GentengTanahLiatKanan") as MeshInstance3D
    if roof == null or roof_other == null or not (roof.mesh is ArrayMesh):
        push_error("BLOCKOUT3D FAIL: mesh roof must use a proper pitched surface")
        quit(1)
        return
    var roof_mat: StandardMaterial3D = roof.material_override as StandardMaterial3D
    if roof_mat == null or roof_mat.albedo_texture == null or not roof_mat.normal_enabled or roof_mat.normal_texture == null:
        push_error("BLOCKOUT3D FAIL: roof painted albedo/normal textures are missing")
        quit(1)
        return
    var roof_arrays: Array = roof.mesh.surface_get_arrays(0)
    if (roof_arrays[Mesh.ARRAY_TEX_UV] as PackedVector2Array).size() < 4:
        push_error("BLOCKOUT3D FAIL: the roof lacks authored UV coordinates")
        quit(1)
        return
    if family_house.get_node_or_null("KanopiTeras") == null or family_house.get_node_or_null("DindingCollision") == null:
        push_error("BLOCKOUT3D FAIL: realistic terrace or house collision was removed")
        quit(1)
        return
    var banana: Node3D = world.get_node_or_null("01_RumahTerpisahDanKebun/PohonPisang") as Node3D
    var coconut: Node3D = world.get_node_or_null("01_RumahTerpisahDanKebun/KelapaBerpelepah") as Node3D
    var tropical_tree: Node3D = world.get_node_or_null("04_HutanTropis/PohonTropisBerdaun") as Node3D
    if banana == null or coconut == null or tropical_tree == null:
        push_error("BLOCKOUT3D FAIL: distinct banana/coconut/broadleaf vegetation missing")
        quit(1)
        return
    if banana.find_children("DaunPisangLebar*", "MeshInstance3D").size() < 7:
        push_error("BLOCKOUT3D FAIL: broad banana leaf meshes missing")
        quit(1)
        return
    if coconut.find_children("PelepahKelapa*", "MeshInstance3D").size() < 9:
        push_error("BLOCKOUT3D FAIL: coconut curved frond meshes missing")
        quit(1)
        return
    print("BLOCKOUT3D PASS: regions, two camera modes, close zoom, keyboard/drag/touch orbit, multi-touch run+jump, UV painted homes and distinct vegetation")
    quit(0)
