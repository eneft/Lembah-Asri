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
    # Verify all three rows of the edited user's Godot 4 asset are kept in
    # source order as one 21-frame running cycle (mirrored for the other side).
    var approved: String = "res://assets/characters/run_uploaded/back_diagonal/back_left_right.tres"
    if ResourceLoader.exists(approved):
        var approved_frames: SpriteFrames = load(approved) as SpriteFrames
        if approved_frames == null:
            push_error("UPLOADED RUN8 FAIL: cannot load edited rear-diagonal resource")
            quit(1)
            return
        var expected_frames: int = 0
        for row_name in ["row_1", "row_2", "row_3"]:
            if not approved_frames.has_animation(row_name):
                push_error("UPLOADED RUN8 FAIL: missing row " + row_name)
                quit(1)
                return
            expected_frames += approved_frames.get_frame_count(row_name)
        if expected_frames != 21:
            push_error("UPLOADED RUN8 FAIL: edited asset must have 21 frames")
            quit(1)
            return
        for direction in ["up_left", "up_right"]:
            var anim: String = "run_" + direction
            if actor.sprite_frames.get_frame_count(anim) != expected_frames:
                push_error("UPLOADED RUN8 FAIL: unexpected rear-diagonal frame count for " + direction)
                quit(1)
                return
            var example_texture: Texture2D = actor.sprite_frames.get_frame_texture(anim, 0)
            if example_texture.get_size() != Vector2(768, 1168):
                push_error("UPLOADED RUN8 FAIL: rear-diagonal canvas size differs from 768x1168")
                quit(1)
                return
        print("UPLOADED RUN8 APPROVED BACK DIAGONAL PASS: 21 frames, common canvas, mirrored")
    else:
        print("UPLOADED RUN8 NOTE: edited back_left_right.tres/PNG assets not yet in repository")
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
    # Every 8-direction animation must use exactly the same complete-cycle
    # duration even when source sheets have different frame counts.
    var target_duration: float = -1.0
    var directions: Array[String] = ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]
    var vectors: Array[Vector2] = [
        Vector2(1,0), Vector2(1,1), Vector2(0,1), Vector2(-1,1),
        Vector2(-1,0), Vector2(-1,-1), Vector2(0,-1), Vector2(1,-1)
    ]
    for i in range(directions.size()):
        var direction: String = directions[i]
        var anim: String = "run_" + direction
        var frame_count: int = actor.sprite_frames.get_frame_count(anim)
        var speed: float = actor.sprite_frames.get_animation_speed(anim)
        var duration: float = float(frame_count) / speed
        if target_duration < 0.0:
            target_duration = duration
        if absf(duration - target_duration) > 0.001:
            push_error("UPLOADED RUN8 FAIL: unsynchronized animation cycle: " + direction)
            quit(1)
            return
        # Moving diagonally must cover the same distance as cardinal directions.
        actor.position = Vector2(640, 470)
        node.move_in_direction(vectors[i], 0.1)
        var distance: float = actor.position.distance_to(Vector2(640, 470))
        if absf(distance - 16.0) > 0.02:
            push_error("UPLOADED RUN8 FAIL: differing movement speed: " + direction + " = " + str(distance))
            quit(1)
            return
        if node.current_dir != direction:
            push_error("UPLOADED RUN8 FAIL: input routed to wrong animation: " + direction)
            quit(1)
            return
        print("UPLOADED RUN8 SPEED PASS: ", direction, " cycle_s=", duration, " travel_px_100ms=", distance)
    if target_duration >= 1.0:
        push_error("UPLOADED RUN8 FAIL: the agreed run animation is still too slow")
        quit(1)
        return
    # Turning mid-stride must not jump back to first frame.
    node.set_direction("down", true)
    actor.play()
    actor.set_frame_and_progress(3, 0.5)
    var before_phase: float = (float(actor.frame) + actor.frame_progress) / float(actor.sprite_frames.get_frame_count(actor.animation))
    node.set_direction("right", true)
    var after_phase: float = (float(actor.frame) + actor.frame_progress) / float(actor.sprite_frames.get_frame_count(actor.animation))
    if absf(before_phase - after_phase) > 0.01:
        push_error("UPLOADED RUN8 FAIL: run phase resets on direction change")
        quit(1)
        return
    print("UPLOADED RUN8 CADENCE PASS: 8 equal-speed directions, diagonals normalized, stride phase preserved")
    node.queue_free()
    print("UPLOADED RUN8 PASS")
    quit(0)
