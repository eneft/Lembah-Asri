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
            push_error("ANIMATION FAIL: missing hero animation")
            failures = true
        else:
            if actor.sprite_frames.get_animation_names().size() != 24:
                push_error("ANIMATION FAIL: requires 8 directions x 3 states")
                failures = true
            for d in ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]:
                var idle: AtlasTexture = actor.sprite_frames.get_frame_texture("idle_" + d, 0) as AtlasTexture
                if idle == null or idle.region.size != Vector2(512, 640):
                    push_error("ANIMATION FAIL: idle and walk must share canonical 512x640 atlas frames: " + d)
                    failures = true
                for state in ["walk","run"]:
                    var key: String = state + "_" + d
                    if actor.sprite_frames.get_frame_count(key) != 16:
                        push_error("ANIMATION FAIL: 16 pose frames required: " + key)
                        failures = true
                    for j in range(16):
                        var tex: AtlasTexture = actor.sprite_frames.get_frame_texture(key, j) as AtlasTexture
                        if tex == null or tex.atlas.get_width() != 2048 or tex.atlas.get_height() != 2560 or tex.region.size != Vector2(512,640):
                            push_error("ANIMATION FAIL: wrong 4x4 atlas frame " + key + "#" + str(j) + " atlas=" + (str(tex.atlas.get_size()) if tex != null else "NULL") + " region=" + (str(tex.region) if tex != null else "NULL"))
                            failures = true
                if d == "left" or d.ends_with("_left"):
                    var other: String = "right" if d == "left" else d.replace("_left","_right")
                    var left_tex: AtlasTexture = actor.sprite_frames.get_frame_texture("walk_" + d, 0) as AtlasTexture
                    var right_tex: AtlasTexture = actor.sprite_frames.get_frame_texture("walk_" + other, 0) as AtlasTexture
                    if left_tex == null or right_tex == null or left_tex.atlas != right_tex.atlas:
                        push_error("ANIMATION FAIL: mirrored left source mismatch " + d)
                        failures = true
            if not is_equal_approx(actor.scale.x, 0.36) or not is_equal_approx(actor.scale.y, 0.36):
                push_error("ANIMATION FAIL: playable scale changed")
                failures = true
        Input.action_press("ui_right")
        for j in range(22):
            await physics_frame
        if player.animation_state != "walk" or player.facing_name != "right":
            push_error("ANIMATION FAIL: walk transition")
            failures = true
        Input.action_release("ui_right")
        await physics_frame
        if player.animation_state != "idle":
            push_error("ANIMATION FAIL: idle transition")
            failures = true
        Input.action_press("ui_left")
        for j in range(6):
            await physics_frame
        if player.facing_name != "left" or actor == null or not actor.flip_h:
            push_error("ANIMATION FAIL: mirrored left direction")
            failures = true
        Input.action_release("ui_left")
        await physics_frame
        if actor != null and not actor.flip_h:
            push_error("ANIMATION FAIL: idle should preserve mirror to prevent visual snap")
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
        print("SMOKE PASS: Stage 1 8-dir 16-frame walk with matched idle, mirrored left, camera, crop collision and NPC")
        quit(0)
