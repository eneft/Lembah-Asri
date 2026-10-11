extends SceneTree
## GPU-based regression: verify two river phases differ at game-scale while
## alpha borders remain fixed. Tests actual rendering, not only shader strings.
const RIVER = preload("res://assets/art/separated/river_water.webp")
const BASE_MATERIAL = preload("res://assets/materials/river_surface_motion.tres")

func _initialize() -> void:
    call_deferred("_check")

func _snapshot(view: SubViewport) -> Image:
    await process_frame
    await RenderingServer.frame_post_draw
    return view.get_texture().get_image()

func _check() -> void:
    var view := SubViewport.new()
    view.size = Vector2i(320, 320)
    view.transparent_bg = true
    view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    root.add_child(view)

    var sprite := Sprite2D.new()
    sprite.texture = RIVER
    sprite.position = Vector2(160, 160)
    sprite.scale = Vector2(0.45, 0.45)
    sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
    var material := BASE_MATERIAL.duplicate() as ShaderMaterial
    sprite.material = material
    view.add_child(sprite)

    material.set_shader_parameter("phase_offset", 0.0)
    var before: Image = await _snapshot(view)
    material.set_shader_parameter("phase_offset", 4.2)
    var after: Image = await _snapshot(view)

    var altered := 0
    var alpha_changes := 0
    var water_samples := 0
    for y in range(before.get_height()):
        for x in range(before.get_width()):
            var a := before.get_pixel(x, y)
            var b := after.get_pixel(x, y)
            if a.a > 0.12 and b.a > 0.12:
                water_samples += 1
                if absf(a.r-b.r)+absf(a.g-b.g)+absf(a.b-b.b) > 0.12:
                    altered += 1
            if absf(a.a-b.a) > 0.02:
                alpha_changes += 1

    print("WATER RENDER QA: %d changed of %d water pixels; %d changed alpha" %
        [altered, water_samples, alpha_changes])
    if water_samples < 1000 or altered < 100 or alpha_changes > 25:
        push_error("WATER RENDER FAIL: water motion invisible or alpha boundaries unstable")
        quit(1)
        return

    view.queue_free()
    print("WATER RENDER PASS: visible real GPU ripple and cascade, static alpha edge")
    quit(0)
