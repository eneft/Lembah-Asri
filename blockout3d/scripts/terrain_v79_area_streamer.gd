extends Node3D
## Lembah Asri V7.9 - five real, instanced area scenes, not five copies
## of the island. Keep the authoritative terrain, rivers, bridges and
## collision alive across every area transition.
##
## Heavy houses and foliage draw only inside nearby areas. Repartition the
## existing foliage MultiMeshes PER AREA, because toggling one global forest
## batch cannot cull distant trees. Never change source plant transforms, UVs,
## material overrides, building collision or player movement.
const AREA_TEMPLATE := preload("res://scenes/area_v79.tscn")
const PLAN := "res://assets/environment/village/vegetation_v73.json"
const AREAS := ["desa_inti", "pekarangan_barat", "balai_desa", "tepi_sungai", "akses_pesisir"]
const ENTER_DISTANCE_M := 39.0
const EXIT_DISTANCE_M := 55.0
const UPDATE_SECONDS := 0.36

var finished := false
var building_count := 0
var plant_count := 0
var original_foliage_instances := 0
var area_foliage_instances := 0
var area_batch_count := 0
var active_area_count := 0
var _zones: Dictionary = {}
var _bounds: Dictionary = {}
var _plants_by_type: Dictionary = {}
var _world: Node3D
var _player: CharacterBody3D
var _camera: Camera3D
var _elapsed := 0.0

func _rect_distance(point: Vector3, rect: Rect2) -> float:
    var close_x: float = clampf(point.x,rect.position.x,rect.end.x)
    var close_z: float = clampf(point.z,rect.position.y,rect.end.y)
    return Vector2(point.x-close_x,point.z-close_z).length()

func _nearest_area(point: Vector3) -> String:
    var closest := "desa_inti"
    var distance := INF
    for area_id in AREAS:
        var d := _rect_distance(point,_bounds[area_id])
        if d < distance:
            closest = area_id
            distance = d
    return closest

func _building_area(label: String, at: Vector3) -> String:
    # Land-use identity from the V7 settlement layout is intentionally
    # preferred over overlapping V7.3 vegetation zone rectangles.
    if label == "rumah_masa_kecil" or label == "gudang_kebun" or label.begins_with("rumah_barat_"):
        return "pekarangan_barat"
    if label == "balai_desa" or label == "pos_ronda_balai":
        return "balai_desa"
    if label.begins_with("rumah_nelayan_") or label == "warung_pesisir":
        return "akses_pesisir"
    if label == "rumah_desa_06":
        return "tepi_sungai"
    return "desa_inti"

func _move_buildings(settlement: Node3D) -> void:
    for entry in settlement.get_children():
        var house := entry as Node3D
        if house == null:
            continue
        var zone_id := _building_area(str(house.name),house.global_position)
        var destination := (_zones[zone_id] as Node3D).get_node("Houses") as Node3D
        house.reparent(destination,true)
        house.set_meta("area_scene",zone_id)
        building_count += 1

func _move_plants(vegetation: Node3D) -> void:
    # Original insertion order is retained for each species, matching the
    # per-species _collect_foliage_parts() MultiMesh instance indices.
    for entry in vegetation.get_children():
        var plant := entry as Node3D
        if plant == null or plant is MultiMeshInstance3D:
            continue
        var kind := str(plant.get_meta("plant_type",""))
        if kind.is_empty():
            continue
        var zone_id := str(plant.get_meta("zone",""))
        if not _zones.has(zone_id):
            push_error("AREA V7.9 FAIL: unknown plant zone "+zone_id)
            continue
        var list: Array = _plants_by_type.get(kind,[])
        list.append(plant)
        _plants_by_type[kind] = list
        plant.reparent((_zones[zone_id] as Node3D).get_node("Plants"),true)
        plant_count += 1

func _partition_batch(original: MultiMeshInstance3D) -> bool:
    var source := original.multimesh
    if source == null or source.mesh == null:
        return false
    var is_grass := str(original.name) == "NonCollidingGrassMultiMesh"
    var species := ""
    var plants: Array = []
    if not is_grass:
        if not str(original.name).begins_with("FoliageBatch_"):
            return false
        species = str(original.name).trim_prefix("FoliageBatch_").split("_")[0]
        plants = _plants_by_type.get(species,[])
        if plants.size() != source.instance_count:
            push_error("AREA V7.9 FAIL: "+str(original.name)+" has no exact plant-index mapping")
            return false
    var partitions: Dictionary = {}
    for index in range(source.instance_count):
        var zone_id: String
        if is_grass:
            zone_id = _nearest_area(source.get_instance_transform(index).origin)
        else:
            zone_id = str((plants[index] as Node3D).get_meta("zone",""))
        if not _zones.has(zone_id):
            push_error("AREA V7.9 FAIL: foliage has invalid area "+zone_id)
            return false
        var part: Array = partitions.get(zone_id,[])
        part.append(index)
        partitions[zone_id] = part

    # Construct all zone batches before deleting original: failed conversion
    # never silently drops the only textured forest geometry.
    var prepared: Array = []
    for zone_id in AREAS:
        var indices: Array = partitions.get(zone_id,[])
        if indices.is_empty():
            continue
        var batched := MultiMesh.new()
        batched.transform_format = source.transform_format
        batched.use_colors = source.use_colors
        batched.use_custom_data = source.use_custom_data
        batched.mesh = source.mesh
        batched.instance_count = indices.size()
        for j in range(indices.size()):
            var source_index: int = int(indices[j])
            batched.set_instance_transform(j,source.get_instance_transform(source_index))
            if source.use_colors:
                batched.set_instance_color(j,source.get_instance_color(source_index))
            if source.use_custom_data:
                batched.set_instance_custom_data(j,source.get_instance_custom_data(source_index))
        var display := MultiMeshInstance3D.new()
        display.name = ("%s_%s" % [str(original.name),zone_id])
        display.multimesh = batched
        display.material_override = original.material_override
        display.cast_shadow = original.cast_shadow
        display.layers = original.layers
        prepared.append({"zone":zone_id,"node":display,"count":indices.size()})

    var accounted := 0
    for item in prepared:
        var zone_id: String = item["zone"]
        var destination := (_zones[zone_id] as Node3D).get_node("Foliage") as Node3D
        destination.add_child(item["node"] as MultiMeshInstance3D)
        accounted += int(item["count"])
        area_batch_count += 1
    if accounted != source.instance_count:
        push_error("AREA V7.9 FAIL: split instance count mismatch")
        return false
    original_foliage_instances += source.instance_count
    area_foliage_instances += accounted
    original.queue_free()
    return true

func configure(world: Node3D, settlement: Node3D, vegetation: Node3D) -> void:
    if finished:
        return
    if world == null or settlement == null or vegetation == null:
        push_error("AREA V7.9 FAIL: incomplete terrain layers")
        return
    if not FileAccess.file_exists(PLAN):
        push_error("AREA V7.9 FAIL: missing authoritative zone blueprint")
        return
    var source_plan = JSON.parse_string(FileAccess.get_file_as_string(PLAN))
    if not (source_plan is Dictionary):
        push_error("AREA V7.9 FAIL: invalid zone blueprint")
        return
    for item in source_plan.get("zones",[]):
        var zone: Dictionary = item
        var id := str(zone.get("id",""))
        if not AREAS.has(id) or _zones.has(id):
            push_error("AREA V7.9 FAIL: unexpected area "+id)
            return
        var xy: Array = zone["bounds"]
        _bounds[id] = Rect2(float(xy[0]),float(xy[1]),
            float(xy[2])-float(xy[0]),float(xy[3])-float(xy[1]))
        var scene := AREA_TEMPLATE.instantiate() as Node3D
        scene.name = "Area_" + id
        scene.set_meta("area_id",id)
        add_child(scene)
        _zones[id] = scene
    if _zones.size() != 5:
        push_error("AREA V7.9 FAIL: expected five separate area scenes")
        return

    _world = world
    _player = world.get_node_or_null("Player3D") as CharacterBody3D
    _camera = world.get_node_or_null("IsometricCamera") as Camera3D
    if _player == null or _camera == null:
        push_error("AREA V7.9 FAIL: character or follow camera missing")
        return
    _move_buildings(settlement)
    _move_plants(vegetation)

    var originals: Array = []
    for child in vegetation.get_children():
        if child is MultiMeshInstance3D:
            originals.append(child)
    for entry in originals:
        if not _partition_batch(entry as MultiMeshInstance3D):
            push_error("AREA V7.9 FAIL: unpartitioned foliage "+str(entry.name))
            return
    if building_count != 17 or plant_count < 30 or area_foliage_instances < 100:
        push_error("AREA V7.9 FAIL: village lost geometry during area split")
        return
    finished = true
    # Keep all scenes visible until the authoritative safe player spawn is
    # found. /terrain-test/ signals Web ready only after first visibility pass.
    set_meta("area_scene_count",_zones.size())
    set_meta("split_foliage_instances",area_foliage_instances)
    print("AREA V7.9 PARTITION PASS: 5 independent area scene instances, ",
        building_count," unique buildings, ",plant_count," rooted plants, ",
        area_foliage_instances," GPU foliage parts in ",area_batch_count,
        " spatial batches; original terrain + bridge physics unchanged")

func refresh_visibility(point: Vector3, force := false) -> void:
    if not finished:
        return
    var zoom_bonus := 0.0
    if is_instance_valid(_camera):
        zoom_bonus = clampf((_camera.size-16.0)*0.7,0.0,36.0)
    var on_distance := ENTER_DISTANCE_M+zoom_bonus
    var off_distance := EXIT_DISTANCE_M+zoom_bonus
    var active := 0
    for zone_id in AREAS:
        var scene := _zones[zone_id] as Node3D
        var distance := _rect_distance(point,_bounds[zone_id])
        var threshold := on_distance if force or not scene.visible else off_distance
        var should_show := distance <= threshold
        if scene.visible != should_show:
            scene.visible = should_show
        if should_show:
            active += 1
    active_area_count = active
    set_meta("visible_area_count",active)

func _process(delta: float) -> void:
    if not finished or not is_instance_valid(_player):
        return
    _elapsed += delta
    if _elapsed < UPDATE_SECONDS:
        return
    _elapsed = 0.0
    # Small lookahead makes crossing a zone boundary seamless while retaining
    # separate enter/exit distances, preventing rapid visibility flicker.
    var anticipated := _player.global_position + _player.velocity*0.45
    refresh_visibility(anticipated)
