extends SceneTree
var failed := false
func _initialize() -> void:
    call_deferred("_check")
func _check() -> void:
    # Keep original 26/21-pose assets for existing WALK and fallback.
    # Approved RUN now uses its separate normalized 8/10-pose atlas.
    var native_side: SpriteFrames = load("res://assets/characters/run_uploaded/right/lembah_asri_run_49_frames_7x7_lossless.tres") as SpriteFrames
    var native_rear: SpriteFrames = load("res://assets/characters/run_uploaded/back_diagonal/back_left_right.tres") as SpriteFrames
    if native_side == null or native_rear == null:
        push_error("RUN FAIL: current uploaded 8-direction source resources missing")
        quit(1)
        return
    var side_total: int = 0
    var side_names := Array(native_side.get_animation_names())
    side_names.sort()
    for row_name in side_names:
        side_total += native_side.get_frame_count(row_name)
    if side_total != 26:
        push_error("RUN FAIL: original lateral 26 frames were changed")
        quit(1)
        return
    var rear_total: int = 0
    for row_name in ["row_1", "row_2", "row_3"]:
        if not native_rear.has_animation(row_name):
            push_error("RUN FAIL: original 21-frame rear diagonal row missing")
            quit(1)
            return
        rear_total += native_rear.get_frame_count(row_name)
    if rear_total != 21:
        push_error("RUN FAIL: rear diagonal is not the edited original 21-frame asset")
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
    if player == null or not player.using_imported_run or not player.using_run8_uploaded:
        push_error("RUN FAIL: main scene is not using the latest uploaded RUN8+IDLE protagonist")
        quit(1)
        return
    var actor: AnimatedSprite2D = player.get_node("AnimatedSprite2D")
    if not player.using_proportional_run:
        push_error("RUN FAIL: current protagonist did not select the installed proportional RUN atlas")
        failed = true
    # The native 1672x941 stage should show an ~112px-high character.
    # When idle the front-right still is calibrated to its own PNG bounds.
    var idle_visible: float = actor.scale.y * player.IDLE_VISIBLE_HEIGHT["down_right"]
    if absf(idle_visible - player.CHARACTER_HEIGHT_WORLD) > 0.1 or not actor.position.is_equal_approx(Vector2.ZERO):
        push_error("RUN FAIL: main scene 8-way protagonist size/foot anchor is wrong")
        failed = true
    if not is_equal_approx(actor.scale.x, actor.scale.y) or actor.centered:
        push_error("RUN FAIL: main player sprite is stretched or centered incorrectly")
        failed = true
    var material := actor.material as ShaderMaterial
    if material == null or material.shader == null or not material.shader.code.contains("shirt_mask") or not material.shader.code.contains("skin_mask"):
        push_error("RUN FAIL: source-sensitive 8-way character palette missing")
        failed = true
    elif not is_equal_approx(float(material.get_shader_parameter("grading_enabled")), 0.0):
        push_error("RUN FAIL: native user-uploaded IDLE is recolored")
        failed = true
    if material != null and material.shader.code.contains("walk_sample_uv"):
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
            push_error("LAYER FAIL: distant scenery softness lost")
            failed = true
        else:
            # Regression: past full-screen blur made terrain and trails mushy.
            # The shader must blend with an explicit art-directed distance
            # mask and return the original source below Y=0.48.
            if not mat.shader.code.contains("far_mask") or not mat.shader.code.contains("mix(sharp, soft, far_mask)"):
                push_error("LAYER FAIL: global blur returned; playable ground must stay crisp")
                failed = true
            if not mat.shader.code.contains("mix(1.0, saturation, far_mask)") or not mat.shader.code.contains("mix(1.0, contrast, far_mask)"):
                push_error("LAYER FAIL: near-ground colour grading not neutral")
                failed = true
            if float(mat.get_shader_parameter("distant_end")) > 0.50:
                push_error("LAYER FAIL: DOF extends into the gameplay area")
                failed = true
            if float(mat.get_shader_parameter("softness")) > 0.90:
                push_error("LAYER FAIL: distant blur exceeds approved subtle setting")
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
        if wm == null or wm.shader == null or not wm.shader.code.contains("original.a") or not wm.shader.code.contains("waterfall_zone") or float(wm.get_shader_parameter("flow_speed")) <= 0.0 or float(wm.get_shader_parameter("ripple_strength")) < 0.20 or float(wm.get_shader_parameter("foam_strength")) < 0.20:
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
    var sampled_side_textures: Array[Texture2D] = []
    for row_name in side_names:
        for idx in range(native_side.get_frame_count(row_name)):
            sampled_side_textures.append(native_side.get_frame_texture(row_name, idx))
    var sampled_rear_textures: Array[Texture2D] = []
    for row_name in ["row_1", "row_2", "row_3"]:
        for idx in range(native_rear.get_frame_count(row_name)):
            sampled_rear_textures.append(native_rear.get_frame_texture(row_name, idx))
    for heading in ["right","down_right","down","down_left","left","up_left","up","up_right"]:
        for mode in ["idle","walk","run"]:
            var key: String = mode + "_" + heading
            var expected_count: int = 1 if mode == "idle" else ((8 if heading in ["right","left","up"] else 10) if mode == "run" else (26 if heading in ["left", "right"] else (21 if heading in ["up_left", "up_right"] else 12)))
            if not actor.sprite_frames.has_animation(key) or actor.sprite_frames.get_frame_count(key) != expected_count:
                push_error("RUN FAIL: main player missing 8-way frames: " + key)
                failed = true
                continue
            var fps: float = actor.sprite_frames.get_animation_speed(key)
            var expected_fps: float = 1.0 if mode == "idle" else (10.0 if mode == "run" else float(expected_count) / 1.5)
            if not is_equal_approx(fps, expected_fps):
                push_error("RUN FAIL: unexpected native 8-way " + mode + " cadence: " + heading)
                failed = true
            if mode == "walk" and heading in ["right", "left"]:
                for idx in range(26):
                    if actor.sprite_frames.get_frame_texture(key, idx) != sampled_side_textures[idx]:
                        push_error("RUN FAIL: main scene omitted original side frame " + str(idx))
                        failed = true
                        break
            if mode == "walk" and heading in ["up_right", "up_left"]:
                for idx in range(21):
                    if actor.sprite_frames.get_frame_texture(key, idx) != sampled_rear_textures[idx]:
                        push_error("RUN FAIL: main scene omitted edited rear frame " + str(idx))
                        failed = true
                        break
    if not is_equal_approx(player.CHARACTER_HEIGHT_WORLD, 112.0):
        push_error("RUN FAIL: new scene scale changed from 112px")
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
        print("SMOKE PASS: main 8-way proportional RUN (74 frames) plus native WALK/IDLE, 112px character, original terrain/Y-sort/river/bridge/HUD/mobile preserved")
        quit(0)
