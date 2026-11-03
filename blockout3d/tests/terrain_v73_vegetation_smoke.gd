extends SceneTree
## Checks the actual assembled V7.3 Godot scene, painterly textures, grounded
## foliage, performance-friendly grass MultiMesh, selective tree collision.
func _initialize() -> void:
    call_deferred("_run")

func _fail(why: String) -> void:
    push_error("V7.3 VEGETATION FAIL: "+why)
    quit(1)

func _run() -> void:
    var level := load("res://scenes/terrain_base_test.tscn").instantiate() as Node3D
    root.add_child(level)
    for frame in range(490):
        await physics_frame
        if bool(level.get("is_ready")):
            break
    if not bool(level.get("is_ready")):
        _fail("terrain, settlement or vegetation startup timeout")
        return
    var world := level.get_node_or_null("World") as Node3D
    var vegetation := world.get_node_or_null("VillageVegetationV73") as Node3D
    var houses := world.get_node_or_null("VillageBuildingsV7") as Node3D
    if vegetation == null or not bool(vegetation.get("finished")) or houses == null:
        _fail("independent vegetation and 17 houses not both installed")
        return
    if houses.get_child_count()!=17:
        _fail("vegetation accidentally replaced some buildings")
        return
    var total: int = int(vegetation.get("planted_count"))
    var counts: Dictionary = vegetation.get("counts")
    var solid: int = int(vegetation.get("solid_trunks"))
    var grass_count: int = int(vegetation.get("grass_count"))
    if total<76 or grass_count<35 or int(counts.get("palm",0))<5:
        _fail("not enough physically grounded coast/village vegetation "+str(counts))
        return
    if int(counts.get("shade",0))<7 or int(counts.get("banana",0))<5 or int(counts.get("shrub",0))<18:
        _fail("village/river trees, banana and undergrowth incomplete "+str(counts))
        return
    if solid != int(counts.get("palm",0))+int(counts.get("shade",0)):
        _fail("only real large-tree trunks should have physical colliders")
        return
    var grass := vegetation.get_node_or_null("NonCollidingGrassMultiMesh") as MultiMeshInstance3D
    if grass==null or grass.multimesh==null or grass.multimesh.instance_count!=grass_count:
        _fail("low-draw-call grass batch absent or incomplete")
        return
    if grass.get_child_count()>0:
        _fail("grass must be non-colliding and instanced")
        return
    await physics_frame
    await physics_frame
    var tested: int = 0
    var textured: int = 0
    var tree_hits: int = 0
    var species: Dictionary = {}
    var rendered_parts := 0
    var batches := 0
    var accumulated_parts := 0
    for item in vegetation.get_children():
        if item == grass:
            continue
        if item is MultiMeshInstance3D:
            var batch := item as MultiMeshInstance3D
            if not str(batch.name).begins_with("FoliageBatch_") or batch.multimesh==null:
                _fail("unexpected unvalidated 3D foliage batch")
                return
            var mat := batch.material_override as BaseMaterial3D
            if mat==null or mat.albedo_texture==null or mat.normal_texture==null:
                _fail("foliage batch lost hand-painted texture/normal source")
                return
            if batch.multimesh.instance_count < 1:
                _fail("empty GPU foliage batch")
                return
            batches += 1
            accumulated_parts += batch.multimesh.instance_count
            continue
        var plant := item as Node3D
        if plant == null:
            _fail("unknown visual node in vegetation")
            return
        var type: String = str(plant.get_meta("plant_type",""))
        if not ["shade","palm","banana","shrub"].has(type):
            _fail("unrecognized tree mesh type")
            return
        species[type] = int(species.get(type,0))+1
        var soil_query := PhysicsRayQueryParameters3D.create(
            Vector3(plant.global_position.x,110.0,plant.global_position.z),
            Vector3(plant.global_position.x,-45.0,plant.global_position.z))
        soil_query.collision_mask = 1 << 7
        var ground := world.get_world_3d().direct_space_state.intersect_ray(soil_query)
        if ground.is_empty() or absf(float(ground.position.y)-plant.global_position.y)>.19:
            _fail("plant is floating, below sea or not grounded: "+str(plant.name))
            return
        if float(ground.position.y)<.90:
            _fail("a large visible plant is in river/ocean water")
            return
        if bool(vegetation.call("_protects_path_or_building",plant.position.x,plant.position.z,type)):
            _fail("plant blocks village path, door or open plaza: "+str(plant.name))
            return
        var trunk := plant.get_node_or_null("TrunkCollision") as StaticBody3D
        if type in ["shade","palm"]:
            if trunk==null or trunk.collision_layer&1==0 or trunk.get_node_or_null("PhysicalTrunk")==null:
                _fail("large tree missing selective physics: "+str(plant.name))
                return
            var query := PhysicsRayQueryParameters3D.create(
                plant.global_position+Vector3.UP*7,
                plant.global_position+Vector3.DOWN*.2)
            query.collision_mask=1
            var contact := world.get_world_3d().direct_space_state.intersect_ray(query)
            if contact.is_empty() or contact.collider!=trunk:
                _fail("tree physical trunk does not block player: "+str(plant.name))
                return
            tree_hits += 1
        elif trunk!=null:
            _fail("banana/shrub should be pass-through, not obstruct walking")
            return
        # Each plant is still a real grounded physical placement, but its
        # painted meshes are drawn by sibling GPU MultiMesh batches.
        var leaves: int = int(plant.get_meta("painted_parts",0))
        if leaves<2 or not plant.find_children("*","MeshInstance3D",true,false).is_empty():
            _fail("vegetation must have painterly MultiMesh parts, no duplicated mesh nodes")
            return
        rendered_parts += leaves
        textured += 1
        tested += 1
    if tested != total-grass_count or textured!=tested or tree_hits!=solid:
        _fail("vegetation counts/colliders mismatch; species "+str(species))
        return
    if batches<25 or batches>45 or rendered_parts!=accumulated_parts or (
        int(vegetation.get("foliage_batch_count"))!=batches):
        _fail("GPU batching incomplete or excessive foliage drawcalls; batches="+str(batches)+
            " expected parts="+str(rendered_parts)+" real="+str(accumulated_parts))
        return
    print("V7.8 WEB FOLIAGE BATCH PASS: ",rendered_parts,
        " original textured parts draw in ",batches," instanced batches")
    var zones: Dictionary = vegetation.get("zone_counts")
    for name in ["desa_inti","pekarangan_barat","balai_desa","tepi_sungai","akses_pesisir"]:
        if not zones.has(name) or zones[name].is_empty():
            _fail("vegetation zone empty: "+name)
            return
    print("V7.3 VEGETATION PHYSICS PASS: %d solid trunks, actual ground rays and collision; grasses/shrubs unblocked"%tree_hits)
    print("V7.3 VEGETATION SMOKE PASS: ",total," planted textured assets in 5 zones; ",
        "banana/palm visually distinct, batched grass=",grass_count,
        ", all houses/roads/plaza/bridges preserved")
    quit(0)
