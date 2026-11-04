extends SceneTree
## V7.9: assert five actual independent PackedScene region instances.
## Verify that moving between west and coast unloads distant GPU visuals
## without shifting the 17 houses, removing vegetation or disabling physics.

func _initialize() -> void:
    call_deferred("_run")

func _fail(why: String) -> void:
    push_error("AREA V7.9 FAIL: "+why)
    quit(1)

func _run() -> void:
    var level := load("res://scenes/terrain_base_test.tscn").instantiate() as Node3D
    root.add_child(level)
    for frame in range(490):
        await physics_frame
        if bool(level.get("is_ready")):
            break
    if not bool(level.get("is_ready")):
        _fail("terrain did not boot")
        return
    var world := level.get_node("World") as Node3D
    var streamer := world.get_node_or_null("AreaStreamingV79") as Node3D
    if streamer == null or not bool(streamer.get("finished")):
        _fail("area controller did not initialize")
        return
    if streamer.get_child_count() != 5 or int(streamer.get("building_count")) != 17:
        _fail("zone scene and house counts changed")
        return
    var source_parts: int = int(streamer.get("original_foliage_instances"))
    if source_parts < 100 or int(streamer.get("area_foliage_instances")) != source_parts:
        _fail("foliage batching lost instances")
        return
    var scene_bodies := 0
    var foliage_parts := 0
    for zone in streamer.get_children():
        var homes := zone.get_node_or_null("Houses") as Node3D
        var plants := zone.get_node_or_null("Plants") as Node3D
        var foliage := zone.get_node_or_null("Foliage") as Node3D
        if homes == null or plants == null or foliage == null:
            _fail("area scene missing its own children")
            return
        scene_bodies += homes.get_child_count()
        for node in foliage.get_children():
            var batch := node as MultiMeshInstance3D
            if batch == null or batch.multimesh == null:
                _fail("regional batch no longer rendered by MultiMesh")
                return
            foliage_parts += batch.multimesh.instance_count
    if scene_bodies != 17 or foliage_parts != source_parts:
        _fail("spatially partitioned source count changed")
        return

    var coast := streamer.get_node("Area_akses_pesisir") as Node3D
    var west := streamer.get_node("Area_pekarangan_barat") as Node3D
    var home := streamer.get_node("Area_pekarangan_barat/Houses/rumah_masa_kecil") as Node3D
    if home == null or coast == null or west == null:
        _fail("nostalgic home or coastline zone missing")
        return
    var original_home_position := home.global_position
    streamer.call("refresh_visibility",Vector3(83.0,0.0,78.0),true)
    if not coast.visible or west.visible:
        _fail("coast travel did not hide distant western meshes")
        return
    streamer.call("refresh_visibility",Vector3(-80.0,0.0,-19.0),true)
    if not west.visible or coast.visible:
        _fail("west travel did not hide distant coast meshes")
        return
    if home.global_position.distance_to(original_home_position) > 0.0001:
        _fail("streaming shifted original house placement")
        return

    # Render culling must never disable colliders: scripts and NPC routes may
    # still need physical structures when traversing the border between areas.
    streamer.call("refresh_visibility",Vector3(83.0,0.0,78.0),true)
    await physics_frame
    await physics_frame
    var body := home.get_node_or_null("BuildingCollision") as StaticBody3D
    var ray := PhysicsRayQueryParameters3D.create(
        home.global_position+Vector3.UP*20.0,
        home.global_position+Vector3.DOWN*0.3)
    ray.collision_mask = 1
    var hit := world.get_world_3d().direct_space_state.intersect_ray(ray)
    if body == null or hit.is_empty() or hit.collider != body:
        _fail("distant visually culled house lost solid collision")
        return
    print("AREA V7.9 SCENE STREAM PASS: 5 independent area scenes, 17 houses, ",
        source_parts," 3D foliage instances, coast/west swaps, seamless solid collision")
    quit(0)
