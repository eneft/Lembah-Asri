extends SceneTree

func _initialize() -> void:
    call_deferred("_run")

func _fail(message: String) -> void:
    push_error("V21 VISUAL FAIL: " + message)
    quit(1)

func _run() -> void:
    var image: Image = Image.load_from_file("res://assets/art/concept_farm.png")
    if image == null or image.is_empty():
        _fail("PNG repositori tidak bisa dibaca")
        return
    var win: Window = get_root()
    win.size = Vector2i(1280, 720)
    var canvas := Control.new()
    canvas.name = "V21Canvas"
    win.add_child(canvas)
    canvas.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    var bg := ColorRect.new()
    bg.color = Color(0.04, 0.07, 0.09)
    canvas.add_child(bg)
    bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    var terrain := TextureRect.new()
    terrain.name = "Terrain"
    terrain.texture = ImageTexture.create_from_image(image)
    terrain.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
    terrain.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
    canvas.add_child(terrain)
    terrain.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    await process_frame
    await process_frame
    await RenderingServer.frame_post_draw
    var screenshot: Image = win.get_texture().get_image()
    if screenshot == null or screenshot.is_empty():
        _fail("Screenshot GPU kosong")
        return
    var colors := 0
    for y in range(110, 670, 19):
        for x in range(320, 960, 19):
            var col: Color = screenshot.get_pixel(x, y)
            if maxf(col.r, maxf(col.g, col.b)) - minf(col.r, minf(col.g, col.b)) > 0.075:
                colors += 1
    if colors < 120:
        _fail("Terrain tak terlihat: warna=%d" % colors)
        return
    var output := ProjectSettings.globalize_path("res://v21-ci-render.png")
    if screenshot.save_png(output) != OK:
        _fail("Screenshot gagal disimpan")
        return
    print("V21 GODOT RENDER PASS: texture=", image.get_size(), " colored_samples=", colors, " screenshot=v21-ci-render.png")
    quit(0)
