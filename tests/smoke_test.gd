extends SceneTree
var failed := false
func _initialize() -> void:
    call_deferred("_check")
func _check() -> void:
    var src: SpriteFrames = load("res://assets/characters/run_cycle/Run.tres") as SpriteFrames
    if src == null or not src.has_animation("row_1") or src.get_frame_count("row_1") != 31:
        push_error("RUN FAIL: original 31 real frames not imported")
        quit(1)
        return
    if src.get_frame_count("row_6") != 1:
        push_error("RUN FAIL: original single-frame idle missing")
        quit(1)
        return
    var atlas: AtlasTexture = src.get_frame_texture("row_1", 0) as AtlasTexture
    if atlas == null or atlas.atlas == null or atlas.atlas.get_size() != Vector2(2444, 3702):
        push_error("RUN FAIL: invalid full-resolution source atlas")
        quit(1)
        return
    var scene: PackedScene = load("res://scenes/house_garden_stage1.tscn") as PackedScene
    if scene == null:
        quit(1)
        return
    var world := scene.instantiate()
    root.add_child(world)
    await process_frame
    await process_frame
    var player = world.get_node_or_null("Player")
    if player == null or not player.using_imported_run:
        push_error("RUN FAIL: gameplay player is not the imported runner")
        quit(1)
        return
    var actor: AnimatedSprite2D = player.get_node("AnimatedSprite2D")
    if not is_equal_approx(actor.scale.x, 0.182) or not actor.position.is_equal_approx(Vector2(0.0,-70.798)):
        push_error("RUN FAIL: feet/size incorrect")
        failed = true
    var material := actor.material as ShaderMaterial
    if material == null or material.shader == null:
        push_error("RUN FAIL: character environmental grade missing")
        failed = true
    elif float(material.get_shader_parameter("contrast")) < 1.0 or float(material.get_shader_parameter("saturation")) < 1.0:
        push_error("RUN FAIL: protagonist too faded into the painted background")
        failed = true
    if (actor.material as ShaderMaterial).shader.code.contains("walk_sample_uv"):
        push_error("RUN FAIL: obsolete fake gait still running")
        failed = true
    if not is_equal_approx(player.run_speed, 325.0):
        push_error("RUN FAIL: sprint movement too slow")
        failed = true
    var shadow := player.get_node_or_null("FootContactShadow") as Sprite2D
    if shadow == null or shadow.texture == null or shadow.z_index >= actor.z_index:
        push_error("RUN FAIL: grounding shadow missing or drawn above character")
        failed = true
    else:
        var shadow_image := shadow.texture.get_image()
        if shadow_image.get_pixel(64,24).a < 0.2 or shadow_image.get_pixel(0,0).a > 0.01:
            push_error("RUN FAIL: ground shadow softness/opacity wrong")
            failed = true
    for heading in ["right","down_right","down","down_left","left","up_left","up","up_right"]:
        for mode in ["idle","walk","run"]:
            var key: String = mode + "_" + heading
            var expected_count: int = 1 if mode == "idle" else 14
            if not actor.sprite_frames.has_animation(key) or actor.sprite_frames.get_frame_count(key) != expected_count:
                push_error("RUN FAIL: wrong loop length in " + key)
                failed = true
                continue
            if mode != "idle":
                var first: Texture2D = actor.sprite_frames.get_frame_texture(key,0)
                var last: Texture2D = actor.sprite_frames.get_frame_texture(key,13)
                if first != src.get_frame_texture("row_1",14) or last != src.get_frame_texture("row_1",27):
                    push_error("RUN FAIL: startup/stopping frames have leaked into " + key)
                    failed = true
                var expected_fps: float = 13.0 if mode == "run" else 6.0
                if not is_equal_approx(actor.sprite_frames.get_animation_speed(key), expected_fps):
                    push_error("RUN FAIL: wrong playback speed for " + key)
                    failed = true
    for removed in ["BuSari","HUD","Avatar"]:
        if world.get_node_or_null(removed) != null or player.get_node_or_null(removed) != null:
            push_error("RUN FAIL: obsolete scene node " + removed)
            failed = true
    if world.get_node_or_null("MobileControlsLayer/TouchControls") == null:
        push_error("RUN FAIL: mobile controls lost")
        failed = true
    Input.action_press("ui_right")
    for n in range(15):
        await physics_frame
    if player.animation_state != "walk" or player.facing_name != "right" or actor.flip_h:
        push_error("RUN FAIL: moving right did not play source")
        failed = true
    Input.action_release("ui_right")
    await physics_frame
    if player.animation_state != "idle":
        push_error("RUN FAIL: idle reset")
        failed = true
    Input.action_press("ui_left")
    for n in range(6):
        await physics_frame
    if player.facing_name != "left" or not actor.flip_h:
        push_error("RUN FAIL: temporary left mirror missing")
        failed = true
    Input.action_release("ui_left")
    player.mobile_direction = Vector2.RIGHT
    player.mobile_run_held = true
    for n in range(10):
        await physics_frame
    if player.animation_state != "run":
        push_error("RUN FAIL: mobile sprint failed")
        failed = true
    player.mobile_direction = Vector2.ZERO
    player.mobile_run_held = false
    Input.action_release("ui_left")
    root.remove_child(world)
    world.free()
    if failed:
        quit(1)
    else:
        print("SMOKE PASS: corrected 14-pose continuous run/walk loops, faster sprint, grounded contrasting hero")
        quit(0)
