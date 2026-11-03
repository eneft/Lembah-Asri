extends Node3D
## Lembah Asri V7.0 settlement — separate, non-breaking layer over V6.8 terrain.
## The single user-supplied textured Meshy GLB is reused as a PackedScene.
## Footprint collisions are cheap BoxShape3D; NO per-triangle house physics.
const BLUEPRINT := "res://assets/environment/village/settlement_v7.json"
const HOUSE_GLB := "res://assets/environment/houses/main_house/rumah_utama.glb"
const GROUND_LAYER := 1 << 7
const BUILDING_LAYER := 1
var building_count := 0
var source_house_count := 0
var finished := false
var _paint: Dictionary = {}

func _mat(pigment: String) -> StandardMaterial3D:
    if _paint.has(pigment):
        return _paint[pigment] as StandardMaterial3D
    var palette := {
        "plinth": Color("9b927e"), "wood": Color("8d6245"),
        "wood_dark": Color("71513c"), "roof": Color("aa6750"),
        "awning": Color("d5b585"), "fishing": Color("7f9d9c"),
        "ochre": Color("b69e71"), "rope": Color("c6ac75")
    }
    var material := StandardMaterial3D.new()
    material.albedo_color = palette.get(pigment, Color.WHITE)
    material.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
    material.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
    material.roughness = 0.96
    material.metallic = 0.0
    _paint[pigment] = material
    return material

func _box(root: Node3D, name: String, offset: Vector3, size: Vector3, pigment: String) -> void:
    var object := MeshInstance3D.new()
    object.name = name
    var shape := BoxMesh.new()
    shape.size = size
    object.mesh = shape
    object.material_override = _mat(pigment)
    object.position = offset
    root.add_child(object)

func _probe_ground(world: Node3D, x: float, z: float) -> Dictionary:
    var query := PhysicsRayQueryParameters3D.create(
        Vector3(x, 120.0, z), Vector3(x, -40.0, z))
    query.collision_mask = GROUND_LAYER
    return world.get_world_3d().direct_space_state.intersect_ray(query)

func _bounds(root: Node3D) -> AABB:
    var minimum := Vector3(INF, INF, INF)
    var maximum := Vector3(-INF, -INF, -INF)
    for child in root.find_children("*", "MeshInstance3D", true, false):
        var mesh := child as MeshInstance3D
        if mesh.mesh == null:
            continue
        var aabb := mesh.get_aabb()
        for corner_id in range(8):
            var corner := aabb.position + Vector3(
                aabb.size.x if corner_id & 1 else 0.0,
                aabb.size.y if corner_id & 2 else 0.0,
                aabb.size.z if corner_id & 4 else 0.0)
            var at := root.to_local(mesh.to_global(corner))
            minimum = minimum.min(at)
            maximum = maximum.max(at)
    if minimum.x == INF:
        return AABB()
    return AABB(minimum, maximum - minimum)

func _material_variant(model: Node3D, index: int, kind: String) -> void:
    var tones := [
        Color("fffdf1"), Color("f3ebdb"), Color("ede8e1"),
        Color("e5e8dc"), Color("f3e2d5"), Color("dce5df")
    ]
    var tint: Color = tones[index % tones.size()]
    if kind == "fishing":
        tint = Color("d7e8e6")
    elif kind == "farm":
        tint = Color("e2ddc2")
    elif kind == "public":
        tint = Color("fff1d8")
    elif kind == "home" and index == 0:
        tint = Color("dad8c6")
    for node in model.find_children("*", "MeshInstance3D", true, false):
        var mesh := node as MeshInstance3D
        if mesh.mesh == null:
            continue
        for s in range(mesh.mesh.get_surface_count()):
            var original := mesh.get_active_material(s) as BaseMaterial3D
            if original != null:
                var painted := original.duplicate() as BaseMaterial3D
                painted.albedo_color = tint
                painted.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
                painted.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
                painted.metallic = 0.0
                painted.roughness = 0.94
                mesh.set_surface_override_material(s, painted)

func _collision(house: Node3D, dimensions: Vector3) -> void:
    var body := StaticBody3D.new()
    body.name = "BuildingCollision"
    body.collision_layer = BUILDING_LAYER
    body.collision_mask = 0
    house.add_child(body)
    var block := CollisionShape3D.new()
    block.name = "PhysicalWalls"
    var box := BoxShape3D.new()
    box.size = dimensions
    block.shape = box
    block.position.y = dimensions.y * 0.5 + 0.04
    body.add_child(block)

func _accessories(house: Node3D, kind: String, foot: Vector2) -> void:
    if kind == "farm":
        _box(house,"PetiPadi",Vector3(foot.x*0.38,0.32,-foot.y*0.26),
            Vector3(0.92,0.62,0.72),"wood")
        _box(house,"KotakPerkakas",Vector3(foot.x*0.38,0.24,foot.y*0.12),
            Vector3(0.64,0.47,0.62),"wood_dark")
    elif kind == "public":
        for side in [-1.0,1.0]:
            _box(house,"TiangBalai",Vector3(side*foot.x*0.46,1.42,foot.y*0.10),
                Vector3(0.13,2.80,0.13),"wood")
        _box(house,"PapanBalaiDesa",Vector3(0.0,2.65,foot.y*0.28),
            Vector3(2.7,0.50,0.11),"ochre")
    elif kind == "fishing":
        for i in range(2):
            _box(house,"PetiPerahu",Vector3(foot.x*0.39,0.27,(-0.18 + i*0.25)*foot.y),
                Vector3(0.55,0.52,0.64),"wood")
        _box(house,"RakJaring",Vector3(-foot.x*0.39,1.07,foot.y*0.02),
            Vector3(0.13,1.88,1.30),"rope")
        if str(house.name) == "warung_pesisir":
            _box(house,"KanopiWarung",Vector3(0.0,2.70,foot.y*0.43),
                Vector3(foot.x*0.67,0.13,1.20),"awning")
    elif kind == "home":
        if str(house.name) != "rumah_masa_kecil":
            _box(house,"BangkuTeras",Vector3(-foot.x*0.27,0.40,foot.y*0.42),
                Vector3(1.12,0.23,0.37),"wood_dark")

func _build_watch_post(house: Node3D) -> void:
    # The 17th structure is an independent tiny village watch post beside
    # balai desa, never in the communal open square.
    _box(house,"PondasiPos",Vector3(0.0,0.08,0.0),
        Vector3(2.30,0.16,2.16),"plinth")
    _box(house,"DindingBelakang",Vector3(0,1.22,-0.94),
        Vector3(2.19,2.12,0.15),"wood")
    for x in [-0.99,0.99]:
        _box(house,"TiangPos",Vector3(x,1.32,0.89),
            Vector3(0.17,2.55,0.17),"wood_dark")
    _box(house,"AtapPosKiri",Vector3(-0.61,2.77,0),
        Vector3(1.45,0.17,2.80),"roof")
    _box(house,"AtapPosKanan",Vector3(0.61,2.77,0),
        Vector3(1.45,0.17,2.80),"roof")
    _box(house,"BangkuPos",Vector3(0,0.53,0.32),
        Vector3(1.55,0.19,0.45),"wood")
    _collision(house,Vector3(2.06,2.45,1.78))

func configure(world: Node3D) -> void:
    if finished:
        return
    if not FileAccess.file_exists(BLUEPRINT):
        push_error("V7 SETTLEMENT FAIL: missing authoritative settlement layout")
        return
    var data = JSON.parse_string(FileAccess.get_file_as_string(BLUEPRINT))
    if not (data is Dictionary):
        push_error("V7 SETTLEMENT FAIL: malformed settlement blueprint")
        return
    var buildings: Array = data.get("buildings",[])
    if buildings.size() != 17 or str(data.get("open_space","")) != "lapangan_berkumpul":
        push_error("V7 SETTLEMENT FAIL: expected 17 structures and preserved open square")
        return
    var packed := load(HOUSE_GLB) as PackedScene
    if packed == null:
        push_error("V7 SETTLEMENT FAIL: user's original textured house GLB unavailable")
        return
    var unique: Dictionary = {}
    for i in range(buildings.size()):
        var plot: Dictionary = buildings[i]
        var label := str(plot["id"])
        if unique.has(label) or label == "lapangan_berkumpul":
            push_error("V7 SETTLEMENT FAIL: duplicate/blocked building site "+label)
            return
        unique[label] = true
        var center: Array = plot["center"]
        var x := float(center[0])
        var z := float(center[1])
        var foot: Array = plot["foot"]
        var footprint := Vector2(float(foot[0]),float(foot[1]))
        var ground := _probe_ground(world,x,z)
        if ground.is_empty() or float(ground.position.y) < 0.85 or float(ground.normal.y) < 0.80:
            push_error("V7 SETTLEMENT FAIL: no dry level ground at "+label)
            return
        var house := Node3D.new()
        house.name = label
        house.position = ground.position
        house.rotation.y = deg_to_rad(float(plot["yaw"]))
        add_child(house)
        house.set_meta("plot_kind",str(plot["kind"]))
        house.set_meta("ground_y",ground.position.y)
        var kind := str(plot["kind"])
        if kind == "watch_post":
            _build_watch_post(house)
        else:
            var model := packed.instantiate() as Node3D
            if model == null:
                push_error("V7 SETTLEMENT FAIL: imported original house is not Node3D")
                return
            model.name = "OriginalTexturedHouse"
            house.add_child(model)
            var b := _bounds(model)
            if b.size.x < 0.01 or b.size.z < 0.01 or b.size.y < 0.01:
                push_error("V7 SETTLEMENT FAIL: invalid imported GLB bounds")
                return
            var factor := minf(footprint.x*0.82/b.size.x,footprint.y*0.76/b.size.z)
            model.scale = Vector3.ONE * factor
            model.position = Vector3(-(b.position.x+b.size.x*0.5)*factor,
                -b.position.y*factor+0.10,
                -(b.position.z+b.size.z*0.5)*factor)
            _material_variant(model,i,kind)
            _box(house,"StoneFoundation",Vector3(0,0,0),
                Vector3(footprint.x*0.81,0.20,footprint.y*0.78),"plinth")
            _collision(house,Vector3(footprint.x*0.68,
                clampf(b.size.y*factor*0.70,1.9,4.6),footprint.y*0.64))
            _accessories(house,kind,footprint)
            source_house_count += 1
        building_count += 1
    set_meta("building_count",building_count)
    set_meta("house_glb_count",source_house_count)
    finished = true
    print("V7 SETTLEMENT PASS: ",building_count,
        " actual buildings (",source_house_count,
        " reused textured GLB + 1 watch post), 16 physical house pads; lapangan open")
