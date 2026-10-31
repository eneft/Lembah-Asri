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
    print("BLOCKOUT3D PASS: independent project, nine map regions, isometric camera, player and dock")
    quit(0)
