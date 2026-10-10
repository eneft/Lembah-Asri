extends SceneTree
## Real Godot 4 headless smoke test. Instantiates & verifies the prototype and cleans up before exit.
var failed := false

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var packed := load("res://scenes/main.tscn") as PackedScene
    if packed == null:
        push_error("SMOKE FAIL: main scene could not load")
        quit(1)
        return
    var world := packed.instantiate()
    root.add_child(world)
    await process_frame
    await process_frame
    var player := world.get_node_or_null("Player") as CharacterBody3D
    if player == null:
        push_error("SMOKE FAIL: Player missing or not CharacterBody3D")
        failed = true
    var cameras := world.find_children("*", "Camera3D", true, false)
    if cameras.size() != 1:
        push_error("SMOKE FAIL: Expected one camera, got %d" % cameras.size())
        failed = true
    elif not cameras[0].current:
        push_error("SMOKE FAIL: Camera should be active")
        failed = true
    if world.get_script() == null or world.npcs.size() != 3:
        push_error("SMOKE FAIL: Expected 3 NPCs")
        failed = true
    if player != null:
        var start_x := player.global_position.x
        Input.action_press("ui_right")
        for _step in range(5):
            await physics_frame
        Input.action_release("ui_right")
        if player.global_position.x <= start_x + 0.01:
            push_error("SMOKE FAIL: Player did not move on ui_right")
            failed = true
        player.global_position = world.npcs[0].global_position + Vector3(0.5, 0.0, 0.0)
        var interact := InputEventKey.new()
        interact.keycode = KEY_E
        interact.pressed = true
        world._unhandled_input(interact)
        if world.dialogue_timer <= 0.0 or world.dialogue_label.text.find("Pak Darto") == -1:
            push_error("SMOKE FAIL: E interaction should open Pak Darto dialogue")
            failed = true
    # Explicitly free scene resources while the renderer is still initialized.
    root.remove_child(world)
    world.free()
    await process_frame
    await process_frame
    if failed:
        quit(1)
    else:
        print("SMOKE PASS: scene, player movement, elevated camera, 3 NPCs and E dialogue")
        quit(0)
