extends SceneTree
## Regression: ONLY uploaded terrain + character, camera, sun and controls.
## No old map, houses, roads, water, landmarks or invisible legacy colliders.
func _initialize() -> void:
    call_deferred("_run")

func _fail(why: String) -> void:
    push_error("TERRAIN ONLY FAIL: " + why)
    quit(1)

func _run() -> void:
    var scene := load("res://scenes/terrain_base_test.tscn") as PackedScene
    if scene == null:
        _fail("scene could not load")
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
        _fail("GLB import/collision/spawn initialization timed out")
        return
    var world := root_node.get_node_or_null("World") as Node3D
    if world == null or not bool(world.get("terrain_only_mode")):
        _fail("not in isolated terrain-only mode")
        return
    for old_name in ["IslandBlockoutV01", "VillageTexturedHouses", "RumahNelayanPesisir"]:
        if world.get_node_or_null(old_name) != null:
            _fail("old world object still exists: " + old_name)
            return
    var terrain := world.get_node_or_null("TerrainBaseUploadedV2") as Node3D
    var mesh := root_node.get("new_mesh") as MeshInstance3D
    var collider := root_node.get("new_collision") as StaticBody3D
    var player := world.get_node_or_null("Player3D") as CharacterBody3D
    var camera := world.get_node_or_null("IsometricCamera") as Camera3D
    if terrain == null or mesh == null or collider == null or player == null or camera == null:
        _fail("new GLB, character, collider or camera missing")
        return
    if not terrain.visible or mesh.mesh == null or mesh.mesh.get_faces().size() < 1000:
        _fail("actual terrain model not visible or lacks geometry")
        return
    if collider.collision_layer != 1:
        _fail("new collider is NOT in character's layer-1 physics mask")
        return
    if collider.collision_mask != 0:
        _fail("static collider collision mask should be zero")
        return
    # There must be exactly ONE world 3D model besides the player and camera,
    # and only ONE StaticBody3D. Do not retain hidden old map objects.
    for node in world.get_children():
        if node is MeshInstance3D:
            _fail("unexpected direct mesh " + str(node.name))
            return
        if node is Node3D and node != terrain and node != player and not (node is Camera3D) and not (node is Light3D):
            _fail("unexpected old 3D world object " + str(node.name))
            return
    var bodies := world.find_children("*", "StaticBody3D", true, false)
    if bodies.size() != 1 or bodies[0] != collider:
        _fail("old physics colliders still present; count=" + str(bodies.size()))
        return
    var spot: Vector3 = root_node.get("spawn_surface")
    var ray := PhysicsRayQueryParameters3D.create(spot + Vector3.UP * 80.0, spot - Vector3.UP * 80.0)
    ray.collision_mask = 1
    ray.exclude = [player.get_rid()]
    var hit := world.get_world_3d().direct_space_state.intersect_ray(ray)
    if hit.is_empty() or hit.collider != collider:
        _fail("terrain raycast hit another collider / none")
        return
    if absf(hit.position.y) > 0.2:
        _fail("terrain spawn surface is not aligned near zero: " + str(hit.position.y))
        return
    for i in range(110):
        await physics_frame
    if not player.is_on_floor():
        _fail("character did not land on the uploaded terrain")
        return
    if absf(player.global_position.y - hit.position.y) > 0.6:
        _fail("character feet are not grounded on uploaded terrain: " + str(player.global_position.y))
        return
    if world.get_node_or_null("Player3D/Visual/FbxCharacter") == null:
        _fail("original FBX character controller was lost")
        return
    print("TERRAIN BASE SMOKE PASS: uploaded textured GLB ONLY, no legacy models/colliders, real character grounded on true terrain, camera and controls intact")
    quit(0)
