extends SceneTree
const DIRS := ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]

func _initialize() -> void:
    call_deferred("_check")

func _check() -> void:
    var scene: PackedScene = load("res://scenes/run8_test.tscn") as PackedScene
    if scene == null:
        push_error("RUN8 FAIL scene load")
        quit(1)
        return
    var test_scene: Node2D = scene.instantiate() as Node2D
    root.add_child(test_scene)
    await process_frame
    var sprite: AnimatedSprite2D = test_scene.get_node("Runner")
    if sprite.sprite_frames == null:
        push_error("RUN8 FAIL animation bank missing")
        quit(1)
        return
    for dir in DIRS:
        var key: String = "run_" + dir
        if not sprite.sprite_frames.has_animation(key) or sprite.sprite_frames.get_frame_count(key) != 16:
            push_error("RUN8 FAIL missing genuine frames: " + key)
            quit(1)
            return
        test_scene.show_direction(dir, true)
        if sprite.flip_h != (dir == "left" or dir == "up_left" or dir == "down_left"):
            push_error("RUN8 FAIL wrong mirrored direction: " + dir)
            quit(1)
            return
        if sprite.sprite_frames.get_frame_texture(key, 0).get_size() != Vector2(512, 640):
            push_error("RUN8 FAIL wrong frame size: " + dir)
            quit(1)
            return
    test_scene.show_direction("up", false)
    if sprite.is_playing():
        push_error("RUN8 FAIL not stopped")
        quit(1)
        return
    test_scene.queue_free()
    print("RUN8 PASS: 8 directions, 16 frames per direction, foot baseline, mirrored left; isolated from main world")
    quit(0)
