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
    # V6.5: sample the ACTUAL exported triangle mesh collision at the most
    # demanding building pads. A flat Python heightfield alone is insufficient
    # if grid sampling or coastal taper introduces uneven foundation points.
    var level_pads := [
        {"name":"rumah_barat_02","center":Vector2(-72.428571,-9.285714),
         "foot":Vector2(9.0,7.0),"angle":-9.0},
        {"name":"rumah_desa_03","center":Vector2(83.571429,-31.571429),
         "foot":Vector2(9.0,7.0),"angle":5.0},
        {"name":"rumah_masa_kecil","center":Vector2(-74.0,-56.0),
         "foot":Vector2(10.0,8.5),"angle":-8.0},
        {"name":"warung_pesisir","center":Vector2(89.142857,65.0),
         "foot":Vector2(9.0,7.0),"angle":-7.0}
    ]
    for pad in level_pads:
        var heights: Array[float] = []
        var angle: float = deg_to_rad(float(pad["angle"]))
        var ca := cos(angle)
        var sa := sin(angle)
        var center: Vector2 = pad["center"]
        var foot: Vector2 = pad["foot"]
        for local_x in [-0.30,0.0,0.30]:
            for local_z in [-0.30,0.0,0.30]:
                var ox: float = float(local_x)*foot.x
                var oz: float = float(local_z)*foot.y
                var x := center.x + ca*ox - sa*oz
                var z := center.y + sa*ox + ca*oz
                var q := PhysicsRayQueryParameters3D.create(
                    Vector3(x,120.0,z),Vector3(x,-40.0,z))
                q.collision_mask = 1 << 7
                var hit := world.get_world_3d().direct_space_state.intersect_ray(q)
                if hit.is_empty() or hit.collider != collider:
                    push_error("TERRAIN V6.5 PAD FAIL: missing physical soil at %s x=%.2f z=%.2f hit=%s" % [str(pad["name"]),x,z,str(hit)])
                    quit(1)
                    return
                heights.append(float(hit.position.y))
        var difference: float = float(heights.max()) - float(heights.min())
        if difference > 0.16:
            push_error("TERRAIN V6.5 PAD FAIL: exported mesh foundation not level at %s (%.3fm)" % [pad["name"],difference])
            quit(1)
            return
    print("TERRAIN V6.5 EXPORTED PADS PASS: physical triangle collision level at four priority construction sites")
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
    var coast_material := ocean.material_override as ShaderMaterial
    var coast_tex := coast_material.get_shader_parameter("coastal_proximity") as Texture2D
    if coast_tex == null or coast_tex.get_width() != 512 or coast_tex.get_height() != 512:
        push_error("TERRAIN V6.2 OCEAN FAIL: coastline-aware 512px distance map missing")
        quit(1)
        return
    var coast_image := coast_tex.get_image()
    if coast_image == null or (coast_image.get_pixel(256,256).r -
                             coast_image.get_pixel(0,0).r) < 0.50:
        push_error("TERRAIN V6.5 OCEAN FAIL: nearshore and deep sea do not differ")
        quit(1)
        return
    if not coast_material.shader.code.contains("texture(coastal_proximity,mask_uv)"):
        push_error("TERRAIN V6.2 OCEAN FAIL: color not sampled along real coastline")
        quit(1)
        return
    print("TERRAIN V6.2 OCEAN SHORE PASS: real island shoreline distance controls water color")
    if water.find_children("*", "CollisionObject3D", true, false).size() != 0:
        push_error("TERRAIN BASE FAIL: water should have no additional collision")
        quit(1)
        return
    # Environment C + D: prove river is animated and continuous, and that
    # crossing the river is physical (not a decorative bridge floating above).
    var river_material := river.material_override as ShaderMaterial
    if river_material == null or not river_material.shader.code.contains("TIME"):
        push_error("TERRAIN V3 WATER FAIL: river has no flowing shader")
        quit(1)
        return
    if int(water.get("stream_segment_count")) < 45:
        push_error("TERRAIN V3 WATER FAIL: river mesh has too few contiguous spans")
        quit(1)
        return
    var bank_stones := water.get_node_or_null("IllustratedRiverbankStones") as MultiMeshInstance3D
    if bank_stones == null or bank_stones.multimesh == null or bank_stones.multimesh.instance_count < 15:
        push_error("TERRAIN V3 BANK FAIL: batched illustrated river rocks missing")
        quit(1)
        return
    var infra := world.get_node_or_null("TerrainV3Infrastructure") as Node3D
    if infra == null:
        push_error("TERRAIN V3 PATHS FAIL: new village infrastructure not installed")
        quit(1)
        return
    var walkable_bridge := infra.get_node_or_null("WalkableBridgeDeck") as MeshInstance3D
    var bridge_body := infra.get("bridge_collider") as StaticBody3D
    if walkable_bridge == null or walkable_bridge.mesh == null or bridge_body == null:
        push_error("TERRAIN V3 BRIDGE FAIL: wooden bridge or physical deck missing")
        quit(1)
        return
    # Two distinct, usable footbridges must connect the expanded west/east
    # settlement routes. Count actual colliders, not decorative model props.
    var southern_body := infra.get("secondary_bridge_collider") as StaticBody3D
    if southern_body == null or southern_body == bridge_body:
        push_error("TERRAIN V5 BRIDGES FAIL: second independent physical crossing missing")
        quit(1)
        return
    var second_z := float(infra.get("secondary_bridge_z"))
    if absf(float(infra.get("bridge_z"))-second_z) < 28.0:
        push_error("TERRAIN V5 BRIDGES FAIL: two crossings too close together")
        quit(1)
        return
    var second_point := Vector3(float(infra.get("secondary_bridge_center_x")),
                                float(infra.get("secondary_deck_y")), second_z)
    var second_ray := PhysicsRayQueryParameters3D.create(
        second_point+Vector3.UP*5.0,second_point-Vector3.UP*2.0)
    second_ray.collision_mask = player.collision_mask
    await physics_frame
    await physics_frame
    var second_hit := world.get_world_3d().direct_space_state.intersect_ray(second_ray)
    if second_hit.is_empty() or second_hit.collider != southern_body:
        push_error("TERRAIN V5 BRIDGES FAIL: south footbridge is not walkable")
        quit(1)
        return
    print("TERRAIN V5 TWO BRIDGES PASS: river crossing north z=",
          infra.get("bridge_z")," and south z=",second_z,
          " both physical; roads retargeted")
    # Probe the walkable surface ACROSS each physical crossing, including
    # approach ramps. A center-only raycast misses holes and disconnected decks.
    var crossings := [
        {"name":"north","body":bridge_body,"x":float(infra.get("bridge_center_x")),
         "z":float(infra.get("bridge_z")),"span":float(infra.get("bridge_half_span")),
         "deck":float(infra.get("deck_center_y"))},
        {"name":"south","body":southern_body,"x":float(infra.get("secondary_bridge_center_x")),
         "z":float(infra.get("secondary_bridge_z")),
         "span":float(infra.get("secondary_bridge_half_span")),
         "deck":float(infra.get("secondary_deck_y"))}
    ]
    for crossing_data in crossings:
        if float(crossing_data["span"]) < 6.0:
            push_error("TERRAIN V5 BRIDGES FAIL: invalid bridge span")
            quit(1)
            return
        for fraction in [0.12,0.32,0.50,0.68,0.88]:
            var sample_x: float = float(crossing_data["x"]) + (float(fraction)*2.0-1.0)*float(crossing_data["span"])
            var sample_point := Vector3(sample_x,float(crossing_data["deck"]),float(crossing_data["z"]))
            var path_probe := PhysicsRayQueryParameters3D.create(
                sample_point + Vector3.UP*3.0, sample_point - Vector3.UP*1.0)
            path_probe.collision_mask = player.collision_mask
            var path_hit := world.get_world_3d().direct_space_state.intersect_ray(path_probe)
            if path_hit.is_empty() or float(path_hit.normal.y) < 0.70 or float(path_hit.position.y) < float(crossing_data["deck"])-0.80:
                push_error("TERRAIN V5 BRIDGES FAIL: broken bridge/ramp surface at %s t=%s" % [crossing_data["name"],str(fraction)])
                quit(1)
                return
            if fraction > 0.20 and fraction < 0.80 and path_hit.collider != crossing_data["body"]:
                push_error("TERRAIN V5 BRIDGES FAIL: central deck collision interrupted at %s t=%s" % [crossing_data["name"],str(fraction)])
                quit(1)
                return
    print("TERRAIN V5 FULL DECK PASS: two solid bridges sampled across both approaches and center deck")
    # The visual crossing must have thickness/opaque solid timber, not the
    # old one-sided transparent-looking surface sheet.
    var solid_planks := infra.get_node_or_null("SolidOpaqueTimberPlanks") as MultiMeshInstance3D
    if solid_planks == null or solid_planks.multimesh == null or solid_planks.multimesh.instance_count != 32:
        push_error("TERRAIN V3 TIMBER FAIL: 32 solid instanced planks not installed")
        quit(1)
        return
    var timber_mesh := solid_planks.multimesh.mesh as BoxMesh
    if timber_mesh == null or timber_mesh.size.y < 0.16:
        push_error("TERRAIN V3 TIMBER FAIL: bridge deck lacks real thickness")
        quit(1)
        return
    var timber_material := timber_mesh.material as StandardMaterial3D
    if timber_material == null or timber_material.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
        push_error("TERRAIN V3 TIMBER FAIL: timber is not fully opaque")
        quit(1)
        return
    if timber_material.diffuse_mode != BaseMaterial3D.DIFFUSE_TOON or timber_material.specular_mode != BaseMaterial3D.SPECULAR_DISABLED:
        push_error("TERRAIN V3 TOON FAIL: solid bridge planks are not toon-lit")
        quit(1)
        return
    if solid_planks.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_ON:
        push_error("TERRAIN V3 TIMBER FAIL: shaded timber is not casting shadows")
        quit(1)
        return
    if walkable_bridge.visible:
        push_error("TERRAIN V3 TIMBER FAIL: old paper-thin visual deck still showing")
        quit(1)
        return
    print("TERRAIN V3 SOLID TIMBER PASS: 32 opaque thick planks, cast shadows, legacy plane hidden")
    if (bridge_body.collision_layer & player.collision_mask) == 0:
        push_error("TERRAIN V3 BRIDGE FAIL: bridge collision doesn't match player mask")
        quit(1)
        return
    var crossing := Vector3(float(infra.get("bridge_center_x")),
                            float(infra.get("deck_center_y")), float(infra.get("bridge_z")))
    var bridge_ray := PhysicsRayQueryParameters3D.create(
        crossing + Vector3(0.0,5.0,0.0), crossing-Vector3(0.0,2.0,0.0))
    bridge_ray.collision_mask = player.collision_mask
    # The bridge is spawned from a deferred install callback. Wait for the
    # physics server to register its newly generated static triangle body.
    await physics_frame
    await physics_frame
    var bridge_hit := world.get_world_3d().direct_space_state.intersect_ray(bridge_ray)
    if bridge_hit.is_empty() or bridge_hit.collider != bridge_body:
        push_error("TERRAIN V3 BRIDGE FAIL: ray miss/collider mismatch at %s; actual hit=%s, actual collider=%s, deck collider=%s" % [
            str(crossing),str(bridge_hit),str(bridge_hit.get("collider", null)),str(bridge_body)])
        quit(1)
        return
    if int(infra.get("trail_detail_count")) < 6:
        push_error("TERRAIN V3 PATHS FAIL: roadside markers not placed on real walkable ground")
        quit(1)
        return
    print("TERRAIN V3 WATER+BRIDGE PASS: flowing river, %d batched rocks, one physical crossing, %d path details" % [
        bank_stones.multimesh.instance_count, int(infra.get("trail_detail_count"))])
    # Actual physical island footprint, not camera dolly or object scale.
    # V7.5 avatar is 1.68m; 1 Godot unit equals 1 meter, same as the houses.
    var island_width := mesh.get_aabb().size.x * 140.0
    var island_length := mesh.get_aabb().size.z * 140.0
    if island_width < 240.0 or island_width > 280.0 or island_length < 195.0 or island_length > 260.0:
        push_error("TERRAIN V4 SIZE FAIL: island geometry is not expanded in real world metres: %s x %s" % [str(island_width),str(island_length)])
        quit(1)
        return
    var shore_extent := river.mesh.get_aabb().size.z
    if shore_extent < 120.0:
        push_error("TERRAIN V4 RIVER FAIL: long river ribbon doesn't extend far enough over the enlarged island: %.1fm" % shore_extent)
        quit(1)
        return
    var triangles := mesh.mesh.get_faces().size() / 3
    if triangles > 95000:
        push_error("TERRAIN V4 MOBILE FAIL: unnecessarily dense grid for phone browser")
        quit(1)
        return
    print("TERRAIN V4 LARGE ISLAND PASS: physical size %.1fx%.1fm, %.0f triangles; river z span %.1fm; unchanged character controls" % [
        island_width,island_length,triangles,shore_extent])
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
    if visual == null or absf(visual.scale.x - (1.68/1.78)) > 0.0001:
        push_error("TERRAIN BASE FAIL: character must be exactly 168cm (original FBX fits 178cm)")
        quit(1)
        return
    if capsule_node == null or not (capsule_node.shape is CapsuleShape3D):
        push_error("TERRAIN BASE FAIL: smaller character missing capsule")
        quit(1)
        return
    var capsule := capsule_node.shape as CapsuleShape3D
    if absf(capsule.height - 1.68) > 0.01 or absf(capsule.radius - 0.30) > 0.01:
        push_error("TERRAIN BASE FAIL: capsule not scaled with character")
        quit(1)
        return
    # Independent measurement of the ACTUAL imported FBX geometry, including
    # all node transforms and the Visual scale. A numeric 168cm constant by
    # itself is not proof that the final rendered character is human-height.
    var fitted_fbx := player.get_node_or_null("Visual/FbxCharacter/SingleImportedMixamoModel") as Node3D
    if fitted_fbx == null:
        push_error("V7.5 REAL SCALE FAIL: original playable FBX model is absent")
        quit(1)
        return
    var visual_low := INF
    var visual_high := -INF
    var body_parts := 0
    for item in fitted_fbx.find_children("*","MeshInstance3D",true,false):
        var body_mesh := item as MeshInstance3D
        if body_mesh.mesh == null:
            continue
        var box := body_mesh.get_aabb()
        if box.size.length_squared() < 0.00001:
            continue
        body_parts += 1
        for i in range(8):
            var corner := box.position + Vector3(
                box.size.x if (i & 1) != 0 else 0.0,
                box.size.y if (i & 2) != 0 else 0.0,
                box.size.z if (i & 4) != 0 else 0.0)
            var world_point := visual.to_local(body_mesh.to_global(corner))
            visual_low = minf(visual_low,world_point.y)
            visual_high = maxf(visual_high,world_point.y)
    var measured_height := visual_high - visual_low
    if body_parts == 0 or absf(measured_height - 1.68) > 0.035:
        push_error("V7.5 REAL SCALE FAIL: rendered FBX height %.3fm, expected 1.680m" % measured_height)
        quit(1)
        return
    var village := world.get_node_or_null("VillageBuildingsV7") as Node3D
    if village == null:
        push_error("V7.5 REAL SCALE FAIL: houses missing for real-world height comparison")
        quit(1)
        return
    var measured_house_count := 0
    for building in village.get_children():
        var house_mesh := building.get_node_or_null("UniqueVillageMesh") as Node3D
        if house_mesh == null:
            continue # Childhood GLB and the independently modelled watch post
        var wall_mesh := house_mesh.get_node_or_null("DindingBangunan") as MeshInstance3D
        var door_mesh := house_mesh.get_node_or_null("PintuUkir") as MeshInstance3D
        if wall_mesh == null or door_mesh == null or wall_mesh.mesh == null or door_mesh.mesh == null:
            push_error("V7.5 REAL SCALE FAIL: missing house wall or front door")
            quit(1)
            return
        var wall_m := wall_mesh.mesh.get_aabb().size.y
        var door_m := door_mesh.mesh.get_aabb().size.y
        if wall_m < measured_height * 1.25 or door_m < 2.0 - 0.005 or door_m < measured_height + 0.25:
            push_error("V7.5 REAL SCALE FAIL: entrance too short for 168cm protagonist in %s: wall=%.2f, door=%.2f" % [building.name,wall_m,door_m])
            quit(1)
            return
        measured_house_count += 1
    if measured_house_count != 15:
        push_error("V7.5 REAL SCALE FAIL: did not measure all 15 distinct village houses")
        quit(1)
        return
    print("V7.5 REAL SCALE PASS: actual rendered hero %.3fm (168cm); all 15 house wall/door sizes fit adult human" % measured_height)
    # Keep feet on the SAME physical terrain after enlarging the model; the
    # capsule is not allowed to float above ground or sink into the mesh.
    if absf(capsule_node.position.y - capsule.height * 0.5) > 0.025:
        push_error("V7.4 CHARACTER FAIL: capsule floor clearance inconsistent")
        quit(1)
        return
    # Verify the ACTUAL camera pivot, not a script constant lookup.
    # Godot Object.get() does not expose GDScript constants as properties.
    world.call("_place_camera_immediately")
    var camera_pivot: Vector3 = world.get("_camera_focus")
    if absf((camera_pivot.y - player.global_position.y) - 1.00) > 0.03:
        push_error("V7.5 CHARACTER FAIL: camera pivot does not match the 168cm avatar")
        quit(1)
        return
    # New V2 terrain deliberately avoids the old scan UV colors; the baked
    # atlas remains inside the source GLB but is not shown on the new slopes.
    var terrain_material := mesh.material_override as ShaderMaterial
    if terrain_material == null or terrain_material.shader == null:
        push_error("TERRAIN V2 FAIL: terrain-aligned shader missing")
        quit(1)
        return
    if not terrain_material.shader.code.contains("diffuse_toon") or not terrain_material.shader.code.contains("specular_disabled"):
        push_error("TERRAIN V3 TOON FAIL: terrain shader does not use toon diffuse without plastic specular")
        quit(1)
        return
    if not terrain_material.shader.code.contains("biome_atlas"):
        push_error("TERRAIN V3 FAIL: painted biome atlas is not sampled")
        quit(1)
        return
    var biome_tex := terrain_material.get_shader_parameter("biome_atlas") as Texture2D
    if biome_tex == null or biome_tex.get_width() != 1024 or biome_tex.get_height() != 1024:
        push_error("TERRAIN V3 FAIL: missing or incorrect 1024px painted atlas")
        quit(1)
        return
    # Painted Terrain V1: the new NONREPEATING full-island color composition
    # must be actually connected, not merely generated and forgotten on disk.
    var painted_tex := terrain_material.get_shader_parameter("painted_colormap") as Texture2D
    if painted_tex == null or painted_tex.get_width() < 1024 or painted_tex.get_height() < 1024:
        push_error("PAINTED TERRAIN V1 FAIL: missing bound large-format colormap")
        quit(1)
        return
    if not terrain_material.shader.code.contains("texture(painted_colormap, UV)") or not terrain_material.shader.code.contains("0.88") or not terrain_material.shader.code.contains("CAMERA_POSITION_WORLD"):
        push_error("PAINTED TERRAIN V1 FAIL: shader still prioritizes small repeating atlas")
        quit(1)
        return
    var macro_image := painted_tex.get_image()
    if macro_image == null:
        push_error("PAINTED TERRAIN V1 FAIL: colormap cannot be decoded")
        quit(1)
        return
    # Strong regional color differences prevent an accidental uniformly
    # green or single-color image from passing as a real island painting.
    var first_color := macro_image.get_pixel(140,140)
    var distinct := 0
    for xy in [Vector2i(350,350),Vector2i(510,720),Vector2i(850,400),
               Vector2i(1000,1000),Vector2i(1300,1200)]:
        var region_color := macro_image.get_pixel(xy.x,xy.y)
        var region_delta := absf(region_color.r-first_color.r) + absf(region_color.g-first_color.g) + absf(region_color.b-first_color.b)
        if region_delta > 0.19:
            distinct += 1
    if distinct < 2:
        push_error("PAINTED TERRAIN V1 FAIL: map has no meaningful area-specific painted color")
        quit(1)
        return
    print("PAINTED TERRAIN V1 PASS: 1536px nonrepeating world colormap bound; ",
          distinct, " different painted world regions; atlas is microdetail only")
    if mesh.mesh == null or mesh.mesh.get_faces().size() < 1000:
        push_error("TERRAIN BASE FAIL: imported geometry absent")
        quit(1)
        return
    # Future home sites, yards and footpaths must be real painted marks on
    # THIS rendered mesh, never overlapping geometry or invisible plans.
    # GLB COLOR_0 stores R=packed-earth footprint, G=trimmed yard, B=path.
    var terrain_surface := mesh.mesh.surface_get_arrays(0)
    var vertex_colors = terrain_surface[Mesh.ARRAY_COLOR]
    var render_vertex_count := (terrain_surface[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
    print("TERRAIN V3 PLOTS IMPORT DIAGNOSTIC: verts=", render_vertex_count,
        " colors=", vertex_colors.size(), " type=", type_string(typeof(vertex_colors)))
    # Godot optimizes away source-grid vertices not referenced by an actual
    # triangle. Do not require the original 17,484 FULL RECTANGLE vertices.
    if not (vertex_colors is PackedColorArray) or vertex_colors.size() < 5000 or vertex_colors.size() != render_vertex_count:
        push_error("TERRAIN V3 PLOTS FAIL: imported terrain is missing painted vertex colors")
        quit(1)
        return
    var footprint_points := 0
    var yard_points := 0
    var trail_points := 0
    for c in vertex_colors:
        if c.r > 0.4:
            footprint_points += 1
        if c.g > 0.4:
            yard_points += 1
        if c.b > 0.4:
            trail_points += 1
    if footprint_points < 100 or yard_points < 180 or trail_points < 100:
        push_error("TERRAIN V3 PLOTS FAIL: missing land-use zones (lots=%d yards=%d trails=%d)" % [
            footprint_points, yard_points, trail_points])
        quit(1)
        return
    if not terrain_material.shader.code.contains("landuse_weights") or not terrain_material.shader.code.contains("packed_earth"):
        push_error("TERRAIN V3 PLOTS FAIL: visual shader is ignoring baked building plot mask")
        quit(1)
        return
    print("TERRAIN V3 BUILD-PLOTS PASS: %d footprint / %d lawn / %d path marked vertices, no extra physics" % [
        footprint_points, yard_points, trail_points])
    # Coastal material must have a REAL shoreline gradient encoded in vertex
    # alpha. A binary cliff edge and elevation-only sand strips are regression.
    var coastal_points := 0
    var transitional_points := 0
    for c in vertex_colors:
        if c.a > 0.20:
            coastal_points += 1
        if c.a > 0.20 and c.a < 0.90:
            transitional_points += 1
    if coastal_points < 100 or transitional_points < 25:
        push_error("TERRAIN V3 BEACH FAIL: no smooth near-shore sand gradient")
        quit(1)
        return
    if not terrain_material.shader.code.contains("rock_boundary_noise") or not terrain_material.shader.code.contains("moss_breakup"):
        push_error("TERRAIN V3 ROCK FAIL: organic illustrated rock variation is missing")
        quit(1)
        return
    if not terrain_material.shader.code.contains("cliff_rock") or not terrain_material.shader.code.contains("wet_earth"):
        push_error("TERRAIN V3 ROCK FAIL: illustrated hill rock or damp riverbanks aren't shaded")
        quit(1)
        return
    if not terrain_material.shader.code.contains("shoreline_sand") or not terrain_material.shader.code.contains("smooth_noise"):
        push_error("TERRAIN V3 GROUND FAIL: natural shoreline/continuous macro texture not enabled")
        quit(1)
        return
    print("TERRAIN V3 NATURAL GROUND PASS: %d coastal and %d transitional vertices; no blocky shader hash cells" % [
        coastal_points, transitional_points])
    if collider.get_parent() != mesh:
        push_error("TERRAIN V3 FAIL: collision not derived from same visible mesh")
        quit(1)
        return
    var collider_shape := collider.get_node_or_null("CollisionShape3D") as CollisionShape3D
    if collider_shape == null or not (collider_shape.shape is ConcavePolygonShape3D):
        push_error("TERRAIN V3 FAIL: missing matching clean triangle collider")
        quit(1)
        return
    if mesh.mesh.get_faces().size() < 15000:
        push_error("TERRAIN V3 FAIL: inadequate rebuilt visual geometry")
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
        if n == terrain or n == water or n == infra or n == player or n == camera or str(n.name) == "VillageBuildingsV7" or str(n.name) == "VillageVegetationV73" or n is DirectionalLight3D or n is WorldEnvironment or n is CanvasLayer:
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
    # The imported FBX must retain its original texture assets but switch
    # shading mode on duplicated surface materials, without changing clips.
    var toon_count := int(world.get("toon_character_materials"))
    if toon_count < 1:
        push_error("TERRAIN V3 TOON FAIL: no imported FBX materials were converted")
        quit(1)
        return
    var toon_meshes := 0
    for node in fbx.find_children("*","MeshInstance3D",true,false):
        var animated_mesh := node as MeshInstance3D
        if animated_mesh.mesh == null:
            continue
        for index in range(animated_mesh.mesh.get_surface_count()):
            var material := animated_mesh.get_active_material(index) as BaseMaterial3D
            if material != null:
                if material.diffuse_mode != BaseMaterial3D.DIFFUSE_TOON:
                    push_error("TERRAIN V3 TOON FAIL: FBX surface lost toon shading")
                    quit(1)
                    return
                toon_meshes += 1
    if toon_meshes < 1:
        push_error("TERRAIN V3 TOON FAIL: no actual model surface uses toon shading")
        quit(1)
        return
    print("TERRAIN V3 TOON PASS: painterly terrain, solid bridge and ",toon_meshes,
          " original FBX surfaces render with soft toon lighting")
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
    # ACTIVE gameplay input regression: standing still does not prove a
    # CharacterBody3D can walk or jump on this rebuilt terrain!
    if not InputMap.has_action("touch_forward") or not InputMap.has_action("touch_jump"):
        push_error("TERRAIN V2 INPUT FAIL: touch movement/jump actions not registered")
        quit(1)
        return
    var start_walk := player.global_position
    Input.action_press("touch_forward")
    for frame in range(28):
        await physics_frame
    Input.action_release("touch_forward")
    var walked_m := player.global_position.distance_to(start_walk)
    if walked_m < 0.75:
        push_error("TERRAIN V2 MOVEMENT FAIL: character stuck, moved only %.3fm" % walked_m)
        quit(1)
        return
    for frame in range(10):
        await physics_frame
    if not player.is_on_floor():
        push_error("TERRAIN V2 JUMP FAIL: player is not grounded after walking")
        quit(1)
        return
    var pre_jump_height := player.global_position.y
    Input.action_press("touch_jump")
    for frame in range(7):
        await physics_frame
    Input.action_release("touch_jump")
    if player.global_position.y < pre_jump_height + 0.25 or player.velocity.y <= 0.0:
        push_error("TERRAIN V2 JUMP FAIL: jump button did not cause upward movement")
        quit(1)
        return
    for frame in range(100):
        await physics_frame
    if not player.is_on_floor():
        push_error("TERRAIN V2 LANDING FAIL: jump didn't return to a valid floor")
        quit(1)
        return
    print("TERRAIN V2 INPUT PASS: walk %.2fm, jump triggered, landed on rebuilt collision" % walked_m)
    # Real touch joystick regression: four old D-pad buttons must be gone.
    # Feed actual touch down/drag/up into the mobile controller and verify
    # analog strengths, independent fingers, and world-position movement.
    var controls := world.get_node_or_null("TouchControls/Buttons") as Node2D
    if controls == null or controls.get_node_or_null("Run") == null or controls.get_node_or_null("Jump") == null:
        push_error("TERRAIN V2 JOYSTICK FAIL: joystick / run / jump controls missing")
        quit(1)
        return
    for old_direction in ["Forward", "Back", "Left", "Right"]:
        if controls.get_node_or_null(old_direction) != null:
            push_error("TERRAIN V2 JOYSTICK FAIL: old direction D-pad still exists")
            quit(1)
            return
    controls.visible = true # CI runs on desktop; real Web/mobile is visible.
    var joystick_center: Vector2 = controls.get("_joystick_center")
    var joystick_radius: float = controls.get("_joystick_radius")
    var touch_down := InputEventScreenTouch.new()
    touch_down.index = 7
    touch_down.pressed = true
    touch_down.position = joystick_center
    controls.call("_input", touch_down)
    var touch_drag := InputEventScreenDrag.new()
    touch_drag.index = 7
    touch_drag.position = joystick_center + Vector2(joystick_radius * 0.65, -joystick_radius * 0.65)
    controls.call("_input", touch_drag)
    var analog_right := Input.get_action_strength("touch_right")
    var analog_forward := Input.get_action_strength("touch_forward")
    if analog_right < 0.25 or analog_forward < 0.25 or analog_right > 1.0 or analog_forward > 1.0:
        push_error("TERRAIN V2 JOYSTICK FAIL: diagonal drag did not produce proportional directional strengths")
        quit(1)
        return
    var movement: Vector3 = player.call("_read_movement_direction")
    if movement.x < 0.2 or movement.z > -0.2 or movement.length() > 1.01:
        push_error("TERRAIN V2 JOYSTICK FAIL: player did not read joystick diagonal")
        quit(1)
        return
    Input.action_press("touch_run")
    var unrelated_release := InputEventScreenTouch.new()
    unrelated_release.index = 8
    unrelated_release.pressed = false
    unrelated_release.position = joystick_center
    controls.call("_input", unrelated_release)
    if Input.get_action_strength("touch_right") < 0.25 or not Input.is_action_pressed("touch_run"):
        push_error("TERRAIN V2 JOYSTICK FAIL: second finger interrupted joystick/run")
        quit(1)
        return
    var start_analog := player.global_position
    for frame in range(22):
        await physics_frame
    var analog_distance := Vector2(player.global_position.x, player.global_position.z).distance_to(
        Vector2(start_analog.x, start_analog.z))
    if analog_distance < 0.4:
        push_error("TERRAIN V2 JOYSTICK FAIL: movement animation played but player remained stuck")
        quit(1)
        return
    var touch_up := InputEventScreenTouch.new()
    touch_up.index = 7
    touch_up.pressed = false
    touch_up.position = touch_drag.position
    controls.call("_input", touch_up)
    Input.action_release("touch_run")
    if Input.is_action_pressed("touch_right") or Input.is_action_pressed("touch_forward"):
        push_error("TERRAIN V2 JOYSTICK FAIL: axis did not reset when finger lifted")
        quit(1)
        return
    print("TERRAIN V2 MOBILE JOYSTICK PASS: diagonal strengths %.2f/%.2f, movement %.2fm, touch release, RUN and JUMP retained" % [
        analog_right, analog_forward, analog_distance])
    # Camera orbit regression: joystick/WASD must always follow the DISPLAY,
    # not the world's X/Z directions, even after rotating the camera 90/180°.
    if not bool(player.get("camera_relative_movement")):
        push_error("TERRAIN V3 CAMERA FAIL: screen-relative controls disabled")
        quit(1)
        return
    if player.get("movement_camera") != camera:
        push_error("TERRAIN V3 CAMERA FAIL: movement not bound to active camera")
        quit(1)
        return
    var initial_screen_up: Vector3 = player.call("_camera_relative_direction", Vector3(0, 0, -1))
    world.call("_rotate_camera", PI * 0.5)
    for frame in range(45):
        await process_frame
    var camera_right := camera.global_transform.basis.x
    var camera_forward := -camera.global_transform.basis.z
    camera_right.y = 0.0
    camera_forward.y = 0.0
    camera_right = camera_right.normalized()
    camera_forward = camera_forward.normalized()
    var right_world: Vector3 = player.call("_camera_relative_direction", Vector3(1, 0, 0))
    var up_world: Vector3 = player.call("_camera_relative_direction", Vector3(0, 0, -1))
    var left_world: Vector3 = player.call("_camera_relative_direction", Vector3(-1, 0, 0))
    var down_world: Vector3 = player.call("_camera_relative_direction", Vector3(0, 0, 1))
    if right_world.dot(camera_right) < 0.99 or up_world.dot(camera_forward) < 0.99:
        push_error("TERRAIN V3 CAMERA FAIL: joystick directions do not match rotated camera")
        quit(1)
        return
    if right_world.dot(left_world) > -0.99 or up_world.dot(down_world) > -0.99:
        push_error("TERRAIN V3 CAMERA FAIL: left/right or up/down flipped after rotation")
        quit(1)
        return
    if up_world.distance_to(Vector3(0, 0, -1)) < 0.45:
        push_error("TERRAIN V3 CAMERA FAIL: movement is still fixed to world axes")
        quit(1)
        return
    # Verify an actual physics movement after camera rotation.
    var orbit_start := player.global_position
    Input.action_press("touch_right")
    for frame in range(18):
        await physics_frame
    Input.action_release("touch_right")
    var orbit_displacement := player.global_position - orbit_start
    orbit_displacement.y = 0.0
    if orbit_displacement.length() < 0.55 or orbit_displacement.normalized().dot(right_world) < 0.65:
        push_error("TERRAIN V3 CAMERA FAIL: rotated-screen RIGHT did not move player to the screen right")
        quit(1)
        return
    world.call("_rotate_camera", PI * 0.5)
    for frame in range(45):
        await process_frame
    var rearward: Vector3 = player.call("_camera_relative_direction", Vector3(0, 0, -1))
    var new_forward := -camera.global_transform.basis.z
    new_forward.y = 0.0
    # Compare against INITIAL 0° camera, not the previous 90° direction.
    if rearward.dot(new_forward.normalized()) < 0.99 or rearward.dot(initial_screen_up) > -0.7:
        push_error("TERRAIN V3 CAMERA FAIL: 180-degree orbit did not rotate movement correctly")
        quit(1)
        return
    # Restore the starting camera yaw for clean gameplay.
    world.call("_reset_camera_rotation")
    # V7.1: vertical orbit is genuinely FREE, not locked to the two
    # preselected 3/4 camera elevations. Exercise both input surfaces.
    var mouse_orbit := InputEventMouseMotion.new()
    mouse_orbit.button_mask = MOUSE_BUTTON_MASK_RIGHT
    mouse_orbit.relative = Vector2(42.0, -73.0)
    var pitch_before := float(world.get("camera_pitch"))
    world.call("_unhandled_input", mouse_orbit)
    if float(world.get("camera_pitch")) < pitch_before + 0.50:
        push_error("V7.1 FREE CAMERA FAIL: right mouse vertical drag did not change elevation")
        quit(1)
        return
    var phone_orbit := InputEventScreenDrag.new()
    phone_orbit.position = root.get_visible_rect().size * Vector2(0.78,0.42)
    phone_orbit.relative = Vector2(-21.0, 84.0)
    var pitch_mouse := float(world.get("camera_pitch"))
    world.call("_unhandled_input",phone_orbit)
    if float(world.get("camera_pitch")) > pitch_mouse - 0.60:
        push_error("V7.1 FREE CAMERA FAIL: mobile vertical drag did not change elevation")
        quit(1)
        return
    # Aggressive vertical swipes must CLAMP to practical low-sky and overhead.
    world.call("_reset_camera_rotation")
    world.call("_orbit_camera", 0.0, deg_to_rad(-125.0))
    var min_angle: float = float(world.call("_base_camera_elevation")) + float(world.get("camera_pitch"))
    if absf(min_angle - deg_to_rad(10.0)) > 0.001:
        push_error("V7.2 CAMERA FAIL: lower pitch clamp does not prevent excessive sky")
        quit(1)
        return
    for frame in range(40):
        await process_frame
    var focus_low: Vector3 = world.get("_camera_focus")
    if camera.global_position.y < focus_low.y + 0.3:
        push_error("V7.2 CAMERA FAIL: camera can fall below its player pivot")
        quit(1)
        return
    world.call("_orbit_camera", 0.0, deg_to_rad(240.0))
    var max_angle: float = float(world.call("_base_camera_elevation")) + float(world.get("camera_pitch"))
    if absf(max_angle - deg_to_rad(70.0)) > 0.001:
        push_error("V7.2 CAMERA FAIL: upper pitch clamp can pass vertical pole")
        quit(1)
        return
    for frame in range(52):
        await process_frame
    var focus_high: Vector3 = world.get("_camera_focus")
    if (-camera.global_transform.basis.z).dot((focus_high-camera.global_position).normalized()) < 0.999:
        push_error("V7.2 CAMERA FAIL: free camera lost its player focus")
        quit(1)
        return
    var ground_at_cam: Dictionary = world.call("_ground_at_camera", camera.global_position.x, camera.global_position.z)
    if not ground_at_cam.is_empty() and camera.global_position.y < float(ground_at_cam.position.y) + 0.35:
        push_error("V7.2 CAMERA FAIL: camera intersects physical terrain")
        quit(1)
        return
    world.call("_reset_camera_rotation")
    for frame in range(38):
        await process_frame
    if absf(float(world.get("camera_pitch"))) > 0.001:
        push_error("V7.2 CAMERA FAIL: reset did not restore default 3/4 angle")
        quit(1)
        return
    print("V7.2 CAMERA LIMIT PASS: mobile and RMB orbit, 10-70 degree elevation, ground clearance")

    # The camera should look at its smoothed follow pivot, not raw physics
    # capsule motion. Verify the two vectors stay aligned after actual walks.
    for frame in range(14):
        await process_frame
    var pivot: Vector3 = world.get("_camera_focus")
    var look_dir := (pivot-camera.global_position).normalized()
    var cam_forward_now := (-camera.global_transform.basis.z).normalized()
    if cam_forward_now.dot(look_dir) < 0.999:
        push_error("TERRAIN V3 CAMERA SHAKE FAIL: aim diverged from smoothed camera follow pivot")
        quit(1)
        return
    if not bool(world.get("_camera_focus_ready")):
        push_error("TERRAIN V3 CAMERA SHAKE FAIL: camera smoothing never initialized")
        quit(1)
        return
    # New 3/4 is actually closer, even with a visibly smaller avatar.
    var camera_offset_distance := camera.global_position.distance_to(pivot)
    if camera_offset_distance < 5.6 or camera_offset_distance > 11.0:
        push_error("TERRAIN V3 CAMERA FAIL: close perspective camera distance is outside 5.6m..11m")
        quit(1)
        return
    if not player.has_method("get_camera_follow_position"):
        push_error("TERRAIN V3 CAMERA FAIL: no interpolated physics follow samples")
        quit(1)
        return
    var interpolated_player: Vector3 = player.call("get_camera_follow_position")
    if interpolated_player.distance_to(player.global_position) > 1.5:
        push_error("TERRAIN V3 CAMERA FAIL: camera interpolated position diverged from physics character")
        quit(1)
        return
    print("TERRAIN V7.5 SMOOTH CLOSE CAMERA PASS: 168cm avatar, %.2fm orbit distance, render-step interpolation" % camera_offset_distance)
    # Godot 4.3 ONLY interpolates 2D physics transforms natively. The
    # CAMERA sampled interpolated 3D positions while the FBX VISUAL previously
    # displayed stepped raw CharacterBody3D positions, creating judder.
    # The visual must share the EXACT camera render target every frame.
    if absf(Engine.physics_jitter_fix) > 0.001:
        push_error("TERRAIN V3 JITTER FAIL: conflicting Godot physics jitter fix enabled")
        quit(1)
        return
    var visual_render := player.get_node_or_null("Visual") as Node3D
    if visual_render == null:
        push_error("TERRAIN V3 JITTER FAIL: no visual node to interpolate")
        quit(1)
        return
    var largest_render_disagreement := 0.0
    Input.action_press("touch_forward")
    for sample in range(22):
        await physics_frame
        # A camera/visual render update MUST be checked, not just physics
        # transforms or camera look_at correctness.
        player.call("_process", 1.0/120.0)
        world.call("_process", 1.0/120.0)
        var expected: Vector3 = player.call("get_camera_follow_position")
        var disagreement := visual_render.global_position.distance_to(expected)
        largest_render_disagreement = maxf(largest_render_disagreement, disagreement)
        if disagreement > 0.01:
            Input.action_release("touch_forward")
            push_error("TERRAIN V3 JITTER FAIL: FBX visual and camera interpolate DIFFERENT positions: %.4fm" % disagreement)
            quit(1)
            return
    Input.action_release("touch_forward")
    player.call("reset_camera_follow_interpolation")
    player.call("_process", 1.0/60.0)
    if visual_render.global_position.distance_to(player.global_position) > 0.01:
        push_error("TERRAIN V3 JITTER FAIL: visual did not reset after teleport")
        quit(1)
        return
    print("TERRAIN V3 RENDER SYNC PASS: visual and camera target match over 22 physics frames, max error %.4fm" % largest_render_disagreement)
    print("TERRAIN V3 CAMERA STABILITY PASS: aim and smoothed follow pivot aligned while walking")
    # The published Web terrain preview starts in the island's CENTER, over
    # 60m from its beach. On iPhone users need a visible, working coast
    # action, and the sand must be a physically DRY part of the 3D terrain.
    var beach_control := test.get_node_or_null("TerrainTestHUD/CoastPreviewControls/VisitBeach") as Button
    var village_control := test.get_node_or_null("TerrainTestHUD/CoastPreviewControls/ReturnVillage") as Button
    if beach_control == null or village_control == null or beach_control.disabled:
        push_error("TERRAIN V6.8 BEACH FAIL: mobile beach preview controls unavailable")
        quit(1)
        return
    beach_control.pressed.emit()
    await physics_frame
    await physics_frame
    var beach_pos := player.global_position
    if beach_pos.z < 62.0 or beach_pos.y < 0.85 or absf(float(world.get("camera_yaw"))-PI) > 0.001:
        push_error("TERRAIN V6.8 BEACH FAIL: teleport did not reach visible southern dry beach")
        quit(1)
        return
    var offshore_q := PhysicsRayQueryParameters3D.create(
        beach_pos + Vector3(0.0, 80.0, 14.0),
        beach_pos + Vector3(0.0, -40.0, 14.0))
    offshore_q.collision_mask = 1 << 7
    if not world.get_world_3d().direct_space_state.intersect_ray(offshore_q).is_empty():
        push_error("TERRAIN V6.8 BEACH FAIL: ocean remains covered by land in front of beach")
        quit(1)
        return
    if not village_control.visible:
        push_error("TERRAIN V6.8 BEACH FAIL: return navigation missing")
        quit(1)
        return
    village_control.pressed.emit()
    if player.global_position.distance_to(Vector3(world.get("terrain_spawn_position"))) > 0.2:
        push_error("TERRAIN V6.8 BEACH FAIL: village return did not restore original spawn")
        quit(1)
        return
    print("TERRAIN V6.8 BEACH NAV PASS: dry southern shore, sea forward, mobile buttons, village return")
    print("TERRAIN V3 CAMERA-RELATIVE INPUT PASS: 90/180 orbit, screen-aligned axes, real right movement %.2fm" % orbit_displacement.length())
    print("TERRAIN BASE HD CAMERA PASS: worldspace_material=1, perspective FOV=%.1f, camera_distance=%.2f, character=168cm, capsule_height=%.2f" % [
        camera.fov, cam_distance, capsule.height])
    print("TERRAIN V3 PAINTED MESH PASS: biome atlas 1024px bound, clean visual/collision topology shared, original source preserved")
    print("TERRAIN V3 PLAYABLE TEST PASS: matched coastline collider, 1K hand-painted atlas, river, 3/4 camera, original FBX and joystick")
    print("TERRAIN BASE SMOKE PASS: ONLY uploaded terrain + real collider + original controllable FBX + camera and lighting; no old objects")
    quit(0)
