extends SceneTree
## Verify actual shader pixels at the current in-game scale, not just script states.
## If Godot renders the exact same frame while gait uniforms change, fail CI.
const MASTER_DIR := "res://assets/characters/player_base_8dir/"
const GRADE := preload("res://assets/materials/hero_environment_grade.tres")
const ORDER := ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]

func _initialize() -> void:
    call_deferred("_run")

func _capture(view: SubViewport) -> Image:
    await process_frame
    await RenderingServer.frame_post_draw
    return view.get_texture().get_image()

func _changed_pixels(a: Image, b: Image) -> int:
    if a.get_size() != b.get_size():
        return -1
    var pixels := 0
    for y in range(a.get_height()):
        for x in range(a.get_width()):
            var before := a.get_pixel(x,y)
            var after := b.get_pixel(x,y)
            if absf(before.r - after.r) + absf(before.g - after.g) + absf(before.b - after.b) + absf(before.a - after.a) > 0.15:
                pixels += 1
    return pixels

func _run() -> void:
    var viewport := SubViewport.new()
    viewport.size = Vector2i(256, 256)
    viewport.transparent_bg = true
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    root.add_child(viewport)

    var actor := Sprite2D.new()
    actor.name = "WalkVisualQA"
    actor.position = Vector2(128, 128)
    # Game zoom is 0.80. Use equivalent final pixel scale.
    actor.scale = Vector2.ONE * (0.105 * 0.80)
    actor.centered = true
    actor.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
    viewport.add_child(actor)

    var material := GRADE.duplicate() as ShaderMaterial
    actor.material = material
    var checks := 0
    for direction in ORDER:
        actor.texture = load(MASTER_DIR + direction + ".png") as Texture2D
        if actor.texture == null:
            push_error("GAIT RENDER FAIL: missing source PNG for " + direction)
            quit(1)
            return
        material.set_shader_parameter("gait_strength", 0.0)
        material.set_shader_parameter("gait_phase", 0.0)
        var idle: Image = await _capture(viewport)
        var profile: float = 1.0 if direction == "left" or direction == "right" else (0.55 if direction.contains("_") else 0.0)
        material.set_shader_parameter("gait_profile", profile)
        material.set_shader_parameter("gait_sign", -1.0 if direction in ["left", "down_left", "up_left", "up"] else 1.0)
        material.set_shader_parameter("gait_strength", 1.0)
        material.set_shader_parameter("gait_phase", PI / 2.0)
        var contact_a: Image = await _capture(viewport)
        material.set_shader_parameter("gait_phase", PI * 1.5)
        var contact_b: Image = await _capture(viewport)
        var changed_a := _changed_pixels(idle, contact_a)
        var changed_b := _changed_pixels(contact_a, contact_b)
        print("GAIT RENDER %s: idle-to-step=%d pixels; alternating-feet=%d pixels" % [direction, changed_a, changed_b])
        # At 0.084 final sprite scale, anything below this is effectively invisible.
        if changed_a < 100 or changed_b < 150:
            push_error("GAIT RENDER FAIL: barely visible or static for %s (%d / %d changed pixels)" % [direction, changed_a, changed_b])
            quit(1)
            return
        checks += 1
    viewport.queue_free()
    await process_frame
    print("GAIT RENDER PASS: real viewport image differences in all %d directions" % checks)
    quit(0)
