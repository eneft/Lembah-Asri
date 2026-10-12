extends SceneTree

func _initialize() -> void:
    call_deferred("_check")

func _check() -> void:
    var scene: PackedScene = load("res://scenes/run8_uploaded.tscn") as PackedScene
    if scene == null:
        push_error("UPLOADED RUN8 FAIL: scene missing")
        quit(1)
        return
    var node := scene.instantiate()
    root.add_child(node)
    await process_frame
    var actor: AnimatedSprite2D = node.get_node("Runner")
    if actor.sprite_frames == null:
        push_error("UPLOADED RUN8 FAIL: SpriteFrames missing")
        quit(1)
        return
    for d in ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]:
        var key: String = "run_" + d
        if not actor.sprite_frames.has_animation(key):
            push_error("UPLOADED RUN8 FAIL: missing " + key)
            quit(1)
            return
        var count: int = actor.sprite_frames.get_frame_count(key)
        if count < 2:
            push_error("UPLOADED RUN8 FAIL: insufficient frames " + key)
            quit(1)
            return
        node.set_direction(d, true)
        print("UPLOADED RUN8 FRAMES ", d, ": ", count)
    # A source uploaded later must actually load: do not pass on legacy art.
    var approved: String = "res://assets/characters/run_uploaded/back_diagonal/lembah_asri_run_49_7x7_transparent_lossless.png"
    if ResourceLoader.exists(approved):
        for direction in ["up_left", "up_right"]:
            var anim: String = "run_" + direction
            if actor.sprite_frames.get_frame_count(anim) != 49:
                push_error("UPLOADED RUN8 FAIL: approved sheet has wrong frame count for " + direction)
                quit(1)
                return
        print("UPLOADED RUN8 APPROVED BACK DIAGONAL PASS: 49 source frames mirrored")
    else:
        print("UPLOADED RUN8 NOTE: waiting for approved rear-diagonal PNG in repository")
    node.set_direction("up_right", true)
    if actor.flip_h:
        push_error("UPLOADED RUN8 FAIL: back-right should use native PNG")
        quit(1)
        return
    node.set_direction("up_left", true)
    if not actor.flip_h:
        push_error("UPLOADED RUN8 FAIL: back-left should be mirrored PNG")
        quit(1)
        return
    for direction in ["right", "left"]:
        var anim: String = "run_" + direction
        var duration: float = float(actor.sprite_frames.get_frame_count(anim)) / actor.sprite_frames.get_animation_speed(anim)
        if absf(duration - 1.0) > 0.01:
            push_error("UPLOADED RUN8 FAIL: side-run loop timing diverged: " + direction)
            quit(1)
            return
    node.queue_free()
    print("UPLOADED RUN8 PASS")
    quit(0)
