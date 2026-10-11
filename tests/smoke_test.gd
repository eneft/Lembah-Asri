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
    if not is_equal_approx(actor.scale.x, 0.222) or not actor.position.is_equal_approx(Vector2(0.0,-86.358)):
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
    # The base MUST be a different clean image, not the old PNG with
    # duplicated structures. Every extracted sprite has transparency.
    if not world.y_sort_enabled or player.z_index != 0:
        push_error("LAYER FAIL: parent or player Y-sort disabled")
        failed = true
    var art_names := ["HouseCutout","CoopCutout","BananaCutout",
        "BridgeRailCutout","FrontFenceCutout"]
    var previous_count := 0
    for name in art_names:
        var anchor := world.get_node_or_null(name) as Node2D
        if anchor == null or anchor.z_index != 0:
            push_error("LAYER FAIL: missing Y-sort pivot for " + name)
            failed = true
            continue
        var visual := anchor.get_node_or_null("Visual") as Sprite2D
        if visual == null or visual.texture == null:
            push_error("LAYER FAIL: no independent transparent art for " + name)
            failed = true
            continue
        var layer_image := visual.texture.get_image()
        if layer_image.get_size().x < 32 or layer_image.get_size().y < 32 or not layer_image.detect_alpha():
            push_error("LAYER FAIL: missing transparency on " + name)
            failed = true
        if not is_equal_approx(visual.global_position.y, visual.position.y + anchor.global_position.y):
            push_error("LAYER FAIL: cutout art has incorrect global pivot")
            failed = true
        previous_count += 1
    if previous_count != 5:
        push_error("LAYER FAIL: not all cutouts survived instantiation")
        failed = true
    var bg_node := world.get_node_or_null("BackgroundBase") as Sprite2D
    if bg_node == null or bg_node.texture == null or bg_node.z_index != -20 or bg_node.texture.get_size() != Vector2(1672,941):
        push_error("LAYER FAIL: missing clean-plate terrain at original size")
        failed = true
    else:
        var mat := bg_node.material as ShaderMaterial
        if mat == null or mat.shader == null or not mat.shader.code.contains("TEXTURE_PIXEL_SIZE") or float(mat.get_shader_parameter("softness")) <= 0.0:
            push_error("LAYER FAIL: landscape softness lost")
            failed = true
    for duplicate_name in ["HouseMain","SmallCoop","GardenTomato","ForegroundFoliage"]:
        if world.get_node_or_null(duplicate_name) != null:
            push_error("LAYER FAIL: obsolete overpaint still rendered: " + duplicate_name)
            failed = true
    var river := world.get_node_or_null("RiverWaterfallSurface") as Sprite2D
    if river == null or river.texture == null or river.z_index != -19:
        push_error("WATER FAIL: transparent water cutout missing")
        failed = true
    else:
        var water_image := river.texture.get_image()
        if not water_image.detect_alpha() or water_image.get_size() != Vector2i(614,653):
            push_error("WATER FAIL: source alpha extraction incorrect")
            failed = true
        var wm := river.material as ShaderMaterial
        if wm == null or wm.shader == null or not wm.shader.code.contains("original.a") or float(wm.get_shader_parameter("flow_speed")) <= 0.0:
            push_error("WATER FAIL: real water surface shader absent")
            failed = true
    if not player.is_walkable_foot(Vector2(1430,470)):
        push_error("BRIDGE FAIL: bridge walk polygon cannot traverse deck")
        failed = true
    if player.is_walkable_foot(Vector2(1450,700)):
        push_error("BRIDGE FAIL: river incorrectly walkable")
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
                if first != src.get_frame_texture("row_1",15) or last != src.get_frame_texture("row_1",28):
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
    # New UI must be a real, interactive Godot overlay, not painted into map.
    var hud = world.get_node_or_null("GameplayHUDLayer/GameplayHUD")
    var background = world.get_node_or_null("BackgroundBase")
    if hud == null or background == null or background.material == null:
        push_error("HUD FAIL: dynamic UI / background grade not installed")
        failed = true
    else:
        if hud.player != player or hud.coin_count != 0:
            push_error("HUD FAIL: scene binding or economy state invalid")
            failed = true
        hud._activate(5)
        if hud.open_panel != "Inventori":
            push_error("HUD FAIL: inventory cannot be opened")
            failed = true
        hud._toggle_modal("Inventori")
        hud._activate(6)
        if hud.open_panel != "Peta":
            push_error("HUD FAIL: map cannot be opened")
            failed = true
        hud._toggle_modal("Peta")
        hud._activate(7)
        if hud.open_panel != "Menu":
            push_error("HUD FAIL: menu cannot be opened")
            failed = true
        hud._toggle_modal("Menu")
        if not player.is_physics_processing():
            push_error("HUD FAIL: closing menu did not restore character input")
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
        print("SMOKE PASS: transparent clean-plate cutouts, true Y-sort, masked animated water, traversable bridge, HUD/run/mobile")
        quit(0)
