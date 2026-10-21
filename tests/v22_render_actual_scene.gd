extends SceneTree

func _initialize() -> void:
    call_deferred("_test")

func fail(message: String) -> void:
    push_error("V22 DIRECT SCENE FAIL: " + message)
    quit(1)

func _test() -> void:
    var win := get_root()
    win.size = Vector2i(1280, 720)
    var packed := load("res://scenes/v22_visual_direct_resource.tscn") as PackedScene
    if packed == null:
        fail("V22 scene not loadable")
        return
    var scene := packed.instantiate()
    win.add_child(scene)
    await process_frame
    await process_frame
    await RenderingServer.frame_post_draw
    var terrain := scene.get_node_or_null("Terrain") as TextureRect
    if terrain == null or terrain.texture == null:
        fail("Terrain TextureRect or imported resource missing")
        return
    if terrain.texture.get_size() != Vector2(1672, 941):
        fail("Wrong source image size: " + str(terrain.texture.get_size()))
        return
    if not terrain.is_visible_in_tree() or terrain.size.x < 1000.0 or terrain.size.y < 600.0:
        fail("Terrain hidden or rect improperly sized: " + str(terrain.size))
        return
    var screenshot: Image = win.get_texture().get_image()
    if screenshot == null or screenshot.is_empty() or screenshot.get_width() < 640:
        fail("Rendered viewport empty")
        return
    var colored := 0
    for y in range(110, 670, 19):
        for x in range(320, 960, 19):
            var p := screenshot.get_pixel(x,y)
            if maxf(p.r,maxf(p.g,p.b)) - minf(p.r,minf(p.g,p.b)) > 0.075:
                colored += 1
    if colored < 140:
        fail("Screenshot looks blank: colored_pixels=" + str(colored))
        return
    if screenshot.save_png(ProjectSettings.globalize_path("res://v22-scene-screenshot.png")) != OK:
        fail("Cannot save screenshot")
        return
    print("V22 GODOT DIRECT SCENE PASS: actual_tscn=true visible_color_samples=",colored," screenshot=v22-scene-screenshot.png")
    quit(0)
