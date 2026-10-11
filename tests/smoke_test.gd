extends SceneTree
## Acceptance test: 8-direction player, adjusted scale, empty homestead and mobile controls.
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
    var expected: Array[String] = ["BackgroundBase","HouseMain","SmallCoop","GardenTomato","GardenEggplant","GardenGreens","ForegroundFoliage","Player","HouseWallsCollision","CoopCollision"]
    for name in expected:
        if world.get_node_or_null(name) == null:
            push_error("STAGE1 FAIL: missing " + name)
            failures = true
    for removed in ["BuSari", "HUD/Open3DCharacterLab", "HUD/DesktopHintBackground", "HUD"]:
        if world.get_node_or_null(removed) != null:
            push_error("STAGE1 FAIL: obsolete scene element still present: " + removed)
            failures = true
    if ResourceLoader.exists("res://scenes/character_lab_3d.tscn"):
        push_error("STAGE1 FAIL: retired 3D preview scene is still installed")
        failures = true
    # Mobile UI node is present even on a desktop runner; visibility is
    # device-dependent and can be forced for a deterministic input test.
    var mobile_layer = world.get_node_or_null("MobileControlsLayer")
    var touch = world.get_node_or_null("MobileControlsLayer/TouchControls")
    if mobile_layer == null or touch == null:
        push_error("MOBILE FAIL: missing native touchscreen overlay")
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
            # Environmental grading must be assigned to the actual visible hero,
            # regardless of direction or movement state; original RGBA is retained.
            var grade: ShaderMaterial = actor.material as ShaderMaterial
            if grade == null or grade.shader == null or grade.shader.resource_path != "res://shaders/hero_environment_grade.gdshader":
                push_error("GRADE FAIL: missing 2D hero lighting/color shader")
                failures = true
            else:
                if absf(float(grade.get_shader_parameter("saturation")) - 0.87) > 0.001:
                    push_error("GRADE FAIL: saturation does not match the warm background preset")
                    failures = true
                if absf(float(grade.get_shader_parameter("contrast")) - 0.88) > 0.001:
                    push_error("GRADE FAIL: character outline contrast not softened")
                    failures = true
                if float(grade.get_shader_parameter("sun_warmth")) <= 0.0:
                    push_error("GRADE FAIL: warm sunlight is disabled")
                    failures = true
                if not grade.shader.code.contains("original.a"):
                    push_error("GRADE FAIL: shader does not preserve original texture alpha")
                    failures = true
                if not grade.shader.code.contains("walk_sample_uv") or not grade.shader.code.contains("clearance"):
                    push_error("WALK FAIL: shader lacks independent swing/lift deformation")
                    failures = true
                if float(grade.get_shader_parameter("gait_strength")) > 0.001:
                    push_error("WALK FAIL: idle pose must not deform")
                    failures = true
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
            var expected_scale: float = 0.105 if player.using_base_form else 0.36
            if not is_equal_approx(actor.scale.x, expected_scale) or not is_equal_approx(actor.scale.y, expected_scale):
                push_error("ANIMATION FAIL: playable scale changed")
                failures = true
            if player.using_base_form:
                if not actor.position.is_equal_approx(Vector2(0.0, -80.745)):
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
        if player.using_base_form:
            if player.gait_frame_index == 0 or actor == null or float((actor.material as ShaderMaterial).get_shader_parameter("gait_strength")) < 0.99:
                push_error("WALK FAIL: 12-phase motion does not advance while walking right")
                failures = true
            if player.GAIT_POSES != 12:
                push_error("WALK FAIL: wrong number of procedural gait phases")
                failures = true
            for heading in {
                "right": Vector2.RIGHT,
                "down_right": Vector2(1, 1),
                "down": Vector2.DOWN,
                "down_left": Vector2(-1, 1),
                "left": Vector2.LEFT,
                "up_left": Vector2(-1, -1),
                "up": Vector2.UP,
                "up_right": Vector2(1, -1)
            }:
                if player._nearest_eight_direction({
                    "right": Vector2.RIGHT, "down_right": Vector2(1,1),
                    "down": Vector2.DOWN, "down_left": Vector2(-1,1),
                    "left": Vector2.LEFT, "up_left": Vector2(-1,-1),
                    "up": Vector2.UP, "up_right": Vector2(1,-1)
                }[heading]) != heading:
                    push_error("WALK FAIL: octant mapping wrong for " + heading)
                    failures = true
                player.facing_name = heading
                player._update_gait_shader()
                var profile: float = (actor.material as ShaderMaterial).get_shader_parameter("gait_profile")
                if profile < 0.0 or profile > 1.0:
                    push_error("WALK FAIL: invalid deformation profile for " + heading)
                    failures = true
        Input.action_release("ui_right")
        await physics_frame
        if player.animation_state != "idle":
            push_error("ANIMATION FAIL: idle transition")
            failures = true
        if player.using_base_form:
            if player.gait_frame_index != 0 or absf(float((actor.material as ShaderMaterial).get_shader_parameter("gait_strength"))) > 0.001:
                push_error("WALK FAIL: stopping leaves gait deformation active")
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
        # Simulated real multi-touch: joystick, run and action are independent.
        if touch != null:
            touch.set_test_visible(true)
            var center: Vector2 = touch.get_joystick_center()
            var first := InputEventScreenTouch.new()
            first.index = 10
            first.position = center
            first.pressed = true
            touch._input(first)
            var drag := InputEventScreenDrag.new()
            drag.index = 10
            drag.position = center + Vector2(52.0, 0.0)
            touch._input(drag)
            if touch.move_vector.x < 0.70 or absf(touch.move_vector.y) > 0.01:
                push_error("MOBILE FAIL: joystick drag cannot generate analog right motion")
                failures = true
            Input.action_release("ui_left")
            await physics_frame
            if player.mobile_direction.x < 0.70 or player.facing_name != "right":
                push_error("MOBILE FAIL: joystick not connected to the player")
                failures = true
            var run_touch := InputEventScreenTouch.new()
            run_touch.index = 11
            run_touch.pressed = true
            run_touch.position = touch.get_run_center()
            touch._input(run_touch)
            await physics_frame
            if not player.mobile_run_held or player.animation_state != "run":
                push_error("MOBILE FAIL: second finger cannot hold RUN")
                failures = true
            if player.using_base_form and float((actor.material as ShaderMaterial).get_shader_parameter("gait_strength")) < 1.2:
                push_error("WALK FAIL: running did not increase gait amplitude")
                failures = true
            # Stage 1 is intentionally empty: no active action target/button.
            if touch.action_enabled:
                push_error("MOBILE FAIL: unused AKSI control should be disabled")
                failures = true
            run_touch.pressed = false
            touch._input(run_touch)
            first.pressed = false
            touch._input(first)
            await physics_frame
            if player.mobile_direction.length_squared() > 0.001 or player.mobile_run_held:
                push_error("MOBILE FAIL: touch release leaves ghost input")
                failures = true
            if actor != null and actor.flip_h:
                push_error("MOBILE FAIL: base artwork unexpectedly flipped")
                failures = true
            touch.set_test_visible(false)
            player.global_position = Vector2(700,617)
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
        if world.BACKGROUND_IS_COMPLETE_ILLUSTRATION:
            if tomato_blocker != null:
                push_error("STAGE1 FAIL: obsolete crop collider blocks the new empty yard")
                failures = true
            for legacy_name in ["HouseMain","SmallCoop","GardenTomato","GardenEggplant","GardenGreens","ForegroundFoliage"]:
                var legacy_sprite := world.get_node_or_null(legacy_name) as Sprite2D
                if legacy_sprite == null or legacy_sprite.visible:
                    push_error("STAGE1 FAIL: legacy art duplicates full base: " + legacy_name)
                    failures = true
        elif tomato_blocker == null or not (tomato_blocker is StaticBody2D):
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
        print("SMOKE PASS: visible continuous 8-way stride, 12 phases, RGBA grade, touch movement")
        quit(0)
