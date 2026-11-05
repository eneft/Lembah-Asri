extends Node3D
## Lembah Asri V7.0 settlement — separate, non-breaking layer over V6.8 terrain.
## The single user-supplied textured Meshy GLB is reused as a PackedScene.
## Footprint collisions are cheap BoxShape3D; NO per-triangle house physics.
const BLUEPRINT := "res://assets/environment/village/settlement_v7.json"
const HOUSE_GLB := "res://assets/environment/houses/main_house/rumah_utama.glb"
# FULL-TOPOLOGY repair of the user's Meshy GLB. Preserve the original
# 95,121 triangles and UVs; resample painted albedo 8192px -> 2048px JPEG,
# subtle normals 4096px -> 1024px. Do NOT use the destroyed 1,800-face
# vertex-color silhouette (it looks like a crumpled tent in gameplay).
# Original model stays a single unique cottage, not duplicated across sites.
const FISHERMAN_GLB := "res://assets/environment/houses/fisherman_meshy/fisherman_original_uv.glb"
# Optional Work-optimized source. Missing files leave the proven V8.2 Balai Desa untouched.
const BALAI_2K_GLB := "res://assets/environment/houses/village_head/LembahAsri_Game_2K.glb"
const ARCHITECTURE_SCRIPT := preload("res://scripts/terrain_v7_architecture.gd")
const GROUND_LAYER := 1 << 7
const BUILDING_LAYER := 1
# Human-height architectural reference. This is a REAL world height, not an
# arbitrary scale multiplier; 1 Godot unit is 1 meter throughout V7.5+.
const ADULT_HEIGHT_M := 1.68
const CHILDHOOD_HOUSE_HEIGHT_M := 4.48
const CHILDHOOD_HOUSE_WIDTH_M := 7.25
const CHILDHOOD_HOUSE_DEPTH_M := 6.10
var building_count := 0
var source_house_count := 0
var unique_house_count := 0
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
                # Preserve imported pigments, especially roof and timber,
                # instead of washing EVERY original GLB surface one color.
                var original_pigment: Color = original.albedo_color
                painted.albedo_color = original_pigment.lerp(original_pigment * tint,0.15)
                painted.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
                painted.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
                painted.metallic = 0.0
                painted.roughness = 0.94
                # The corrected fisherman GLB uses original UV textures.
                # Vertex colors are not a substitute for this painted atlas.
                if painted is StandardMaterial3D and original.albedo_texture == null:
                    (painted as StandardMaterial3D).vertex_color_use_as_albedo = true
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
            _box(house,"TiangBalai",Vector3(side*foot.x*0.46,1.74,foot.y*0.10),
                Vector3(0.13,3.44,0.13),"wood")
        _box(house,"PapanBalaiDesa",Vector3(0.0,3.18,foot.y*0.28),
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
        Vector3(2.19,2.28,0.15),"wood")
    for x in [-0.99,0.99]:
        _box(house,"TiangPos",Vector3(x,1.43,0.89),
            Vector3(0.17,2.77,0.17),"wood_dark")
    _box(house,"AtapPosKiri",Vector3(-0.61,2.95,0),
        Vector3(1.45,0.17,2.80),"roof")
    _box(house,"AtapPosKanan",Vector3(0.61,2.95,0),
        Vector3(1.45,0.17,2.80),"roof")
    _box(house,"BangkuPos",Vector3(0,0.53,0.32),
        Vector3(1.55,0.19,0.45),"wood")
    _collision(house,Vector3(2.06,2.62,1.78))


# Swap only the Balai Desa visual. Preserve the already-authored footprint,
# the exact plot/yaw, the existing cheap BuildingCollision and area streaming.
# The source is OPTIONAL until its verified 14.4MB binary is uploaded.
func _install_balai_desa_2k(house: Node3D, footprint: Vector2) -> bool:
    if not ResourceLoader.exists(BALAI_2K_GLB):
        return false
    var packed := load(BALAI_2K_GLB) as PackedScene
    if packed == null:
        push_error("BALAI 2K: file exists but is not an importable GLB scene")
        return false
    var model := packed.instantiate() as Node3D
    if model == null:
        push_error("BALAI 2K: imported GLB has no Node3D root")
        return false
    model.name = "MeshyBalaiDesa2K"
    house.add_child(model)
    var bounds := _bounds(model)
    if bounds.size.x <= 0.01 or bounds.size.y <= 0.01 or bounds.size.z <= 0.01:
        model.free()
        push_error("BALAI 2K: invalid mesh bounds; retaining existing Balai Desa")
        return false
    # Require a genuine UV-textured source; a plain-color fallback may hide
    # broken texture imports and must not silently replace the painted hall.
    var textured_surfaces := 0
    for item in model.find_children("*", "MeshInstance3D", true, false):
        var mesh := item as MeshInstance3D
        if mesh.mesh == null:
            continue
        for surface in range(mesh.mesh.get_surface_count()):
            var material := mesh.get_active_material(surface) as BaseMaterial3D
            if material != null and material.albedo_texture != null:
                textured_surfaces += 1
    if textured_surfaces == 0:
        model.free()
        push_error("BALAI 2K: no imported albedo texture; retaining existing Balai Desa")
        return false
    # 1 Godot unit = 1 metre. Constrain roof/porch to the existing plot and
    # bring the full building to a plausible 4.85m height for a 1.68m avatar.
    # X/Z are scaled uniformly so the original model isn't warped.
    var horizontal_scale := minf(footprint.x * 0.95 / bounds.size.x,
        footprint.y * 0.92 / bounds.size.z)
    var vertical_scale := 4.85 / bounds.size.y
    if horizontal_scale <= 0.0 or vertical_scale <= 0.0:
        model.free()
        return false
    model.scale = Vector3(horizontal_scale, vertical_scale, horizontal_scale)
    model.position = Vector3(
        -(bounds.position.x + bounds.size.x * 0.5) * horizontal_scale,
        -bounds.position.y * vertical_scale + 0.06,
        -(bounds.position.z + bounds.size.z * 0.5) * horizontal_scale)
    var old_visual := house.get_node_or_null("UniqueVillageMesh")
    if old_visual == null:
        model.free()
        push_error("BALAI 2K: original authored visual missing; refusing unsafe swap")
        return false
    house.remove_child(old_visual)
    old_visual.free()
    house.set_meta("balai_2k_active", true)
    house.set_meta("balai_2k_source", "LembahAsri_Game_2K.glb")
    house.set_meta("balai_2k_full_height_m", 4.85)
    house.set_meta("balai_2k_textured_surfaces", textured_surfaces)
    print("BALAI 2K ACTIVE: Work-optimized GLB, collision and V8 area unchanged")
    return true

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
    var fisherman_packed := load(FISHERMAN_GLB) as PackedScene
    if fisherman_packed == null:
        push_error("V7 FISHERMAN FAIL: optimized uploaded fisherman GLB unavailable")
        return
    var architecture := ARCHITECTURE_SCRIPT.new()
    var unique: Dictionary = {}
    var geometry_signatures: Dictionary = {}
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
        elif label == "rumah_masa_kecil":
            # Keep the one original user's Meshy GLB as a UNIQUE nostalgic home.
            var model := packed.instantiate() as Node3D
            if model == null:
                push_error("V7.2 SETTLEMENT FAIL: original childhood house invalid")
                return
            model.name = "OriginalTexturedHouse"
            house.add_child(model)
            var b := _bounds(model)
            if b.size.x < 0.01 or b.size.z < 0.01 or b.size.y < 0.01:
                push_error("V7.2 SETTLEMENT FAIL: original childhood GLB bounds invalid")
                return
            # V7.6: the unique childhood GLB previously scaled ONLY to the
            # 10m plot and might tower over (or dwarf) a 1.68m adult. Fit the
            # existing model without replacing its textured mesh. V8.2 raises
            # the overall height to 4.48m while preserving X/Z footprints.
            # The height normalization is separate because generated GLB
            # source units need not be metres; the ground footprint still
            # controls width/depth and preserves surrounding walkable yards.
            var xz_factor := minf(
                minf(CHILDHOOD_HOUSE_WIDTH_M/b.size.x,
                     CHILDHOOD_HOUSE_DEPTH_M/b.size.z),
                minf(footprint.x*0.77/b.size.x,footprint.y*0.76/b.size.z))
            var y_factor := CHILDHOOD_HOUSE_HEIGHT_M/b.size.y
            model.scale = Vector3(xz_factor,y_factor,xz_factor)
            model.position = Vector3(-(b.position.x+b.size.x*0.5)*xz_factor,
                -b.position.y*y_factor+0.10,
                -(b.position.z+b.size.z*0.5)*xz_factor)
            _material_variant(model,i,kind)
            var actual_width := b.size.x*xz_factor
            var actual_depth := b.size.z*xz_factor
            var actual_height := b.size.y*y_factor
            _box(house,"StoneFoundation",Vector3(0,0.0,0),
                Vector3(actual_width*0.94,0.20,actual_depth*0.92),"plinth")
            _collision(house,Vector3(actual_width*0.83,
                clampf(actual_height*0.72,2.75,3.25),actual_depth*0.79))
            house.set_meta("building_width_m",actual_width)
            house.set_meta("building_depth_m",actual_depth)
            house.set_meta("building_height_m",actual_height)
            house.set_meta("proportion_revision","V8.2")
            print("V7.6 CHILDHOOD HOUSE: body %.2f x %.2f x %.2fm, avatar %.2fm" % [
                actual_width,actual_depth,actual_height,ADULT_HEIGHT_M])
            source_house_count += 1
        elif label == "rumah_nelayan_01":
            # Replace ONLY this fishing cottage with the supplied Meshy GLB.
            # Keep the other fishing house distinctive. No plot, yaw, player,
            # terrain, bridge or physics layer is repositioned.
            var model := fisherman_packed.instantiate() as Node3D
            if model == null:
                push_error("V7 FISHERMAN FAIL: optimized fisherman scene invalid")
                return
            model.name = "MeshyFishermanHouse"
            house.add_child(model)
            var b := _bounds(model)
            if b.size.x <= 0.01 or b.size.y <= 0.01 or b.size.z <= 0.01:
                push_error("V7 FISHERMAN FAIL: fisherman geometry is empty")
                return
            # 1 Godot unit = 1 metre. Fit the original generated proportions
            # into the ORIGINAL 8 x 6.5m plot, keeping yard and footpaths open.
            # Normalization is needed since Meshy models use arbitrary units.
            # V8.2: screenshot shows the imported doorway and eaves too low
            # against a REAL 1.68m avatar. The source GLB is a single baked,
            # non-segmented 95k UV mesh, so door and wall cannot be changed
            # independently without rebuilding that mesh. Raise local Y by
            # 24% while protecting the ~6.5m deep existing coastal plot.
            # Retain original vertices, UV, painted atlas and fishery props;
            # X/Z stay UNIFORM so the footprint/shoreline does not stretch.
            var factor := minf(3.60 / b.size.y,
                minf(footprint.x * 0.76 / b.size.x,
                     footprint.y * 0.955 / b.size.z))
            var vertical_factor := 1.24
            model.scale = Vector3(factor,factor*vertical_factor,factor)
            var width := b.size.x * factor
            var depth := b.size.z * factor
            var height := b.size.y * model.scale.y
            model.position = Vector3(
                -(b.position.x+b.size.x*0.5)*model.scale.x,
                -b.position.y*model.scale.y+0.06,
                -(b.position.z+b.size.z*0.5)*model.scale.z)
            _material_variant(model,i,kind)
            # Retain a single cheap solid building collider, never the full
            # scanned triangle surface: critical on WebGL/iPhone.
            _collision(house,Vector3(width*0.87,3.20,depth*0.83))
            house.set_meta("building_width_m",width)
            house.set_meta("building_depth_m",depth)
            house.set_meta("building_height_m",height)
            house.set_meta("proportion_revision","V8.2")
            house.set_meta("fisherman_source","Meshy_AI_Lembah_Asri_Fisherman_1103160840_texture.glb")
            house.set_meta("fisherman_optimized_triangles",95121)
            house.set_meta("fisherman_texture_uv",true)
            house.set_meta("fisherman_repaired_asset","original_Meshy_full_topology_2048_JPEG")
            geometry_signatures["meshy_fisherman_1103160840_uv_repaired"] = label
            unique_house_count += 1
            print("V7.8 FISHERMAN UV REPAIR PASS: 95121 original triangles, original UV, %.2f x %.2f x %.2fm, player 1.68m" % [width,depth,height])
        else:
            # Authored 3D mesh variants from the pre-existing village-art kit,
            # not another instance of the childhood-house GLB.
            var built: Dictionary = architecture.build_unique(house,label,kind,footprint)
            if built.is_empty():
                push_error("V7.2 SETTLEMENT FAIL: missing architecture for "+label)
                return
            var signature := str(built["signature"])
            if geometry_signatures.has(signature):
                push_error("V7.2 SETTLEMENT FAIL: duplicate physical architecture "+label)
                return
            geometry_signatures[signature] = label
            var real_footprint: Vector2 = built["actual_footprint"]
            var body_dimensions: Vector3 = built["body_dimensions"]
            # Build/collision dimensions remain from the original V8.2 hall.
            # Only the Balai Desa visual may be replaced, and only when the
            # Work-optimized 2K GLB actually imports with valid textures.
            var balai_2k_active := false
            if label == "balai_desa":
                balai_2k_active = _install_balai_desa_2k(house,real_footprint)
            _collision(house,body_dimensions)
            # Avoid duplicating the old procedural sign/pillars over the new
            # imported Balai Desa. Other 16 building visuals are unchanged.
            if not balai_2k_active:
                _accessories(house,kind,real_footprint)
            house.set_meta("building_width_m",real_footprint.x)
            house.set_meta("building_depth_m",real_footprint.y)
            house.set_meta("wall_height_m",body_dimensions.y)
            house.set_meta("proportion_revision","V8.2")
            unique_house_count += 1
        house.set_meta("proportion_reference_adult_m",ADULT_HEIGHT_M)
        house.set_meta("plot_center_m",Vector2(x,z))
        house.set_meta("proportion_revision","V8.2")
        building_count += 1
    set_meta("building_count",building_count)
    set_meta("house_glb_count",source_house_count)
    set_meta("unique_house_count",unique_house_count)
    finished = true
    print("V7.2 SETTLEMENT PASS: ",building_count," buildings; ",source_house_count,
        " original childhood GLB + ",unique_house_count,
        " individually distinct buildings (1 imported fisherman) + 1 pos ronda; lapangan open")
