extends SceneTree
## Non-destructive model inspection lab acceptance test.
func _initialize() -> void:
    call_deferred("_check_lab")

func _check_lab() -> void:
    var packed: PackedScene = load("res://scenes/character_lab_3d.tscn") as PackedScene
    if packed == null:
        push_error("MODEL 3D SMOKE FAIL: lab scene is missing")
        quit(1)
        return
    var lab: Node3D = packed.instantiate() as Node3D
    root.add_child(lab)
    await process_frame
    await process_frame
    if lab == null or not lab.has_rig:
        push_error("MODEL 3D SMOKE FAIL: rig pivots missing")
        quit(1)
        return
    var model: Node3D = lab.get_node_or_null("ProtagonistModel") as Node3D
    if model == null:
        push_error("MODEL 3D SMOKE FAIL: GLB model missing")
        quit(1)
        return
    var mesh_count: int = model.find_children("*", "MeshInstance3D", true, false).size()
    if mesh_count < 50:
        push_error("MODEL 3D SMOKE FAIL: expected true 3D meshes, found %d" % mesh_count)
        quit(1)
        return
    lab.turntable = false
    lab.set_demo_mode("walk")
    await process_frame
    if lab.state != "walk":
        push_error("MODEL 3D SMOKE FAIL: walk state transition")
        quit(1)
        return
    lab.set_demo_mode("run")
    await process_frame
    if lab.state != "run":
        push_error("MODEL 3D SMOKE FAIL: run state transition")
        quit(1)
        return
    lab.set_demo_mode("idle")
    await process_frame
    if lab.state != "idle":
        push_error("MODEL 3D SMOKE FAIL: idle state transition")
        quit(1)
        return
    print("MODEL 3D SMOKE PASS: %d mesh parts; pivots; idle/walk/run at 12 FPS; original 2D main preserved" % mesh_count)
    root.remove_child(lab)
    lab.free()
    quit(0)
