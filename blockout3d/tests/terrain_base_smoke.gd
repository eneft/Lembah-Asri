extends SceneTree
## CI: the terrain-test world must never create the previous island or houses.
func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var scene := load("res://scenes/terrain_base_test.tscn") as PackedScene
    if scene == null:
        push_error("TERRAIN BASE FAIL: scene failed to load")
        quit(1)
        return
    var test := scene.instantiate() as Node3D
    root.add_child(test)
    var ready := false
    for i in range(360):
        await physics_frame
        if bool(test.get("is_ready")):
            ready = true
            break
    if not ready:
        push_error("TERRAIN BASE FAIL: terrain init timeout")
        quit(1)
        return
    var world := test.get_node_or_null("World") as Node3D
    var terrain := world.get_node_or_null("TerrainBaseUploadedV2") as Node3D
    var collider: StaticBody3D = test.get("new_collision")
    var mesh: MeshInstance3D = test.get("new_mesh")
    var player := world.get_node_or_null("Player3D") as CharacterBody3D
    var camera := world.get_node_or_null("IsometricCamera") as Camera3D
    if terrain == null or collider == null or mesh == null or player == null or camera == null:
        push_error("TERRAIN BASE FAIL: missing new terrain, collider, character or camera")
        quit(1)
        return
    if mesh.mesh == null or mesh.mesh.get_faces().size() < 1000:
        push_error("TERRAIN BASE FAIL: imported geometry absent")
        quit(1)
        return
    if not terrain.visible or collider.collision_layer != 128:
        push_error("TERRAIN BASE FAIL: mesh hidden or collision not active")
        quit(1)
        return
    var forbidden := ["IslandBlockoutV01", "VillageTexturedHouses", "RumahNelayanPesisir"]
    for item in forbidden:
        if world.get_node_or_null(item) != null:
            push_error("TERRAIN BASE FAIL: old object loaded: " + item)
            quit(1)
            return
    for n in world.get_children():
        if n == terrain or n == player or n == camera or n is DirectionalLight3D or n is WorldEnvironment or n is CanvasLayer:
            continue
        push_error("TERRAIN BASE FAIL: legacy object remains: " + str(n.name))
        quit(1)
        return
    var query := PhysicsRayQueryParameters3D.create(
        Vector3(player.global_position.x, 120.0, player.global_position.z), Vector3(player.global_position.x,-60.0,player.global_position.z))
    query.collision_mask = 128
    var hit := world.get_world_3d().direct_space_state.intersect_ray(query)
    if hit.is_empty():
        push_error("TERRAIN BASE FAIL: new terrain missing spawn collision")
        quit(1)
        return
    if absf(player.global_position.y - hit.position.y) > 3.5:
        push_error("TERRAIN BASE FAIL: player floating too far above new terrain")
        quit(1)
        return
    var fbx := player.get_node_or_null("Visual/FbxCharacter")
    if fbx == null:
        push_error("TERRAIN BASE FAIL: original FBX character missing")
        quit(1)
        return
    print("TERRAIN BASE SMOKE PASS: ONLY uploaded terrain + real collider + original controllable FBX + camera and lighting; no old objects")
    quit(0)
