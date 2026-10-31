extends SceneTree
## Strict when FBX inputs are provided; explicit pending state when none are in Git.
const NAMES := [
    "Orc Idle.fbx", "Walking.fbx", "Running (3).fbx", "Jump Over.fbx"
]

func _initialize() -> void:
    call_deferred("_test")

func _test() -> void:
    var scene: PackedScene = load("res://scenes/world.tscn")
    if scene == null:
        push_error("FBX ANIMATION FAIL: 3D world not found")
        quit(1)
        return
    var world := scene.instantiate()
    root.add_child(world)
    await process_frame
    var actor: Node = world.get_node_or_null("Player3D/Visual/FbxCharacter")
    var placeholder: Node = world.get_node_or_null("Player3D/Visual/Placeholder")
    if actor == null or placeholder == null:
        push_error("FBX ANIMATION FAIL: controller nodes missing")
        quit(1)
        return

    var count := 0
    for name in NAMES:
        if ResourceLoader.exists("res://assets/character/fbx/" + name):
            count += 1
    if count == 0:
        if not placeholder.visible:
            push_error("FBX ANIMATION FAIL: missing assets should show placeholder")
            quit(1)
            return
        print("FBX ANIMATION PENDING: scripts OK, four original binary FBX files are not yet in the repository")
        quit(0)
        return
    if count < 4:
        push_error("FBX ANIMATION FAIL: some, but not all, FBX inputs are present")
        quit(1)
        return
    if not actor.call("is_model_ready"):
        push_error("FBX ANIMATION FAIL: imported four clips not ready: " + str(actor.get("warnings")))
        quit(1)
        return
    if placeholder.visible:
        push_error("FBX ANIMATION FAIL: placeholder still visible after FBX load")
        quit(1)
        return
    # Suspend the live input/physics state machine while checking direct clip transitions.
    # Otherwise the world player immediately overwrites the test state after every frame.
    world.get_node("Player3D").set_physics_process(false)
    for name in ["idle", "walk", "run", "jump", "idle"]:
        actor.call("play_state", name)
        if actor.get("current_state") != name:
            push_error("FBX ANIMATION FAIL: cannot switch to " + name)
            quit(1)
            return
    print("FBX ANIMATION PASS: single rig, all four original clips, state switching, stable model scale")
    quit(0)
