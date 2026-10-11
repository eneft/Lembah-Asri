extends SceneTree
## Acceptance test: 8 native HD base directions or legacy fallback, 2D collision and NPC.
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
        if not player.using_base_form:
            push_error("BASE FORM FAIL: 8 approved master PNGs must be active; fallback is no longer acceptable")
            failures = true
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
                for state in ["idle", "walk", "run"]:
                    var key: String = state + "_" + d
                    if not actor.sprite_frames.has_animation(key):
                        push_error("ANIMATION FAIL: missing state/direction " + key)
                        failures = true
                        continue
                    var count: int = actor.sprite_frames.get_frame_count(key)
                    if player.using_base_form:
                        # One real HD RGBA still pose for every direction and state.
                        # Movement does not use fabricated frame cycling.
                        var tex: Texture2D = actor.sprite_frames.get_frame_texture(key, 0)
                        if count != 1 or tex == null or tex is AtlasTexture or tex.get_size() != Vector2(1152, 1632):
                            push_error("BASE FORM FAIL: missing or wrong PNG: " + key)
                            failures = true
                    elif state == "idle":
                        var still: Texture2D = actor.sprite_frames.get_frame_texture(key, 0)
                        if count != 1 or still == null or still.get_size() != Vector2(512, 640):
                            push_error("LEGACY IDLE FAIL: missing HD idle pose: " + key)
                            failures = true
                    else:
                        if count != 16:
                            push_error("LEGACY WALK FAIL: expected 16 atlas frames: " + key)
                            failures = true
                        for j in range(count):
                            var frame: AtlasTexture = actor.sprite_frames.get_frame_texture(key, j) as AtlasTexture
                            if frame == null or frame.atlas.get_size() != Vector2(2048, 2560) or frame.region.size != Vector2(512, 640):
                                push_error("LEGACY ATLAS FAIL: wrong frame: " + key + "#" + str(j))
                                failures = true
                if not player.using_base_form and (d == "left" or d.ends_with("_left")):
                    var other: String = "right" if d == "left" else d.replace("_left", "_right")
                    var left_tex: AtlasTexture = actor.sprite_frames.get_frame_texture("walk_" + d, 0) as AtlasTexture
                    var right_tex: AtlasTexture = actor.sprite_frames.get_frame_texture("walk_" + other, 0) as AtlasTexture
                    if left_tex == null or right_tex == null or left_tex.atlas != right_tex.atlas:
                        push_error("LEGACY MIRROR FAIL: left fallback mismatch " + d)
                        failures = true
            var expected_scale: float = 0.15 if player.using_base_form else 0.36
            if not is_equal_approx(actor.scale.x, expected_scale) or not is_equal_approx(actor.scale.y, expected_scale):
                push_error("ANIMATION FAIL: playable scale changed")
                failures = true
            if player.using_base_form:
                if not actor.position.is_equal_approx(Vector2(0.0, -115.35)):
                    push_error("BASE FORM FAIL: feet not aligned to collision origin")
                    failures = true
                var front: Texture2D = actor.sprite_frames.get_frame_texture("idle_down", 0)
                var body_image: Image = front.get_image()
                if body_image == null or body_image.get_pixel(0, 0).a > 0.01 or body_image.get_pixel(1151, 1631).a > 0.01:
                    push_error("BASE FORM FAIL: PNG background is not transparent")
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
        if player.facing_name != "left" or actor == null or (actor.flip_h == player.using_base_form):
            push_error("ANIMATION FAIL: left orientation / unexpected flip")
            failures = true
        Input.action_release("ui_left")
        await physics_frame
        if actor != null and actor.flip_h:
            push_error("ANIMATION FAIL: unique left idle image must not be mirrored")
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
        print("SMOKE PASS: eight native RGBA protagonist bases are ACTIVE; no mirroring; stable feet, camera, crop collision and NPC")
        quit(0)
