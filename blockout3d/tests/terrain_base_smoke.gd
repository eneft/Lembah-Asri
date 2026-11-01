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
    var water := world.get_node_or_null("TerrainV2Water") as Node3D
    var ocean: MeshInstance3D = null
    var river: MeshInstance3D = null
    if water != null:
        ocean = water.get_node_or_null("OceanSurface") as MeshInstance3D
        river = water.get_node_or_null("RiverSurface") as MeshInstance3D
    if terrain == null or collider == null or mesh == null or player == null or camera == null:
        push_error("TERRAIN BASE FAIL: missing new terrain, collider, character or camera")
        quit(1)
        return
    # Blueprint V2 must actually contain a large surrounding ocean and
    # an independent stream, not just a label claiming an island.
    if water == null or ocean == null or river == null:
        push_error("TERRAIN BASE FAIL: Terrain V2 ocean / river missing")
        quit(1)
        return
    if ocean.mesh == null or river.mesh == null or river.mesh.get_surface_count() < 1:
        push_error("TERRAIN BASE FAIL: ocean or river has no visible mesh")
        quit(1)
        return
    if not (ocean.mesh is PlaneMesh) or absf((ocean.mesh as PlaneMesh).size.x - 360.0) > 0.1:
        push_error("TERRAIN BASE FAIL: ocean is not 360m island-surrounding plane")
        quit(1)
        return
    if not is_equal_approx(ocean.global_position.y, 0.45):
        push_error("TERRAIN BASE FAIL: ocean level differs from blueprint 0.45m")
        quit(1)
        return
    if not (ocean.material_override is ShaderMaterial):
        push_error("TERRAIN BASE FAIL: light turquoise-to-blue ocean material missing")
        quit(1)
        return
    if water.find_children("*", "CollisionObject3D", true, false).size() != 0:
        push_error("TERRAIN BASE FAIL: water should have no additional collision")
        quit(1)
        return
    if mesh.get_aabb().size.y * 140.0 < 19.0:
        push_error("TERRAIN BASE FAIL: northern landmark mountain too low")
        quit(1)
        return
    if mesh.get_aabb().size.y * 140.0 > 30.0:
        push_error("TERRAIN BASE FAIL: unexpected excessive V2 hills")
        quit(1)
        return
    print("TERRAIN V2 OCEAN PASS: 360m tropical sea, river surface, no overlapping physics, mountain/flatland range=%.2fm" % [
        mesh.get_aabb().size.y * 140.0])
    # Regression: terrain-only route must use a close, true 3/4 perspective,
    # never the old orthographic isometric camera.
    if camera.projection != Camera3D.PROJECTION_PERSPECTIVE:
        push_error("TERRAIN BASE FAIL: test camera is not perspective")
        quit(1)
        return
    if camera.fov < 36.0 or camera.fov > 60.0:
        push_error("TERRAIN BASE FAIL: wrong close camera FOV: " + str(camera.fov))
        quit(1)
        return
    var visual := player.get_node_or_null("Visual") as Node3D
    var capsule_node := player.get_node_or_null("PlayerCollision") as CollisionShape3D
    if visual == null or not is_equal_approx(visual.scale.x, 0.74):
        push_error("TERRAIN BASE FAIL: character not reduced to 74 percent")
        quit(1)
        return
    if capsule_node == null or not (capsule_node.shape is CapsuleShape3D):
        push_error("TERRAIN BASE FAIL: smaller character missing capsule")
        quit(1)
        return
    var capsule := capsule_node.shape as CapsuleShape3D
    if absf(capsule.height - 1.31) > 0.01 or absf(capsule.radius - 0.245) > 0.01:
        push_error("TERRAIN BASE FAIL: capsule not scaled with character")
        quit(1)
        return
    # ONE baked 4K painterly diffuse atlas; no 4K normal, no shader/micro
    # textures. This actually reduces texture samples and GPU allocations.
    var terrain_material := mesh.material_override as StandardMaterial3D
    if terrain_material == null:
        push_error("TERRAIN BASE FAIL: lightweight baked StandardMaterial3D missing")
        quit(1)
        return
    var baked_color := terrain_material.albedo_texture
    if baked_color == null or baked_color.get_width() != 4096 or baked_color.get_height() != 4096:
        push_error("TERRAIN BASE FAIL: painted 4K terrain atlas not loaded")
        quit(1)
        return
    if terrain_material.normal_enabled or terrain_material.normal_texture != null:
        push_error("TERRAIN BASE FAIL: unused 4K normal still bound to Web terrain")
        quit(1)
        return
    if terrain_material.texture_filter != BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC:
        push_error("TERRAIN BASE FAIL: baked albedo filtering missing")
        quit(1)
        return
    if mesh.mesh == null or mesh.mesh.get_faces().size() < 1000:
        push_error("TERRAIN BASE FAIL: imported geometry absent")
        quit(1)
        return
    if not terrain.visible or (collider.collision_layer & 128) == 0:
        push_error("TERRAIN BASE FAIL: mesh hidden or terrain query collision not active")
        quit(1)
        return
    # A ray hit alone is not a valid character collision test. Both
    # CollisionObject3D masks MUST overlap before running gravity checks.
    if (collider.collision_layer & player.collision_mask) == 0:
        push_error("TERRAIN BASE FAIL: player mask does not overlap terrain collision layer")
        quit(1)
        return
    if (player.collision_layer & 1) == 0:
        push_error("TERRAIN BASE FAIL: player collision layer unexpectedly changed")
        quit(1)
        return
    var forbidden := ["IslandBlockoutV01", "VillageTexturedHouses", "RumahNelayanPesisir"]
    for item in forbidden:
        if world.get_node_or_null(item) != null:
            push_error("TERRAIN BASE FAIL: old object loaded: " + item)
            quit(1)
            return
    for n in world.get_children():
        if n == terrain or n == water or n == player or n == camera or n is DirectionalLight3D or n is WorldEnvironment or n is CanvasLayer:
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
    # Test ACTUAL gameplay physics for 2 seconds. The previous smoke checked
    # only raycasts and mistakenly passed while CharacterBody3D fell through.
    var initial_height := player.global_position.y
    for frame in range(120):
        await physics_frame
    if not player.is_on_floor():
        push_error("TERRAIN BASE FAIL: CharacterBody3D falls through terrain after gravity")
        quit(1)
        return
    if absf(player.global_position.y - hit.position.y) > 0.55:
        push_error("TERRAIN BASE FAIL: player did not settle on terrain: player_y=%.3f floor_y=%.3f" % [player.global_position.y,hit.position.y])
        quit(1)
        return
    if absf(player.global_position.y - initial_height) > 0.65:
        push_error("TERRAIN BASE FAIL: player began high in the sky or dropped unexpectedly")
        quit(1)
        return
    print("TERRAIN BASE PHYSICS PASS: character grounded after 120 gravity frames; player_layer=%d, player_mask=%d, ground_layer=%d, bottom_gap=%.3f m" % [
        player.collision_layer, player.collision_mask, collider.collision_layer, player.global_position.y-hit.position.y])
    # Check that the camera really followed the smaller player into the
    # new 3/4 framing (not merely a projection-flag change).
    var focal := player.global_position + Vector3(0.0, 0.85, 0.0)
    var cam_distance := camera.global_position.distance_to(focal)
    if cam_distance < 5.0 or cam_distance > 15.0:
        push_error("TERRAIN BASE FAIL: 3/4 camera not close to the player: " + str(cam_distance))
        quit(1)
        return
    var original_fov := camera.fov
    world.call("_toggle_camera_mode")
    await process_frame
    if camera.projection != Camera3D.PROJECTION_PERSPECTIVE or is_equal_approx(camera.fov, original_fov):
        push_error("TERRAIN BASE FAIL: C button changed perspective or did not toggle 3/4 camera preset")
        quit(1)
        return
    world.call("_toggle_camera_mode")
    await process_frame
    print("TERRAIN BASE HD CAMERA PASS: baked_albedo=%d, perspective FOV=%.1f, camera_distance=%.2f, character=74%%, capsule_height=%.2f" % [
        baked_color.get_width(), camera.fov, cam_distance, capsule.height])
    print("TERRAIN BAKED RETEXTURE PASS: one artistically repainted 4K diffuse atlas, no micro shader or large tangent normal, grounded FBX preserved")
    print("TERRAIN V2 PLAYABLE TEST PASS: wide plains, north landmark mountain, island coast/ocean, river, original 3/4 camera and FBX")
    print("TERRAIN BASE SMOKE PASS: ONLY uploaded terrain + real collider + original controllable FBX + camera and lighting; no old objects")
    quit(0)
