extends SceneTree
## Standalone preview smoke; the project's default 2D scene is not changed.

func _initialize() -> void:
    call_deferred("_check")

func _check() -> void:
    var packed: PackedScene = load("res://scenes/village3d_preview.tscn")
    if packed == null:
        push_error("VILLAGE3D FAIL: cannot load preview")
        quit(1)
        return
    var scene: Node3D = packed.instantiate() as Node3D
    root.add_child(scene)
    await process_frame
    var paths := [
        "RumahMasaKecil/RumahTerbengkalai",
        "KebunKeluarga", "PermukimanDesa", "LapanganWarga",
        "HutanBambu", "Bukit", "Sungai", "Pantai",
        "PelabuhanNelayan", "Player", "Camera3D"
    ]
    for path in paths:
        if scene.get_node_or_null(path) == null:
            push_error("VILLAGE3D FAIL: missing " + path)
            quit(1)
            return
    var preview_camera: Camera3D = scene.get_node("Camera3D") as Camera3D
    if preview_camera.projection != Camera3D.PROJECTION_ORTHOGONAL:
        push_error("VILLAGE3D FAIL: camera not orthogonal")
        quit(1)
        return
    if scene.get_node("LapanganWarga").get_child_count() < 2:
        push_error("VILLAGE3D FAIL: village commons missing")
        quit(1)
        return
    print("VILLAGE3D PREVIEW PASS: scene, regions, camera and player")
    quit(0)
