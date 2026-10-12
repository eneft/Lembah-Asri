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
    # The user explicitly requested 12 FPS, NOT the same total loop duration.
    # Eight-frame source loops in 8/12 sec; 26-frame source loops in 26/12 sec.
    # Never discard or duplicate frames merely to force matching cycle duration.
    var directions: Array[String] = ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]
    var vectors: Array[Vector2] = [
        Vector2(1,0), Vector2(1,1), Vector2(0,1), Vector2(-1,1),
        Vector2(-1,0), Vector2(-1,-1), Vector2(0,-1), Vector2(1,-1)
    ]
    for i in range(directions.size()):
        var direction: String = directions[i]
        var anim: String = "run_" + direction
        var frame_count: int = actor.sprite_frames.get_frame_count(anim)
        var fps: float = actor.sprite_frames.get_animation_speed(anim)
        if absf(fps - 12.0) > 0.001:
            push_error("UPLOADED RUN8 FAIL: animation FPS is not 12: " + direction + " = " + str(fps))
            quit(1)
            return
        if not actor.sprite_frames.get_animation_loop(anim):
            push_error("UPLOADED RUN8 FAIL: animation is not looping: " + direction)
            quit(1)
            return
        # SpriteFrames animation_speed is frames/second only when duration=1.
        for frame_index in range(frame_count):
            var frame_duration: float = actor.sprite_frames.get_frame_duration(anim, frame_index)
            if absf(frame_duration - 1.0) > 0.001:
                push_error("UPLOADED RUN8 FAIL: frame has non-standard duration: " + direction + "#" + str(frame_index))
                quit(1)
                return
        # Movement still uses independent world speed normalized for diagonals.
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
        print("UPLOADED RUN8 12FPS PASS: ", direction, " frames=", frame_count, " fps=", fps, " cycle_s=", float(frame_count) / fps, " move_px_100ms=", distance)
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
    print("UPLOADED RUN8 CADENCE PASS: 12 FPS on 8 directions, normalized movement, stride phase preserved")
    # Visible alpha bounds, NOT PNG canvas dimensions, define perceived size.
    # Verify all 8 native/mirrored directions display one consistent body height
    # and anchor their median foot baseline to the same actor.position.
    var expected_body_screen_px: float = node.ACTOR_BASE_SCALE * node.TARGET_VISIBLE_HEIGHT
    var observed_scale: Dictionary = {}
    var observed_foot: Dictionary = {}
    for direction in directions:
        node.set_direction(direction, true)
        if not node.SOURCE_VISIBLE_HEIGHT.has(direction):
            push_error("UPLOADED RUN8 FAIL: direction lacks silhouette calibration: " + direction)
            quit(1)
            return
        if not node.SOURCE_FOOT_BASELINE.has(direction):
            push_error("UPLOADED RUN8 FAIL: direction lacks foot alignment: " + direction)
            quit(1)
            return
        var source_height: float = float(node.SOURCE_VISIBLE_HEIGHT[direction])
        var foot_y: float = float(node.SOURCE_FOOT_BASELINE[direction])
        var visible_height: float = actor.scale.y * source_height
        if absf(visible_height - expected_body_screen_px) > 0.02:
            push_error("UPLOADED RUN8 FAIL: size differs from reference: " + direction + " rendered_height=" + str(visible_height))
            quit(1)
            return
        if absf(actor.scale.x - actor.scale.y) > 0.00001:
            push_error("UPLOADED RUN8 FAIL: non-proportional XY scale: " + direction)
            quit(1)
            return
        if absf(actor.offset.y + foot_y) > 0.001 or absf(actor.offset.x + node.PIVOT_X) > 0.001:
            push_error("UPLOADED RUN8 FAIL: foot pivot misaligned: " + direction)
            quit(1)
            return
        observed_scale[direction] = actor.scale.x
        observed_foot[direction] = actor.offset.y
        print("UPLOADED RUN8 SIZE PASS: ", direction, " rendered_visible_height_px=", visible_height, " actor_scale=", actor.scale.x, " foot=", -actor.offset.y)
    for pairing in [["left", "right"], ["down_left", "down_right"], ["up_left", "up_right"]]:
        if absf(float(observed_scale[pairing[0]]) - float(observed_scale[pairing[1]])) > 0.00001:
            push_error("UPLOADED RUN8 FAIL: mirrored pair has differing size: " + str(pairing))
            quit(1)
            return
        if absf(float(observed_foot[pairing[0]]) - float(observed_foot[pairing[1]])) > 0.001:
            push_error("UPLOADED RUN8 FAIL: mirrored pair has differing foot pivot: " + str(pairing))
            quit(1)
            return
    print("UPLOADED RUN8 PROPORTIONS PASS: 8 matched visible heights, uniform XY scale, foot pivots and mirrors")
    node.queue_free()
    print("UPLOADED RUN8 PASS")
    quit(0)
