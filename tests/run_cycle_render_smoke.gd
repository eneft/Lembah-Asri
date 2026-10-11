extends SceneTree
func _initialize() -> void:
    call_deferred("_check")
func _changed(a: Image, b: Image) -> int:
    var changed := 0
    for y in range(a.get_height()):
        for x in range(a.get_width()):
            var c := a.get_pixel(x,y)
            var d := b.get_pixel(x,y)
            if absf(c.r-d.r)+absf(c.g-d.g)+absf(c.b-d.b)+absf(c.a-d.a) > 0.12:
                changed += 1
    return changed
func _check() -> void:
    var frames: SpriteFrames = load("res://assets/characters/run_cycle/Run.tres") as SpriteFrames
    var view := SubViewport.new()
    view.size = Vector2i(256,256)
    view.transparent_bg = true
    view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    root.add_child(view)
    var sprite := Sprite2D.new()
    sprite.position = Vector2(128,128)
    sprite.scale = Vector2.ONE * (0.182 * 0.8)
    view.add_child(sprite)
    # Test frames from the ACTUAL LOOP rather than only the original 31-frame
    # source. The seamless transition is also checked below.
    var old: Image = null
    for idx in [14,16,20,24,27]:
        sprite.texture = frames.get_frame_texture("row_1",idx)
        await process_frame
        await RenderingServer.frame_post_draw
        var now: Image = view.get_texture().get_image()
        if old != null:
            var dif := _changed(old,now)
            print("RUN FRAME %d: %d changed pixels" % [idx,dif])
            if dif < 90:
                push_error("RUN FRAME FAIL: cycle appears static")
                quit(1)
                return
        old = now
    sprite.texture = frames.get_frame_texture("row_1",14)
    await process_frame
    await RenderingServer.frame_post_draw
    var restarted: Image = view.get_texture().get_image()
    var seam_diff: int = _changed(old,restarted)
    # Last frame 27 and first frame 14 must be similar, not a snap
    # back to the original anticipation/stop pose.
    print("RUN LOOP SEAM: %d changed pixels" % seam_diff)
    if seam_diff > 1800:
        push_error("RUN FRAME FAIL: wrap-around is too discontinuous")
        quit(1)
        return
    view.queue_free()
    print("RUN FRAME PASS: original runner loops seamlessly and visibly at game scale")
    quit(0)
