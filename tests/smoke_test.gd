extends SceneTree
## Gameplay acceptance test: HD textures, shader-driven gait, collisions and interactions.
var failures := false

func _initialize() -> void:
    call_deferred("_check")

func _check() -> void:
    var packed := load("res://scenes/house_garden_stage1.tscn") as PackedScene
    if packed == null:
        push_error("STAGE1 FAIL: main scene missing")
        quit(1)
        return
    var world := packed.instantiate()
    root.add_child(world)
    await process_frame
    await process_frame
    var expected: Array[String] = ["BackgroundBase","HouseMain","SmallCoop","GardenTomato","GardenEggplant","GardenGreens","ForegroundFoliage","Player","BuSari","HouseWallsCollision","CoopCollision"]
    for name in expected:
        if world.get_node_or_null(name) == null:
            push_error("STAGE1 FAIL: missing " + name)
            failures = true
    var lab_btn: Button = world.get_node_or_null("HUD/Open3DCharacterLab") as Button
    if lab_btn == null:
        push_error("STAGE1 FAIL: 3D character testing control not visible")
        failures = true
    elif lab_btn.position.x < 350.0 or lab_btn.position.x > 780.0 or lab_btn.position.y > 100.0:
        push_error("STAGE1 FAIL: 3D model button overlaps concept HUD")
        failures = true
    if not ResourceLoader.exists("res://scenes/character_lab_3d.tscn"):
        push_error("STAGE1 FAIL: 3D lab destination missing")
        failures = true
    var player = world.get_node_or_null("Player")
    if player != null and player is CharacterBody2D:
        var camera = player.get_node_or_null("Camera2D")
        if camera == null or not camera is Camera2D:
            push_error("STAGE1 FAIL: no Camera2D")
            failures = true
        var actor: AnimatedSprite2D = player.get_node_or_null("AnimatedSprite2D") as AnimatedSprite2D
        if actor == null or actor.sprite_frames == null:
            push_error("ANIMATION FAIL: missing player sprite")
            failures = true
        else:
            if not (actor.material is ShaderMaterial):
                push_error("ANIMATION FAIL: lossless walk/run gait shader is missing")
                failures = true
            elif (actor.material as ShaderMaterial).shader == null:
                push_error("ANIMATION FAIL: walk/run shader resource is missing")
                failures = true
            elif not (actor.material as ShaderMaterial).shader.code.contains("unwanted_floor"):
                push_error("ANIMATION FAIL: baked white foot stroke must be masked in shader")
                failures = true
            if actor.sprite_frames.get_animation_names().size() != 24:
                push_error("ANIMATION FAIL: expected 24 animations (3 states x 8 directions)")
                failures = true
            for state in ["idle", "walk", "run"]:
                var count := 1 # One approved HD pose per direction until full motion frames exist
                for dir_name in ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]:
                    var key: String = state + "_" + dir_name
                    if not actor.sprite_frames.has_animation(key) or actor.sprite_frames.get_frame_count(key) != count:
                        push_error("ANIMATION FAIL: frame count for " + key)
                        failures = true
                    elif abs(actor.sprite_frames.get_animation_speed(key) - 12.0) > 0.01:
                        push_error("ANIMATION FAIL: 12 FPS mismatch " + key)
                        failures = true
            # All eight directions must keep original full-size art.
            # No mixed older chibi source or resolution reduction.
            for dir_name in ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]:
                var hd: Texture2D = actor.sprite_frames.get_frame_texture("idle_" + dir_name, 0)
                if hd == null or hd.get_width() != 512 or hd.get_height() != 640:
                    push_error("ANIMATION FAIL: full-resolution HD PNG for " + dir_name)
                    failures = true
                else:
                    for state in ["walk", "run"]:
                        var animated: Texture2D = actor.sprite_frames.get_frame_texture(state + "_" + dir_name, 0)
                        if animated != hd:
                            push_error("ANIMATION FAIL: walk/run may not change approved hero artwork: " + dir_name)
                            failures = true
            if not is_equal_approx(actor.scale.x, 0.36) or not is_equal_approx(actor.scale.y, 0.36):
                push_error("ANIMATION FAIL: player scale/SD proportions modified")
                failures = true
            if actor.animation != "idle_down_right":
                push_error("ANIMATION FAIL: default facing should be down_right")
                failures = true
        var phase_before: float = player.gait_phase
        var run_start: Vector2 = player.global_position
        Input.action_press("ui_right")
        Input.action_press("run")
        for i in range(4):
            await physics_frame
        if player.animation_state != "run" or player.facing_name != "right":
            push_error("ANIMATION FAIL: right + run transition")
            failures = true
        if is_equal_approx(player.gait_phase, phase_before) or player.gait_strength <= 0.0:
            push_error("ANIMATION FAIL: run must drive a visible procedural gait cycle")
            failures = true
        var run_distance: float = player.global_position.distance_to(run_start)
        var run_phase_expected: float = wrapf(phase_before + TAU * run_distance / 112.0, 0.0, TAU)
        if absf(wrapf(player.gait_phase - run_phase_expected + PI, 0.0, TAU) - PI) > 0.02:
            push_error("ANIMATION FAIL: run gait is not synchronized to actual ground distance")
            failures = true
        if actor != null and actor.material is ShaderMaterial:
            var gait_mat: ShaderMaterial = actor.material as ShaderMaterial
            if float(gait_mat.get_shader_parameter("strength")) <= 0.0:
                push_error("ANIMATION FAIL: shader not receiving gait motion")
                failures = true
        Input.action_release("run")
        Input.action_release("ui_right")
        await physics_frame
        if player.animation_state != "idle":
            push_error("ANIMATION FAIL: idle transition")
            failures = true
        for i in range(20):
            await physics_frame
        if player.gait_strength > 0.01:
            push_error("ANIMATION FAIL: procedural gait persists while idle")
            failures = true
        var start_x: float = player.global_position.x
        var walk_phase_before: float = player.gait_phase
        Input.action_press("ui_right")
        for i in range(5):
            await physics_frame
        Input.action_release("ui_right")
        if player.global_position.x <= start_x + 0.01:
            push_error("STAGE1 FAIL: character did not move")
            failures = true
        if player.animation_state != "walk":
            push_error("ANIMATION FAIL: walking input must enter walk state")
            failures = true
        var walk_distance: float = player.global_position.x - start_x
        var walk_phase_expected: float = wrapf(walk_phase_before + TAU * walk_distance / 90.0, 0.0, TAU)
        if absf(wrapf(player.gait_phase - walk_phase_expected + PI, 0.0, TAU) - PI) > 0.02:
            push_error("ANIMATION FAIL: walking gait is not synchronized to actual ground distance")
            failures = true
        # Blocked movement must not continue cycling the shader.
        var phase_at_stop: float = player.gait_phase
        player._advance_gait(0.05, 0.0, true)
        if not is_equal_approx(player.gait_phase, phase_at_stop):
            push_error("ANIMATION FAIL: feet animate despite no travelled distance")
            failures = true
        # Regression: long movement must never take the player into the sky.
        Input.action_press("ui_up")
        for i in range(240):
            await physics_frame
        Input.action_release("ui_up")
        if player.global_position.y < 455.0 or not player.is_walkable_foot(player.global_position):
            push_error("STAGE1 FAIL: hero escaped walkable courtyard into roof/sky")
            failures = true
        # Follow with a long crossing toward the right bank.
        Input.action_press("ui_right")
        for i in range(200):
            await physics_frame
        Input.action_release("ui_right")
        if not player.is_walkable_foot(player.global_position):
            push_error("STAGE1 FAIL: hero crossed walkable boundary")
            failures = true
        # Regression from real gameplay capture: protagonist crossed the
        # tomato plot despite painted fence/crops. Prevent crop trampling.
        var tomato_blocker = world.get_node_or_null("TomatoBedInteriorCollision")
        if tomato_blocker == null or not (tomato_blocker is StaticBody2D):
            push_error("STAGE1 FAIL: tomato plot has no interior collision")
            failures = true
        else:
            player.global_position = Vector2(635, 590)
            Input.action_press("ui_left")
            for i in range(70):
                await physics_frame
            Input.action_release("ui_left")
            if player.global_position.x < 601.0:
                push_error("STAGE1 FAIL: protagonist stepped into the tomato bed")
                failures = true
        player.global_position = world.npc.global_position + Vector2(-49,0)
        var event := InputEventKey.new()
        event.keycode = KEY_E
        event.pressed = true
        world._unhandled_input(event)
        if world.interaction_timer <= 0.0 or world.dialogue_label.text.find("Bu Sari") < 0:
            push_error("STAGE1 FAIL: interaction did not work")
            failures = true
    else:
        failures = true
        push_error("STAGE1 FAIL: player is not CharacterBody2D")
    for name in ["BackgroundBase","HouseMain","GardenTomato","GardenEggplant","GardenGreens"]:
        var sprite = world.get_node_or_null(name)
        if sprite != null and sprite is Sprite2D and sprite.texture != null:
            if sprite.texture.get_width() <= 20:
                push_error("STAGE1 FAIL: small texture: " + name)
                failures = true
        else:
            failures = true
            push_error("STAGE1 FAIL: missing art for " + name)
    root.remove_child(world)
    world.free()
    await process_frame
    if failures:
        quit(1)
    else:
        print("SMOKE PASS: Stage 1 8-dir HD gait, artifact mask, tomato crop collision, camera, Bu Sari dialogue")
        quit(0)
