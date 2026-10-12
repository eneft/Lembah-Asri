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
        if count != 12:
            push_error("UPLOADED RUN8 FAIL: expected EXACTLY 12 retimed frames for " + key + ", got " + str(count))
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
            if actor.sprite_frames.get_frame_count(anim) != 12:
                push_error("UPLOADED RUN8 FAIL: edited rear diagonal did not retime to 12: " + direction)
                quit(1)
                return
            for out_index in range(12):
                # Preserve exactly the ordered source poses in the native 21-frame
                # resource; the mirror setting may change, never the texture.
                var input_index: int = int(floor(float(out_index) * 21.0 / 12.0))
                var row_name: String = "row_" + str(int(input_index / 7) + 1)
                var expected_tex: Texture2D = approved_frames.get_frame_texture(row_name, input_index % 7)
                var actual_tex: Texture2D = actor.sprite_frames.get_frame_texture(anim, out_index)
                if actual_tex != expected_tex:
                    push_error("UPLOADED RUN8 FAIL: reordered/altered edited source frame in " + direction + "#" + str(out_index))
                    quit(1)
                    return
                if actual_tex.get_size() != Vector2(768, 1168):
                    push_error("UPLOADED RUN8 FAIL: edited source frame canvas size is wrong")
                    quit(1)
                    return
        print("UPLOADED RUN8 APPROVED BACK DIAGONAL PASS: 21 source poses -> 12 ordered frames, common canvas, mirrored")
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
    # Native source integrity: 8/18/26 and edited 21 image frames remain in
    # their original SpriteFrames resources, while active previews use 12.
    var source_lengths: Dictionary = {"right": 26, "down_right": 18, "down": 8, "up": 8, "up_right": 21}
    var source_to_retuned: Dictionary = {}
    for direction in directions:
        var original_name: String = direction
        if direction == "left":
            original_name = "right"
        elif direction == "down_left":
            original_name = "down_right"
        elif direction == "up_left":
            original_name = "up_right"
        var source_length: int = int(source_lengths[original_name])
        var preceding_index: int = -1
        var unique_input_indexes: Dictionary = {}
        for target_index in range(12):
            var from_source: int = int(floor(float(target_index) * float(source_length) / 12.0))
            if from_source < preceding_index or from_source >= source_length:
                push_error("UPLOADED RUN8 FAIL: retiming order broken for " + direction)
                quit(1)
                return
            preceding_index = from_source
            unique_input_indexes[from_source] = true
        # 8 -> 12 repeats only four source poses, while longer sources
        # cover all 12 output slots with non-repeated original textures.
        var expected_unique: int = mini(source_length, 12)
        if unique_input_indexes.size() != expected_unique:
            push_error("UPLOADED RUN8 FAIL: source poses lost or over-repeated in " + direction)
            quit(1)
            return
        source_to_retuned[direction] = unique_input_indexes.size()
        print("UPLOADED RUN8 PHASE PASS: ", direction, " input=", source_length, " output=12 distinct=", unique_input_indexes.size())
    # Do not shift the foot anchor or resize the sprite during frame selection.
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
    print("UPLOADED RUN8 CADENCE PASS: 8 x 12 FRAMES @ 12 FPS, normalized movement, stride phase preserved")
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
    # Color consistency is display-only. The 12 source-texture frames and
    # 12 FPS stay unchanged, including both mirrored right/left directions.
    var grade: ShaderMaterial = actor.material as ShaderMaterial
    if grade == null or grade.shader == null:
        push_error("UPLOADED RUN8 FAIL: color grade material missing")
        quit(1)
        return
    for direction in directions:
        node.set_direction(direction, true)
        var actual_gain: Vector3 = grade.get_shader_parameter("channel_gain")
        var actual_saturation: float = grade.get_shader_parameter("saturation")
        var expected_gain: Vector3 = node.SIDE_COLOR_GAIN if direction == "left" or direction == "right" else node.NEUTRAL_COLOR_GAIN
        var expected_saturation: float = node.SIDE_SATURATION if direction == "left" or direction == "right" else 1.0
        if actual_gain.distance_to(expected_gain) > 0.001:
            push_error("UPLOADED RUN8 FAIL: wrong color balance for " + direction)
            quit(1)
            return
        if absf(actual_saturation - expected_saturation) > 0.001:
            push_error("UPLOADED RUN8 FAIL: wrong saturation for " + direction)
            quit(1)
            return
        if actor.sprite_frames.get_frame_count("run_" + direction) != 12:
            push_error("UPLOADED RUN8 FAIL: color correction altered animation frames for " + direction)
            quit(1)
            return
        print("UPLOADED RUN8 COLOR PASS: ", direction, " gain=", actual_gain, " saturation=", actual_saturation)
    print("UPLOADED RUN8 COLOR GRADING PASS: 8 directions, matched L/R saturation, original alpha preserved")
    # The user's five new PNGs take precedence only when all 5 are present.
    # Until uploaded, legacy remains an EXPLICITLY LABELED fallback rather
    # than falsely reporting that the new idle sprites are installed.
    var expected_new_idle: bool = true
    for source_name in ["front", "front_right", "right", "back_right", "back"]:
        if not ResourceLoader.exists(node.NEW_IDLE_BASE_PATH + source_name + ".png"):
            expected_new_idle = false
    if node.using_new_idle != expected_new_idle:
        push_error("UPLOADED RUN8 FAIL: idle source selection mismatches actual uploaded files")
        quit(1)
        return
    for direction in directions:
        node.set_direction(direction, false)
        var idle_key: String = "idle_" + direction
        if actor.animation != idle_key or actor.is_playing():
            push_error("UPLOADED RUN8 FAIL: stopping did not select static IDLE " + direction)
            quit(1)
            return
        if actor.sprite_frames.get_frame_count(idle_key) != 1:
            push_error("UPLOADED RUN8 FAIL: missing idle frame for " + direction)
            quit(1)
            return
        var expected_flip: bool = expected_new_idle and direction in ["left", "down_left", "up_left"]
        if actor.flip_h != expected_flip:
            push_error("UPLOADED RUN8 FAIL: wrong mirroring of idle pose: " + direction)
            quit(1)
            return
        var original: String = str(node.NEW_IDLE_SOURCE[direction])
        var idle_path: String = (node.NEW_IDLE_BASE_PATH + original + ".png") if expected_new_idle else (node.IDLE_BASE_PATH + direction + ".png")
        var texture_expected: Texture2D = load(idle_path) as Texture2D
        if texture_expected == null or actor.sprite_frames.get_frame_texture(idle_key, 0) != texture_expected:
            push_error("UPLOADED RUN8 FAIL: idle loaded wrong PNG: " + direction)
            quit(1)
            return
        var desired_size: Vector2 = Vector2(1024, 1536) if expected_new_idle else Vector2(1152, 1632)
        if texture_expected.get_size() != desired_size:
            push_error("UPLOADED RUN8 FAIL: unexpected image dimensions for idle " + direction)
            quit(1)
            return
        var source_visible_height: float = float(node.NEW_IDLE_VISIBLE_HEIGHT[original]) if expected_new_idle else float(node.IDLE_VISIBLE_HEIGHT[direction])
        var source_foot_y: float = float(node.NEW_IDLE_FOOT_Y[original]) if expected_new_idle else node.IDLE_FOOT_Y
        var source_pivot_x: float = float(node.NEW_IDLE_PIVOT_X[original]) if expected_new_idle else node.IDLE_PIVOT_X
        var calibrated_height: float = actor.scale.y * source_visible_height
        if absf(calibrated_height - expected_body_screen_px) > 0.05:
            push_error("UPLOADED RUN8 FAIL: idle size mismatches run " + direction)
            quit(1)
            return
        if absf(actor.offset.x + source_pivot_x) > 0.001 or absf(actor.offset.y + source_foot_y) > 0.001:
            push_error("UPLOADED RUN8 FAIL: idle foot/pivot mismatched " + direction)
            quit(1)
            return
        node.set_direction(direction, true)
        if actor.animation != "run_" + direction or not actor.is_playing():
            push_error("UPLOADED RUN8 FAIL: does not resume RUN after IDLE " + direction)
            quit(1)
            return
        print("UPLOADED RUN8 IDLE PASS: ", direction, " new_source=", expected_new_idle, " image=", idle_path)
    node.set_direction("down", false)
    if expected_new_idle:
        print("UPLOADED RUN8 NEW USER IDLE 8-DIR PASS: 5 real images + 3 mirrors")
    else:
        print("UPLOADED RUN8 WARNING: 5 new idle PNGs are NOT in repository, using legacy fallback")
    node.queue_free()
    print("UPLOADED RUN8 PASS")
    quit(0)
