extends SceneTree

func _initialize() -> void:
    call_deferred("_test")

func _key(code: int, pressed: bool) -> void:
    var event := InputEventKey.new()
    event.keycode = code
    event.pressed = pressed
    Input.parse_input_event(event)

func _test() -> void:
    var world := load("res://scenes/world.tscn").instantiate() as Node3D
    root.add_child(world)
    await process_frame
    var player := world.get_node("Player3D") as CharacterBody3D
    var actor := player.get_node("Visual/FbxCharacter")
    assert(actor.is_model_ready(), "Original four FBX clips missing")
    var anim: Animation = actor.animator.get_animation("lembah/jump")
    var anchored := 0
    for track in range(anim.get_track_count()):
        if anim.track_get_type(track) == Animation.TYPE_POSITION_3D and str(anim.track_get_path(track)).contains("Hips"):
            anchored += 1
            var first: Vector3 = anim.track_get_key_value(track, 0)
            for key in range(anim.track_get_key_count(track)):
                assert(first.distance_to(anim.track_get_key_value(track, key)) < 0.0001, "Jump root displacement remains")
    assert(anchored > 0, "No jump hip track tested")
    for i in range(90):
        await physics_frame
    var start := player.position
    _key(KEY_SPACE, true)
    await physics_frame
    await physics_frame
    _key(KEY_SPACE, false)
    var peak := player.position.y
    for i in range(90):
        await physics_frame
        peak = maxf(peak, player.position.y)
    assert(peak > start.y + 1.0, "Jump did not leave ground")
    assert(player.is_on_floor(), "Jump failed to land")
    assert(Vector2(player.position.x, player.position.z).distance_to(Vector2(start.x, start.z)) < 0.05, "Standing jump moved backwards")
    _key(KEY_D, true)
    _key(KEY_SPACE, true)
    await physics_frame
    await physics_frame
    _key(KEY_SPACE, false)
    var last_x := player.position.x
    for i in range(65):
        await physics_frame
        assert(player.position.x >= last_x - 0.02, "Moving jump snapped backwards")
        last_x = player.position.x
    _key(KEY_D, false)
    for i in range(10):
        await physics_frame
    assert(player.is_on_floor(), "Moving jump failed to land")
    var island := world.get_node("IslandBlockoutV01")
    var bridges := 0
    var trunks := 0
    for node in island.find_children("*", "MeshInstance3D", true, false):
        var label := str(node.name)
        if label.begins_with("12_") or label.ends_with("Trunks") or label.begins_with("14_"):
            assert(node.find_children("*", "StaticBody3D", true, false).size() > 0, "Missing solid collision: " + label)
            if label.begins_with("12_"):
                bridges += 1
            if label.ends_with("Trunks"):
                trunks += 1
    assert(bridges == 10 and trunks == 2, "Incomplete bridge/trunk coverage")
    print("JUMP COLLISION PASS: anchored hip keys, standing/moving jump landing, no backwards snap, bridge decks/rails, trunks and lighthouse solid")
    quit(0)
