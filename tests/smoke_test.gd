extends SceneTree
## Headless smoke test: load main scene, instantiate, and verify playable prototype nodes.
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
    if world.get_node_or_null("Player") == null:
        push_error("SMOKE FAIL: Player node missing")
        failed = true
    else:
        var player = world.get_node("Player")
        if not player is CharacterBody3D:
            push_error("SMOKE FAIL: Player type incorrect")
            failed = true
    var cameras := world.find_children("*", "Camera3D", true, false)
    if cameras.size() != 1:
        push_error("SMOKE FAIL: Expected one gameplay camera, found %d" % cameras.size())
        failed = true
    var world_script = world.get_script()
    if world_script == null or world.npcs.size() != 3:
        push_error("SMOKE FAIL: Expected 3 NPCs")
        failed = true
    if failed:
        quit(1)
    else:
        print("SMOKE PASS: main scene instantiates, Player, camera and 3 NPCs available")
        quit(0)
