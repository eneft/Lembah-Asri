extends SceneTree
## Acceptance test: full 8-direction frame animation, locked idle art, 2D collision and NPC.
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
            push_error("ANIMATION FAIL: missing AnimatedSprite2D")
            failures = true
        else:
            if actor.sprite_frames.get_animation_names().size() != 24:
                push_error("ANIMATION FAIL: expected 8 directions x idle/walk/run")
                failures = true
            if not (actor.material is ShaderMaterial):
                push_error("ANIMATION FAIL: missing static idle foot cleanup")
                failures = true
            elif (actor.material as ShaderMaterial).shader.code.find("unwanted_floor") < 0:
                push_error("ANIMATION FAIL: idle floor cleanup shader missing")
                failures = true
            for direction in ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]:
                var idle_key: String = "idle_" + direction
                if not actor.sprite_frames.has_animation(idle_key):
                    push_error("ANIMATION FAIL: missing " + idle_key)
                    failures = true
                    continue
                var idle_texture: Texture2D = actor.sprite_frames.get_frame_texture(idle_key, 0)
                if idle_texture == null or idle_texture.get_width() != 512 or idle_texture.get_height() != 640:
                    push_error("ANIMATION FAIL: locked master idle art changed for " + direction)
                    failures = true
                for state in ["walk", "run"]:
                    var key: String = state + "_" + direction
                    if not actor.sprite_frames.has_animation(key):
                        push_error("ANIMATION FAIL: missing " + key)
                        failures = true
                        continue
                    if actor.sprite_frames.get_frame_count(key) != 6:
                        push_error("ANIMATION FAIL: six distinct pose frames required for " + key)
                        failures = true
                    else:
                        for i in range(6):
                            var pose: AtlasTexture = actor.sprite_frames.get_frame_texture(key, i) as AtlasTexture
                            if pose == null or pose.get_width() != 512 or pose.get_height() != 640:
                                push_error("ANIMATION FAIL: HD atlas frame " + str(i) + " of " + key)
                                failures = true
                            elif pose.atlas.get_width() != 3072 or pose.atlas.get_height() != 640:
                                push_error("ANIMATION FAIL: atlas asset missing or cropped for " + key)
                                failures = true
                    var expected_fps: float = 12.0 if state == "run" else 8.5
                    if absf(actor.sprite_frames.get_animation_speed(key) - expected_fps) > 0.01:
                        push_error("ANIMATION FAIL: playback speed mismatch " + key)
                        failures = true
                # Left is mirrored from the right counterpart; no new inconsistent art.
                if direction.ends_with("_left") or direction == "left":
                    var counterpart: String = "right" if direction == "left" else direction.replace("_left", "_right")
                    for i in range(6):
                        var mirrored: AtlasTexture = actor.sprite_frames.get_frame_texture("walk_" + direction, i) as AtlasTexture
                        var source: AtlasTexture = actor.sprite_frames.get_frame_texture("walk_" + counterpart, i) as AtlasTexture
                        if mirrored == null or source == null or mirrored.atlas != source.atlas or mirrored.region != source.region:
                            push_error("ANIMATION FAIL: left mirror does not reuse counterpart image and frame: " + direction)
                            failures = true
            if not is_equal_approx(actor.scale.x, 0.36) or not is_equal_approx(actor.scale.y, 0.36):
                push_error("ANIMATION FAIL: locked playable character scale changed")
                failures = true
            if actor.animation != "idle_down_right":
                push_error("ANIMATION FAIL: initial facing should stay down_right")
                failures = true
        Input.action_press("ui_right")
        Input.action_press("run")
        for i in range(15):
            await physics_frame
        if player.animation_state != "run" or player.facing_name != "right":
            push_error("ANIMATION FAIL: run-right transition")
            failures = true
        if actor != null and (actor.animation != "run_right" or actor.frame == 0):
            push_error("ANIMATION FAIL: run frames are not advancing")
            failures = true
        Input.action_release("run")
        Input.action_release("ui_right")
        await physics_frame
        if player.animation_state != "idle":
            push_error("ANIMATION FAIL: returning to idle")
            failures = true
        var start_x: float = player.global_position.x
        Input.action_press("ui_right")
        for i in range(12):
            await physics_frame
        if player.global_position.x <= start_x or player.animation_state != "walk":
            push_error("ANIMATION FAIL: walk-right did not move")
            failures = true
        if actor != null and (actor.animation != "walk_right" or actor.frame == 0):
            push_error("ANIMATION FAIL: walk poses are not advancing")
            failures = true
        Input.action_release("ui_right")
        await physics_frame
        Input.action_press("ui_left")
        for i in range(6):
            await physics_frame
        if player.facing_name != "left" or actor == null or not actor.flip_h:
            push_error("ANIMATION FAIL: left must mirror right-side walk frames")
            failures = true
        Input.action_release("ui_left")
        await physics_frame
        if actor != null and actor.flip_h:
            push_error("ANIMATION FAIL: native left idle art must not be flipped")
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
        print("SMOKE PASS: Stage 1 8-dir 6-frame walking sprites, left mirror, original HD idle, crop collision, Camera2D, Bu Sari dialogue")
        quit(0)
