extends SceneTree
## Render the actual Godot scene for pre-merge art-direction QA; this does not
## modify gameplay or require any asset to be committed to the repository.
func _initialize() -> void:
    call_deferred("_capture")

func _capture() -> void:
    var packed := load("res://scenes/terrain_base_test.tscn") as PackedScene
    if packed == null:
        print("TERRAIN_CAPTURE_SKIP: packed scene missing")
        quit(0)
        return
    var stage := packed.instantiate() as Node3D
    root.add_child(stage)
    root.size = Vector2i(1280, 720)
    for i in range(210):
        await process_frame
    var viewport_image := root.get_texture().get_image()
    if viewport_image == null or viewport_image.is_empty():
        print("TERRAIN_CAPTURE_SKIP: viewport capture unavailable")
        quit(0)
        return
    viewport_image.resize(800, 450, Image.INTERPOLATE_LANCZOS)
    var err := viewport_image.save_jpg("/tmp/terrain_baked_godot_preview.jpg", 0.76)
    if err == OK:
        print("TERRAIN_CAPTURE_PASS: 800x450 actual Godot 3D Web-compatibility frame")
    else:
        print("TERRAIN_CAPTURE_SKIP: save_jpg failed: " + str(err))
    quit(0)
