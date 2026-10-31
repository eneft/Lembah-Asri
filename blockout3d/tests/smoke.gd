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
