extends SceneTree
## Validate uploaded terrain mesh import, collision and A/B visibility.
func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var scene := load("res://scenes/terrain_base_test.tscn") as PackedScene
    if scene == null:
        push_error("TERRAIN BASE FAIL: scene failed to load")
        quit(1)
        return
    var root_node := scene.instantiate() as Node3D
    root.add_child(root_node)
    var ready := false
    for i in range(180):
        await physics_frame
        if bool(root_node.get("is_ready")):
            ready = true
            break
    if not ready:
        push_error("TERRAIN BASE FAIL: terrain overlay initialization timeout")
        quit(1)
        return
    var world := root_node.get_node_or_null("World") as Node3D
    var island := world.get_node_or_null("IslandBlockoutV01") as Node3D
    var terrain := world.get_node_or_null("TerrainBaseUploadedV2") as Node3D
    var old_terrain: MeshInstance3D = root_node.get("old_mesh")
    var collider: StaticBody3D = root_node.get("new_collision")
    if world == null or island == null or terrain == null or old_terrain == null or collider == null:
        push_error("TERRAIN BASE FAIL: missing island, new terrain, or collision")
        quit(1)
        return
    if old_terrain.visible or not terrain.visible or collider.collision_layer == 0:
        push_error("TERRAIN BASE FAIL: new/old terrain visibility or collision invalid")
        quit(1)
        return
    var mesh := root_node.get("new_mesh") as MeshInstance3D
    if mesh == null or mesh.mesh == null:
        push_error("TERRAIN BASE FAIL: imported terrain has no valid mesh")
        quit(1)
        return
    if mesh.mesh.get_faces().size() < 1000:
        push_error("TERRAIN BASE FAIL: new terrain mesh missing triangles")
        quit(1)
        return
    var p := world.get_node_or_null("Player3D") as CharacterBody3D
    if p == null:
        push_error("TERRAIN BASE FAIL: original character missing")
        quit(1)
        return
    var query := PhysicsRayQueryParameters3D.create(Vector3(6.0, 70.0, 15.0), Vector3(6.0,-15.0,15.0))
    query.collision_mask = 1 << 7
    var hit := world.get_world_3d().direct_space_state.intersect_ray(query)
    if hit.is_empty():
        push_error("TERRAIN BASE FAIL: new terrain ray collision missed plaza")
        quit(1)
        return
    if absf(hit.position.y - 5.5) > 0.7:
        push_error("TERRAIN BASE FAIL: terrain height poorly aligned at plaza: " + str(hit.position.y))
        quit(1)
        return
    var toggle := InputEventKey.new()
    toggle.keycode = KEY_T
    toggle.pressed = true
    # Headless CI has no focused input window. Exercise the input handler.
    root_node.call("_unhandled_input", toggle)
    await process_frame
    if bool(root_node.get("terrain_active")) or not old_terrain.visible or terrain.visible:
        push_error("TERRAIN BASE FAIL: comparison T toggle failed")
        quit(1)
        return
    print("TERRAIN BASE SMOKE PASS: uploaded textured mesh, aligned terrain collider, original island preserved, comparison toggle, protagonist intact")
    quit(0)
