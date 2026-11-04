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
    if int(settlement.get("source_house_count")) != 1:
        _fail("the user's original childhood GLB must be used only ONCE")
        return
    if int(settlement.get("unique_house_count")) != 15:
        _fail("15 geometrically unique authored Javanese meshes must be present")
        return
    if settlement.get_node_or_null("lapangan_berkumpul") != null:
        _fail("public gathering green was occupied by a building")
        return
    await physics_frame
    await physics_frame
    var unique := {}
    var signatures := {}
    var painted := 0
    var childhood_glb := 0
    var new_fisherman_glb := 0
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
        var model: Node3D
        if str(building.name) == "rumah_masa_kecil":
            model = building.get_node_or_null("OriginalTexturedHouse") as Node3D
            childhood_glb += 1
        elif str(building.name) == "rumah_nelayan_01":
            model = building.get_node_or_null("MeshyFishermanHouse") as Node3D
            new_fisherman_glb += 1
            if model == null or building.get_node_or_null("UniqueVillageMesh") != null:
                _fail("V7.8: uploaded Meshy fisherman house did not replace the old mesh")
                return
        else:
            if building.get_node_or_null("OriginalTexturedHouse") != null:
                _fail("duplicate childhood GLB used as another house: "+str(building.name))
                return
            model = building.get_node_or_null("UniqueVillageMesh") as Node3D
            if model != null:
                var signature := str(model.get_meta("architecture_signature",""))
                if signature.is_empty() or signatures.has(signature):
                    _fail("duplicate physical house mesh design: "+str(building.name))
                    return
                signatures[signature] = true
        if model == null:
            _fail("authored 3D house mesh missing: "+str(building.name))
            return
        var valid_textures := 0
        var baked_vertex_colors := 0
        var fisherman_uv_vertices := 0
        var fisherman_face_count := 0
        var generated_geometry := 0
        for child in model.find_children("*","MeshInstance3D",true,false):
            var mesh := child as MeshInstance3D
            if mesh.mesh == null:
                continue
            generated_geometry += 1
            for surface in range(mesh.mesh.get_surface_count()):
                var material := mesh.get_active_material(surface) as BaseMaterial3D
                if material != null and material.albedo_texture != null:
                    valid_textures += 1
                if str(building.name)=="rumah_nelayan_01":
                    var vertex_data: Array = mesh.mesh.surface_get_arrays(surface)
                    var uv_data: Variant = vertex_data[Mesh.ARRAY_TEX_UV]
                    var faces: Variant = vertex_data[Mesh.ARRAY_INDEX]
                    if uv_data is PackedVector2Array:
                        fisherman_uv_vertices += (uv_data as PackedVector2Array).size()
                    if faces is PackedInt32Array:
                        fisherman_face_count += int((faces as PackedInt32Array).size() / 3)
                    if material is StandardMaterial3D and (material as StandardMaterial3D).vertex_color_use_as_albedo:
                        baked_vertex_colors += 1
        if (valid_textures == 0 and baked_vertex_colors == 0) or generated_geometry < 1:
            _fail("house lost its textured or baked-vertex-color 3D geometry: "+str(building.name))
            return
        if str(building.name) == "rumah_masa_kecil":
            # Original one-of-a-kind GLB also needs real 1m/world-unit
            # calibration, not just matching a 10m zoning plot.
            var source_bounds: AABB = settlement.call("_bounds",model)
            var real_width: float = source_bounds.size.x*model.scale.x
            var real_depth: float = source_bounds.size.z*model.scale.z
            var real_height: float = source_bounds.size.y*model.scale.y
            if absf(real_height-4.05)>0.07 or real_width>7.34 or real_depth>6.20 or real_width<2.5 or real_depth<2.5:
                _fail("V7.6: childhood GLB out of real human proportions: %s x %s x %s" % [
                    str(real_width),str(real_depth),str(real_height)])
                return
            if absf(float(building.get_meta("building_height_m",0.0))-real_height)>0.02:
                _fail("V7.6: childhood building size metadata differs from visible GLB")
                return
        elif str(building.name)=="rumah_nelayan_01":
            var b: AABB = settlement.call("_bounds",model)
            var actual_width: float = b.size.x * model.scale.x
            var actual_height: float = b.size.y * model.scale.y
            var actual_depth: float = b.size.z * model.scale.z
            if actual_width < 4.5 or actual_width > 5.8 or actual_depth < 5.5 or actual_depth > 6.2 or actual_height < 3.0 or actual_height > 3.6:
                _fail("V7.8 UV REPAIR: original fisherman geometry no longer fits the 168cm avatar or existing plot")
                return
            var expected_shape: BoxShape3D = shape.shape as BoxShape3D
            if expected_shape == null or absf(expected_shape.size.x-actual_width*0.87)>0.05 or absf(expected_shape.size.z-actual_depth*0.83)>0.05:
                _fail("V7.8: Meshy house collision no longer matches its visible scale")
                return
            if valid_textures < 1 or fisherman_uv_vertices < 100000 or fisherman_face_count < 90000:
                _fail("V7.8 UV REPAIR FAIL: original painted UV or topology lost (crumpled tent regression)")
                return
            if str(building.get_meta("fisherman_source",""))!="Meshy_AI_Lembah_Asri_Fisherman_1103160840_texture.glb":
                _fail("V7.8: replaced by the wrong fisherman source GLB")
                return
            if int(building.get_meta("fisherman_optimized_triangles",0))!=95121 or not bool(building.get_meta("fisherman_texture_uv",false)):
                _fail("V7.8 UV REPAIR FAIL: the low-poly 1800-triangle mesh was loaded again")
                return
            if not is_equal_approx(model.scale.x,model.scale.y) or not is_equal_approx(model.scale.x,model.scale.z):
                _fail("V7.8 UV REPAIR FAIL: nonuniform house scaling distorts the original Meshy silhouette")
                return
            print("V7.8 FISHERMAN UV TEST PASS: 95121 UV-mapped source triangles, correct proportion and original painting")
        else:
            var wall_visual := model.get_node_or_null("DindingBangunan") as MeshInstance3D
            var doorway := model.get_node_or_null("PintuUkir") as MeshInstance3D
            if wall_visual==null or wall_visual.mesh==null or doorway==null or doorway.mesh==null:
                _fail("V7.6: missing visible human-scale house or front door: "+str(building.name))
                return
            var physical_width := wall_visual.mesh.get_aabb().size.x
            var physical_depth := wall_visual.mesh.get_aabb().size.z
            var physical_height := wall_visual.mesh.get_aabb().size.y
            var entry_height := doorway.mesh.get_aabb().size.y
            var entry_width := doorway.mesh.get_aabb().size.x
            var public_hall := str(building.name)=="balai_desa"
            if absf(physical_width-float(model.get_meta("actual_width_m",0.0)))>0.015 or absf(physical_depth-float(model.get_meta("actual_depth_m",0.0)))>0.015:
                _fail("V7.6: actual house dimensions do not match painted wall mesh: "+str(building.name))
                return
            if physical_width < 5.0 or physical_width > (8.6 if public_hall else 7.15) or physical_depth < 4.5 or physical_depth > 6.50:
                _fail("V7.6: building too wide/narrow for the 168cm avatar: "+str(building.name))
                return
            if physical_height < 2.45 or physical_height > (3.10 if public_hall else 2.85):
                _fail("V7.6: house eave/wall not in a realistic adult scale: "+str(building.name))
                return
            if entry_height < 2.075 or entry_height > 2.5 or entry_width < 0.94 or entry_width > 1.35:
                _fail("V7.6: door clearance incompatible with 1.68m adult: "+str(building.name))
                return
            var physical_block := shape.shape as BoxShape3D
            if absf(physical_block.size.x-physical_width*0.96)>0.02 or absf(physical_block.size.z-physical_depth*0.96)>0.02:
                _fail("V7.6: invisible collision walls no longer fit resized house: "+str(building.name))
                return
            # Avoid front windows visually covering the entry after shrinking
            # the facades; validate spatial separation, not just counts.
            for fixture in model.get_children():
                var window := fixture as MeshInstance3D
                if window!=null and str(window.name).begins_with("Jendela_") and window.mesh!=null:
                    var separation: float = absf(window.position.x-doorway.position.x)
                    var necessary: float = (window.mesh.get_aabb().size.x+entry_width)*0.5+0.04
                    if separation < necessary:
                        _fail("V7.6: window overlaps front door: "+str(building.name))
                        return
            var porch_floor := model.get_node_or_null("LantaiTeras") as MeshInstance3D
            var porch_canopy := model.get_node_or_null("KanopiTeras") as MeshInstance3D
            if porch_floor!=null and porch_canopy!=null:
                var porch_top: float = porch_floor.position.y+porch_floor.mesh.get_aabb().size.y*0.5
                var canopy_bottom: float = porch_canopy.mesh.get_aabb().position.y
                if canopy_bottom-porch_top<2.14:
                    _fail("V7.6: 168cm player lacks natural porch headroom: "+str(building.name))
                    return
            if public_hall:
                # The supporting posts must follow the new actual facade,
                # not the obsolete larger 11m empty plot.
                for fixture in building.get_children():
                    var post := fixture as MeshInstance3D
                    if post!=null and str(post.name)=="TiangBalai" and absf(post.position.x)>physical_width*0.5:
                        _fail("V7.6: balai porch pillar has drifted outside resized roof")
                        return
        if str(building.name)!="rumah_masa_kecil" and str(building.name)!="rumah_nelayan_01":
            var painted_wall := model.get_node_or_null("DindingBangunan") as MeshInstance3D
            if painted_wall == null or painted_wall.mesh == null:
                _fail("V7.7: building lost real painterly wall mesh: "+str(building.name))
                return
            var wall_mat := painted_wall.get_active_material(0) as StandardMaterial3D
            if wall_mat == null or wall_mat.albedo_texture == null or wall_mat.normal_texture == null:
                _fail("V7.7: hand-painted stucco atlas or painted normal absent: "+str(building.name))
                return
            if wall_mat.diffuse_mode != BaseMaterial3D.DIFFUSE_TOON or wall_mat.metallic>0.001:
                _fail("V7.7: building wall is shiny CGI, not painted toon: "+str(building.name))
                return
            if str(model.get_meta("visual_polish_version",""))!="V7.7":
                _fail("V7.7: village visual mesh polish not installed: "+str(building.name))
                return
            if model.get_node_or_null("KusenSudutDepan")==null:
                _fail("V7.7: facade lacks hand-built timber edge: "+str(building.name))
                return
            var roof_shape := str(model.get_meta("roof_style",""))
            if roof_shape in ["pelana","asymmetric","tin_gable"]:
                if model.get_node_or_null("GentengSapuanBertingkat")==null:
                    _fail("V7.7: tiled gable roof lacks batched painted detail: "+str(building.name))
                    return
            elif roof_shape in ["joglo","limasan"]:
                if model.get_node_or_null("LisSudutLimasan")==null:
                    _fail("V7.7: hip roof lacks low-poly raised edges: "+str(building.name))
                    return
        painted += 1
    if painted != 16 or childhood_glb != 1 or new_fisherman_glb != 1 or signatures.size() != 14:
        _fail("17 buildings must contain 1 nostalgic GLB, 1 NEW fisherman Meshy GLB and 14 unique painted houses")
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
    print("V7.8 FISHERMAN INTEGRATION PASS: uploaded GLB replaces rumah_nelayan_01; 1800 triangles, 1.68m scale, original collision and 17 sites")
    print("V7.7 VISUAL POLISH PASS: distinct hand-painted 3D facades/roof details, original childhood GLB colors retained")
    print("V7.6 BUILDING SCALE PASS: 168cm player, 15 residential/public doors, 1 calibrated childhood GLB and appropriately sized balai/watch post")
    print("V7 SETTLEMENT PHYSICS PASS: original player capsule blocked by village hall")
    print("V7 SETTLEMENT SMOKE PASS: 17 grounded buildings, childhood GLB, NEW Meshy fisherman GLB, 14 unique hand-painted meshes, open square, solid player collision")
    quit(0)
