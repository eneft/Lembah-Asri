extends SceneTree
## V7 real-runtime 3D settlement audit; validates every foundation, reused
## textured GLB, 17 cheap static wall colliders and real avatar movement.
func _initialize() -> void:
    call_deferred("_run")

func _fail(reason: String) -> void:
    push_error("V7 SETTLEMENT FAIL: " + reason)
    quit(1)

func _run() -> void:
    var level := load("res://scenes/terrain_base_test.tscn").instantiate() as Node3D
    root.add_child(level)
    for frame in range(430):
        await physics_frame
        if bool(level.get("is_ready")):
            break
    if not bool(level.get("is_ready")):
        _fail("level initialization timeout")
        return
    var world := level.get_node_or_null("World") as Node3D
    var settlement := world.get_node_or_null("VillageBuildingsV7") as Node3D
    if settlement == null or not bool(settlement.get("finished")):
        _fail("building layer missing")
        return
    if settlement.get_child_count() != 17 or int(settlement.get("building_count")) != 17:
        _fail("expected exactly 17 independent 3D structures")
        return
    if int(settlement.get("source_house_count")) != 16:
        _fail("16 authored-lot Meshy GLB instances must be present")
        return
    if settlement.get_node_or_null("lapangan_berkumpul") != null:
        _fail("public gathering green was occupied by a building")
        return
    await physics_frame
    await physics_frame
    var unique := {}
    var painted := 0
    for node in settlement.get_children():
        var building := node as Node3D
        if building == null or unique.has(str(building.name)):
            _fail("duplicate building IDs")
            return
        unique[str(building.name)] = true
        var wall := building.get_node_or_null("BuildingCollision") as StaticBody3D
        if wall == null or (wall.collision_layer & 1) == 0:
            _fail("missing player collision: "+str(building.name))
            return
        var shape := wall.get_node_or_null("PhysicalWalls") as CollisionShape3D
        if shape == null or not (shape.shape is BoxShape3D):
            _fail("missing cheap physical wall shape: "+str(building.name))
            return
        var center := building.global_position
        var ground_ray := PhysicsRayQueryParameters3D.create(
            center+Vector3.UP*20.0,center-Vector3.UP*20.0)
        ground_ray.collision_mask = 1 << 7
        var ground := world.get_world_3d().direct_space_state.intersect_ray(ground_ray)
        if ground.is_empty() or absf(ground.position.y-center.y)>0.17:
            _fail("building foundation not grounded: "+str(building.name))
            return
        var wall_ray := PhysicsRayQueryParameters3D.create(
            center+Vector3.UP*8.0,center-Vector3.UP*0.01)
        wall_ray.collision_mask = 1
        var hit := world.get_world_3d().direct_space_state.intersect_ray(wall_ray)
        if hit.is_empty() or hit.collider != wall:
            _fail("wall collider not detected: "+str(building.name))
            return
        if str(building.name) == "pos_ronda_balai":
            if building.get_node_or_null("OriginalTexturedHouse") != null:
                _fail("watch post should be a separate small structure")
                return
            continue
        var model := building.get_node_or_null("OriginalTexturedHouse") as Node3D
        if model == null:
            _fail("original Meshy GLB missing: "+str(building.name))
            return
        var valid_textures := 0
        for child in model.find_children("*","MeshInstance3D",true,false):
            var mesh := child as MeshInstance3D
            if mesh.mesh == null:
                continue
            for surface in range(mesh.mesh.get_surface_count()):
                var material := mesh.get_active_material(surface) as BaseMaterial3D
                if material != null and material.albedo_texture != null:
                    valid_textures += 1
        if valid_textures == 0:
            _fail("house lost painterly albedo/UV: "+str(building.name))
            return
        painted += 1
    if painted != 16:
        _fail("some source buildings are not textured")
        return
    var player := world.get_node_or_null("Player3D") as CharacterBody3D
    var hall := settlement.get_node_or_null("balai_desa") as Node3D
    if player == null or hall == null:
        _fail("avatar or village hall missing")
        return
    player.set_physics_process(false)
    var x0 := hall.global_position.x - 6.5
    var z0 := hall.global_position.z
    var bank_query := PhysicsRayQueryParameters3D.create(
        Vector3(x0,120.0,z0),Vector3(x0,-40.0,z0))
    bank_query.collision_mask = 1 << 7
    var bank := world.get_world_3d().direct_space_state.intersect_ray(bank_query)
    if bank.is_empty():
        _fail("no terrain at balai collision approach")
        return
    player.global_position = bank.position + Vector3(0.0,0.13,0.0)
    player.velocity = Vector3.ZERO
    player.reset_camera_follow_interpolation()
    for frame in range(130):
        player.velocity = Vector3(2.8,-1.3,0.0)
        player.move_and_slide()
        await physics_frame
    if player.global_position.x > hall.global_position.x - 3.4:
        _fail("original player capsule passed through balai wall")
        return
    print("V7 SETTLEMENT PHYSICS PASS: original player capsule blocked by village hall")
    print("V7 SETTLEMENT SMOKE PASS: 17 grounded buildings, 16 shared textured GLB, open square, solid player collision")
    quit(0)
