extends SceneTree
## Standalone verification; no Stage 1 changes.
func _initialize() -> void:
    call_deferred("_verify")

func _verify() -> void:
    var scene := load("res://scenes/character_rig_lab_2d.tscn") as PackedScene
    if scene == null:
        push_error("RIG LAB FAIL: scene cannot load")
        quit(1)
        return
    var lab := scene.instantiate()
    root.add_child(lab)
    await process_frame
    var skeleton := lab.get_node_or_null("WalkCycleRig/Skeleton2D") as Skeleton2D
    if skeleton == null or skeleton.get_bone_count() < 9:
        push_error("RIG LAB FAIL: expected multi-bone skeleton")
        quit(1)
        return
    var near_leg := lab.get_node_or_null("WalkCycleRig/Skeleton2D/Pelvis/FrontUpperLeg") as Bone2D
    if near_leg == null:
        push_error("RIG LAB FAIL: near leg missing")
        quit(1)
        return
    lab.playing = false
    lab._pose(0.0)
    var first := near_leg.rotation
    lab._pose(3.0)
    if is_equal_approx(first, near_leg.rotation):
        push_error("RIG LAB FAIL: opposite contacts have same leg angle")
        quit(1)
        return
    for i in range(6):
        lab._pose(float(i))
    print("RIG LAB PASS: scene, Skeleton2D, legs, six pose keys")
    quit(0)
