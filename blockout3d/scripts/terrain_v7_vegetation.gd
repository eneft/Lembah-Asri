extends Node3D
## Lembah Asri V7.3 – Phase 1 vegetation. Scene-only overlay over V6.8
## physical ground, V7.2 settlement and bridges; never moves their nodes.
##
## All instances are planted by real terrain raycasts. Precalculated,
## reproducible locations avoid 17 building footprints, door approaches,
## open village green, all village paths and bridge landings. Refuse wet ground.
##
## Art: reuse EXACT painterly texture+normal/UV material and handcrafted
## banana/palm/shade foliage shapes already present in village_art.gd.
## Physics: only shade/palm trunks solid; grass, banana, shrubs pass-through.
const VEGETATION_PLAN := "res://assets/environment/village/vegetation_v73.json"
const VILLAGE_ART := preload("res://scripts/village_art.gd")
const GROUND_LAYER := 1 << 7
const PLAYER_COLLISION := 1
const SEA_LEVEL := 0.45
const SAFE_SOIL := 0.91
const TYPES := ["shade", "banana", "palm", "shrub", "grass"]

var finished := false
var planted_count := 0
var solid_trunks := 0
var counts: Dictionary = {}
var zone_counts: Dictionary = {}
var grass_count := 0
var _art: RefCounted
var _prototypes: Dictionary = {}
var _template_holder: Node3D
var _grass_transforms: Array[Transform3D] = []
var _grass_tints: Array[Color] = []
# WebGL2/GLES compatibility has a practical visible mesh count budget.
# The original forest made hundreds of MeshInstance3D nodes; combine every
# identical tree part into one native GPU MultiMesh, preserving its exact
# textured mesh, plant transform, silhouette and selective trunk collider.
var _foliage_batches: Dictionary = {}
var foliage_batch_count := 0
var foliage_part_instances := 0
var _plot_guards: Array = []
var _road_guards: Array = []

func _make_prototypes() -> void:
    _art = VILLAGE_ART.new()
    # All original geometry is transient and NEVER enters the world tree.
    # Parent it to a holder and free the holder once placed clones exist;
    # otherwise 34 prototype mesh buffers leak at Godot engine shutdown.
    _template_holder = Node3D.new()
    _template_holder.name = "TemporaryVegetationTemplates"
    _prototypes["shade"] = _art.call("build_tree", _template_holder, Vector3.ZERO, 1.0)
    _prototypes["banana"] = _art.call("build_banana", _template_holder, Vector3.ZERO)
    _prototypes["palm"] = _art.call("build_palm", _template_holder, Vector3.ZERO)
    var shrub := Node3D.new()
    shrub.name = "SemakTropis"
    _template_holder.add_child(shrub)
    _art.call("_sphere",shrub,"DaunSemakKiri",Vector3(-0.36,0.49,0.02),
        Vector3(0.58,0.48,0.51),"leaf_dark")
    _art.call("_sphere",shrub,"DaunSemakKanan",Vector3(0.34,0.57,-0.12),
        Vector3(0.60,0.51,0.54),"leaf")
    _art.call("_sphere",shrub,"PucukSemak",Vector3(0.08,0.83,0.24),
        Vector3(0.52,0.40,0.48),"leaf_light")
    _prototypes["shrub"] = shrub

func _ground(world: Node3D,x: float,z: float) -> Dictionary:
    var ray := PhysicsRayQueryParameters3D.create(
        Vector3(x,110.0,z),Vector3(x,-45.0,z))
    ray.collision_mask = GROUND_LAYER
    return world.get_world_3d().direct_space_state.intersect_ray(ray)

func _point_segment_distance(x: float,z: float,a: Array,b: Array) -> float:
    var dx: float = float(b[0])-float(a[0])
    var dz: float = float(b[1])-float(a[1])
    var t: float = clampf(((x-float(a[0]))*dx+(z-float(a[1]))*dz) /
        maxf(0.000001,dx*dx+dz*dz),0.0,1.0)
    return Vector2(x-float(a[0])-dx*t,z-float(a[1])-dz*t).length()

func _protects_path_or_building(x: float,z: float,kind: String) -> bool:
    # Plan is generated from the authoritative landuse blueprint, with a
    # second runtime clearance check so later edits cannot create obstructions.
    var margin: float = 2.55 if kind=="shade" else (
        2.70 if kind=="palm" else (1.70 if kind=="banana" else
        (1.10 if kind=="shrub" else 0.85)))
    for p in _plot_guards:
        var point: Dictionary = p
        var xy: Array = point["center"]
        var angle: float = deg_to_rad(float(point["yaw"]))
        var dx: float = x-float(xy[0])
        var dz: float = z-float(xy[1])
        var u: float = absf(cos(angle)*dx+sin(angle)*dz)
        var v: float = absf(-sin(angle)*dx+cos(angle)*dz)
        var open_green: bool = str(point["kind"]) == "square"
        var dims: Array = point["yard"] if open_green else point["foot"]
        var radius: float = margin+1.4 if open_green else margin
        if u < float(dims[0])*0.5+radius and v < float(dims[1])*0.5+radius:
            return true
        # The front door is in local +Z. Keep an independent walking cone
        # from the door to the road, not merely the square house footprint.
        if not open_green and str(point["kind"]) != "watch_post":
            if v < float(point["foot"][1])*0.5+5.0+margin and v > float(point["foot"][1])*0.45 and u < 2.7+margin:
                return true
    for path in _road_guards:
        var route: Dictionary = path
        var line: Array = route["points"]
        for i in range(line.size()-1):
            if _point_segment_distance(x,z,line[i],line[i+1]) < (
                float(route["width"])*0.5+margin+0.72):
                return true
    return false

func _add_trunk_collision(root: Node3D,kind: String) -> void:
    var trunk := StaticBody3D.new()
    trunk.name = "TrunkCollision"
    trunk.collision_layer = PLAYER_COLLISION
    trunk.collision_mask = 0
    root.add_child(trunk)
    var shape := CollisionShape3D.new()
    shape.name = "PhysicalTrunk"
    var cylinder := CylinderShape3D.new()
    cylinder.radius = 0.31 if kind=="shade" else 0.19
    cylinder.height = 3.9 if kind=="shade" else 5.45
    shape.shape = cylinder
    shape.position.y = cylinder.height*0.5
    trunk.add_child(shape)
    solid_trunks += 1

func _grass_mesh() -> ArrayMesh:
    # Two curved pencil-thin illustrated tufts instead of flat texture decals.
    # 100+ clumps share ONE mesh and material/draw call via MultiMeshInstance3D.
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    for i in range(5):
        var a: float = TAU*float(i)/5.0
        var outer := Vector3(cos(a),0.0,sin(a))
        var sideways := Vector3(-outer.z,0.0,outer.x)
        var left := outer*0.16-sideways*0.12
        var right := outer*0.16+sideways*0.12
        var peak := outer*0.35+Vector3.UP*(0.31+float(i%3)*0.08)
        for v in [left,right,peak]:
            st.set_uv(Vector2(v.x+0.5,v.y))
            st.add_vertex(v)
    st.generate_normals()
    st.generate_tangents()
    return st.commit()

func _collect_foliage_parts(kind: String, placement: Transform3D) -> int:
    var template := _prototypes[kind] as Node3D
    var painted := 0
    var index := 0
    for node in template.get_children():
        var part := node as MeshInstance3D
        if part == null or part.mesh == null:
            continue
        var material := part.get_active_material(0) as BaseMaterial3D
        if material != null and material.albedo_texture != null:
            painted += 1
        var batch_id := kind + "_" + str(index)
        if not _foliage_batches.has(batch_id):
            _foliage_batches[batch_id] = {
                "mesh":part.mesh,
                "material":part.material_override,
                "transforms":[],
                "shadow":part.cast_shadow
            }
        var record: Dictionary = _foliage_batches[batch_id]
        var transforms: Array = record["transforms"]
        transforms.append(placement * part.transform)
        foliage_part_instances += 1
        index += 1
    return painted

func _finalize_foliage_batches() -> void:
    for id in _foliage_batches.keys():
        var record: Dictionary = _foliage_batches[id]
        var instances: Array = record["transforms"]
        if instances.is_empty():
            continue
        var mm := MultiMesh.new()
        mm.transform_format = MultiMesh.TRANSFORM_3D
        mm.mesh = record["mesh"] as Mesh
        mm.instance_count = instances.size()
        for index in range(instances.size()):
            mm.set_instance_transform(index,instances[index])
        var display := MultiMeshInstance3D.new()
        display.name = "FoliageBatch_" + str(id)
        display.multimesh = mm
        display.material_override = record["material"] as Material
        display.cast_shadow = record["shadow"]
        add_child(display)
        foliage_batch_count += 1

func _plant(world: Node3D, entry: Dictionary) -> bool:
    var kind: String = str(entry["type"])
    var x: float = float(entry["x"])
    var z: float = float(entry["z"])
    if _protects_path_or_building(x,z,kind):
        return false
    var bank := _ground(world,x,z)
    if bank.is_empty():
        return false
    var normal: Vector3 = bank.normal
    if float(bank.position.y) < SAFE_SOIL:
        return false
    if normal.y < (0.91 if kind in ["shade","banana","palm"] else 0.79):
        return false
    var scale_m: float = float(entry["scale"])
    var yaw: float = deg_to_rad(float(entry["yaw"]))
    var pos: Vector3 = bank.position
    if kind == "grass":
        var t := Transform3D(Basis(Vector3.UP,yaw).scaled(Vector3.ONE*scale_m),pos)
        _grass_transforms.append(t)
        var tint := Color.WHITE.lerp(Color("a8c69b"),float(grass_count%5)/13.0)
        _grass_tints.append(tint)
        grass_count += 1
    else:
        # Preserve 72 individual plant metadata/physics roots but do NOT
        # create ~400 separate GPU mesh instances. The same source painterly
        # meshes are rendered via shared MultiMesh batches below.
        var plant := Node3D.new()
        plant.name = "Vegetation_%s_%04d" % [kind,planted_count]
        plant.position = pos
        plant.rotation.y = yaw
        plant.scale = Vector3.ONE * scale_m
        plant.set_meta("plant_type",kind)
        plant.set_meta("zone",str(entry["zone"]))
        add_child(plant)
        var painted: int = _collect_foliage_parts(kind,plant.transform)
        plant.set_meta("painted_parts",painted)
        if kind in ["shade","palm"]:
            _add_trunk_collision(plant,kind)
    counts[kind] = int(counts.get(kind,0))+1
    var zone: String = str(entry["zone"])
    var by_zone: Dictionary = zone_counts.get(zone,{})
    by_zone[kind] = int(by_zone.get(kind,0))+1
    zone_counts[zone] = by_zone
    planted_count += 1
    return true

func _finalize_grass() -> void:
    if _grass_transforms.is_empty():
        return
    var grass := MultiMeshInstance3D.new()
    grass.name = "NonCollidingGrassMultiMesh"
    var mm := MultiMesh.new()
    mm.transform_format = MultiMesh.TRANSFORM_3D
    mm.use_colors = true
    mm.mesh = _grass_mesh()
    mm.instance_count = _grass_transforms.size()
    for i in range(_grass_transforms.size()):
        mm.set_instance_transform(i,_grass_transforms[i])
        mm.set_instance_color(i,_grass_tints[i])
    grass.multimesh = mm
    grass.material_override = _art.call("_material","leaf_light")
    grass.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(grass)

func configure(world: Node3D) -> void:
    if finished:
        return
    if not FileAccess.file_exists(VEGETATION_PLAN):
        push_error("V7.3 VEGETATION FAIL: missing zone and clearance data")
        return
    var data = JSON.parse_string(FileAccess.get_file_as_string(VEGETATION_PLAN))
    if not (data is Dictionary) or str(data.get("revision",""))!="V7.3":
        push_error("V7.3 VEGETATION FAIL: invalid plan revision")
        return
    _plot_guards = data.get("plots",[])
    _road_guards = data.get("paths",[])
    var targets: Dictionary = {}
    for zone_raw in data.get("zones",[]):
        var zone: Dictionary = zone_raw
        for kind in zone["specs"].keys():
            targets[str(zone["id"])+"/"+str(kind)] = int(zone["specs"][kind])
    _make_prototypes()
    for raw in data.get("candidates",[]):
        var entry: Dictionary = raw
        var kind: String = str(entry["type"])
        if not TYPES.has(kind):
            push_error("V7.3 VEGETATION FAIL: unrecognized foliage "+kind)
            return
        var zone: String = str(entry["zone"])
        if int(zone_counts.get(zone,{}).get(kind,0)) >= int(targets.get(zone+"/"+kind,0)):
            continue
        _plant(world,entry)
    _finalize_grass()
    _finalize_foliage_batches()
    # All material/geometry source Resources are held by the MultiMeshes;
    # discard the source templates without allocating hundreds of objects.
    _template_holder.free()
    _template_holder = null
    _prototypes.clear()
    if planted_count < 76 or int(counts.get("shade",0))<7 or int(counts.get("banana",0))<5 or int(counts.get("palm",0))<5:
        push_error("V7.3 VEGETATION FAIL: not enough living trees/ground cover on real dry island: "+str(counts))
        return
    set_meta("vegetation_count",planted_count)
    set_meta("trunk_count",solid_trunks)
    set_meta("foliage_batch_count",foliage_batch_count)
    finished = true
    print("V7.8 WEB FOLIAGE BATCH PASS: ",foliage_part_instances,
        " painted tree/shrub mesh parts drawn through ",foliage_batch_count,
        " GPU MultiMeshes; root colliders and transforms kept")
    print("V7.3 VEGETATION PASS: ",planted_count," grounded hand-painted plants; ",
        counts,"; solid trunks=",solid_trunks,"; grass instanced, public green clear")
