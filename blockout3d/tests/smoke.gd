extends SceneTree

func _initialize() -> void:
    call_deferred("_test")

func _test() -> void:
    var world := load("res://scenes/world.tscn").instantiate() as Node3D
    root.add_child(world)
    await process_frame
    assert(world.has_node("IslandBlockoutV01"), "Island not loaded")
    assert(not world.has_node("TanahUtama"), "Old flat environment still active")
    var island := world.get_node("IslandBlockoutV01")
    assert(island.find_children("*", "MeshInstance3D", true, false).size() == 180, "Island mesh count")
    assert(island.find_children("*", "StaticBody3D", true, false).size() > 50, "Missing world collision")
    var player := world.get_node("Player3D") as CharacterBody3D
    for i in range(90):
        await physics_frame
    assert(player.is_on_floor(), "Spawn failed to land")
    assert(absf(player.position.y - 5.5) < 0.15, "Incorrect Z-up conversion or plaza height")
    var spawn := player.position
    var down := InputEventKey.new()
    down.keycode = KEY_D
    down.pressed = true
    Input.parse_input_event(down)
    for i in range(40):
        await physics_frame
    down.pressed = false
    Input.parse_input_event(down)
    for i in range(10):
        await physics_frame
    assert(player.position.x > spawn.x + 2.0, "Walking blocked at spawn")
    assert(player.is_on_floor(), "Player fell through plaza")
    player.position = Vector3(6, -10, 15)
    await physics_frame
    await physics_frame
    assert(player.position.y > 5.0, "Fall recovery failed")
    print("BLOCKOUT3D PASS: 180 island meshes, collision, grounded spawn, WASD movement, fall recovery")
    quit(0)
