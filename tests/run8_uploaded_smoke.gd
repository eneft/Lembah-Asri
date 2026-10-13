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
    if node.using_refined_back_loop:
        var revised: SpriteFrames = load(node.REFINED_BACK_RUN_PATH) as SpriteFrames
        if revised == null or not revised.has_animation("run_back_right") or revised.get_frame_count("run_back_right") != 12:
            push_error("UPLOADED RUN8 FAIL: revised 12-frame back diagonal source malformed")
            quit(1)
            return
        for direction in ["up_left", "up_right"]:
            var anim: String = "run_" + direction
            for frame_index in range(12):
                if actor.sprite_frames.get_frame_texture(anim, frame_index) != revised.get_frame_texture("run_back_right", frame_index):
                    push_error("UPLOADED RUN8 FAIL: wrong revised back run frame " + direction + "/" + str(frame_index))
                    quit(1)
                    return
        print("UPLOADED RUN8 REFINED REAR PASS: 12 full-source poses at 12 FPS, matching 2 directions")
    else:
        # The older 21 frames tilt/turn while moving, so this is a compatibility
        # fallback only; do not report it as a visually seamless running cycle.
        var approved: String = "res://assets/characters/run_uploaded/back_diagonal/back_left_right.tres"
        if ResourceLoader.exists(approved):
            var approved_frames: SpriteFrames = load(approved) as SpriteFrames
            if approved_frames == null:
                push_error("UPLOADED RUN8 FAIL: missing old source")
                quit(1)
                return
            for direction in ["up_left", "up_right"]:
                for out_index in range(12):
                    var input_index: int = int(node.REAR_DIAGONAL_RUN_LOOP_12[out_index])
                    var row_name: String = "row_" + str(int(input_index / 7) + 1)
                    if actor.sprite_frames.get_frame_texture("run_" + direction, out_index) != approved_frames.get_frame_texture(row_name, input_index % 7):
                        push_error("UPLOADED RUN8 FAIL: legacy back run frame mismatch")
                        quit(1)
                        return
            print("UPLOADED RUN8 REAR FALLBACK ONLY: 21-frame turning source; awaiting revised PNG in GitHub")
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
    # Two opposing foot-contact poses are required for a true run cycle:
    # source index 0 (first stride) and 7 (opposite foot). Last patch removed
    # 7 to hide color artifacts and accidentally created one-foot running.
    # Independently verify BOTH are restored, on both mirrored directions.
    var side_source: SpriteFrames = load(node.RESOURCES["right"]) as SpriteFrames
    if side_source == null:
        push_error("UPLOADED RUN8 FAIL: original side-run sheet unavailable")
        quit(1)
        return
    var side_original: Array[Texture2D] = []
    var side_rows := Array(side_source.get_animation_names())
    side_rows.sort()
    for row_name in side_rows:
        for j in range(side_source.get_frame_count(row_name)):
            side_original.append(side_source.get_frame_texture(row_name, j))
    if side_original.size() != 26:
        push_error("UPLOADED RUN8 FAIL: side source no longer contains 26 original textures")
        quit(1)
        return
    var expected_side: Array[int] = [0, 1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13]
    for direction in ["right", "left"]:
        var mapped: PackedInt32Array = node.run_source_indices(direction, side_original.size())
        if mapped.size() != 12 or not mapped.has(0) or not mapped.has(7):
            push_error("UPLOADED RUN8 FAIL: missing one of the two opposing foot contacts: " + direction)
            quit(1)
            return
        for slot in range(12):
            var source_index: int = int(mapped[slot])
            if source_index != expected_side[slot]:
                push_error("UPLOADED RUN8 FAIL: side RUN source order changed: " + direction + " frame " + str(slot))
                quit(1)
                return
            if source_index >= 14:
                push_error("UPLOADED RUN8 FAIL: side RUN crossed disconnected source row: " + direction)
                quit(1)
                return
            if actor.sprite_frames.get_frame_texture("run_" + direction, slot) != side_original[source_index]:
                push_error("UPLOADED RUN8 FAIL: side RUN texture mismatch " + direction + " frame " + str(slot))
                quit(1)
                return
        node.set_direction(direction, true)
        if actor.flip_h != (direction == "left"):
            push_error("UPLOADED RUN8 FAIL: left/right mirror mismatch " + direction)
            quit(1)
            return
        print("UPLOADED RUN8 TWO-FOOT PASS: ", direction, " contact poses 0 and 7 preserved, 12 ordered frames")

    var source_lengths: Dictionary = {"right": 26, "down_right": 18, "down": 8, "up": 8, "up_right": 12 if node.using_refined_back_loop else 21}
    for direction in directions:
        var original_name: String = direction
        if direction == "left":
            original_name = "right"
        elif direction == "down_left":
            original_name = "down_right"
        elif direction == "up_left":
            original_name = "up_right"
        var source_length: int = int(source_lengths[original_name])
        var indices: PackedInt32Array = node.run_source_indices(direction, source_length)
        if indices.size() != 12:
            push_error("UPLOADED RUN8 FAIL: retiming no longer has 12 frame indexes: " + direction)
            quit(1)
            return
        var previous: int = -1
        for index in indices:
            if index < previous or index < 0 or index >= source_length:
                push_error("UPLOADED RUN8 FAIL: frame order/index broken: " + direction)
                quit(1)
                return
            previous = index
        if (direction == "up_left" or direction == "up_right") and not node.using_refined_back_loop and (int(indices[0]) != 9 or int(indices[11]) != 20):
            push_error("UPLOADED RUN8 FAIL: rear-diagonal still includes walk/acceleration frames")
            quit(1)
            return
        print("UPLOADED RUN8 PHASE PASS: ", direction, " input=", source_length, " output=12 start=", indices[0], " end=", indices[11])
    # Do not shift the foot anchor or resize sprites during frame selection.
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
        if node.using_refined_back_loop and direction in ["up_left", "up_right"]:
            source_height = node.REFINED_BACK_HEIGHT
            foot_y = node.REFINED_BACK_FOOT
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
    # Actual alpha-bound measurements from the source files, used to update
    # SOURCE_VISIBLE_HEIGHT and SOURCE_FOOT_BASELINE. Ensure calibrations aren't
    # reverted to older values that differ from these downloaded assets.
    var measured_side_height: float = 980.0
    var measured_side_foot: float = 1077.0
    var measured_front_diag_height: float = 1069.0
    var measured_front_diag_foot: float = 1092.5
    var measured_down_foot: float = 1125.0
    var measured_up_foot: float = 1119.0
    if absf(float(node.SOURCE_VISIBLE_HEIGHT["left"]) - measured_side_height) > 0.5 or absf(float(node.SOURCE_VISIBLE_HEIGHT["right"]) - measured_side_height) > 0.5:
        push_error("UPLOADED RUN8 FAIL: side character visible-height calibration is outdated")
        quit(1)
        return
    if absf(float(node.SOURCE_FOOT_BASELINE["left"]) - measured_side_foot) > 0.5 or absf(float(node.SOURCE_FOOT_BASELINE["right"]) - measured_side_foot) > 0.5:
        push_error("UPLOADED RUN8 FAIL: lateral foot pivot is outdated")
        quit(1)
        return
    if absf(float(node.SOURCE_VISIBLE_HEIGHT["down_right"]) - measured_front_diag_height) > 0.5 or absf(float(node.SOURCE_VISIBLE_HEIGHT["down_left"]) - measured_front_diag_height) > 0.5:
        push_error("UPLOADED RUN8 FAIL: front diagonal scale calibration is outdated")
        quit(1)
        return
    if absf(float(node.SOURCE_FOOT_BASELINE["down_right"]) - measured_front_diag_foot) > 0.5 or absf(float(node.SOURCE_FOOT_BASELINE["down_left"]) - measured_front_diag_foot) > 0.5:
        push_error("UPLOADED RUN8 FAIL: front diagonal foot calibration is outdated")
        quit(1)
        return
    if absf(float(node.SOURCE_FOOT_BASELINE["down"]) - measured_down_foot) > 0.5 or absf(float(node.SOURCE_FOOT_BASELINE["up"]) - measured_up_foot) > 0.5:
        push_error("UPLOADED RUN8 FAIL: front/back foot calibration is outdated")
        quit(1)
        return
    print("UPLOADED RUN8 PROPORTIONS PASS: 8 matched heights, updated alpha-measured scale and pivots")
    # The original side shader added excess green to hands/sleeves. Confirm
    # NO side-RUN green channel gain or saturation manipulation remains.
    # This check does not assert that the original PNG contains no green tint.
    var grade: ShaderMaterial = actor.material as ShaderMaterial
    if grade == null or grade.shader == null:
        push_error("UPLOADED RUN8 FAIL: color grade material missing")
        quit(1)
        return
    for direction in directions:
        node.set_direction(direction, true)
        var actual_gain: Vector3 = grade.get_shader_parameter("channel_gain")
        var actual_saturation: float = grade.get_shader_parameter("saturation")
        var expected_gain: Vector3 = node.NEUTRAL_COLOR_GAIN
        var expected_saturation: float = 1.0
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
    for side in ["left", "right"]:
        node.set_direction(side, false)
        var idle_gain: Vector3 = grade.get_shader_parameter("channel_gain")
        var idle_saturation: float = grade.get_shader_parameter("saturation")
        if idle_gain.distance_to(node.NEUTRAL_COLOR_GAIN) > 0.001 or absf(idle_saturation - 1.0) > 0.001:
            push_error("UPLOADED RUN8 FAIL: idle side view still has artificial tint: " + side)
            quit(1)
            return
    print("UPLOADED RUN8 SIDE TINT PASS: neutral shader in left/right RUN + IDLE, alpha unchanged")
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
    # Regression from recorded gameplay: running UP/UP-LEFT for ~6 s previously
    # put the foot pivot at y=200 so the character's head crossed the HUD
    # and upper viewport. The actor should stop before any part is clipped.
    var safe_top_foot: float = node.TOP_HUD_SAFE_Y + node.ACTOR_BASE_SCALE * node.TARGET_VISIBLE_HEIGHT + node.RUN_HEADROOM_MARGIN
    actor.position = Vector2(640, 470)
    node.move_in_direction(Vector2(-1, -1), 8.0)
    if actor.position.y < safe_top_foot - 0.01:
        push_error("UPLOADED RUN8 FAIL: full silhouette escapes the top HUD during up-left RUN")
        quit(1)
        return
    if actor.position.x < node.STAGE_SIDE_MARGIN - 0.01:
        push_error("UPLOADED RUN8 FAIL: character escapes left viewport during up-left RUN")
        quit(1)
        return
    node.set_direction("up_left", false)
    if actor.animation != "idle_up_left" or actor.position.y < safe_top_foot - 0.01:
        push_error("UPLOADED RUN8 FAIL: idle immediately after up-left RUN is clipped")
        quit(1)
        return
    actor.position = Vector2(640, 470)
    node.move_in_direction(Vector2(1, 0), 10.0)
    if actor.position.x > 1280.0 - node.STAGE_SIDE_MARGIN + 0.01:
        push_error("UPLOADED RUN8 FAIL: side RUN exits right viewport")
        quit(1)
        return
    print("UPLOADED RUN8 SCREEN BOUNDS PASS: full head visible above HUD and side edges safe")
    node.queue_free()
    print("UPLOADED RUN8 PASS")
    quit(0)
