extends RefCounted
## Reusable village art kit for the standalone Godot 4.3 3D blockout.
## UV-mapped pitched clay-tile roofs, weathered lime plaster, wood grain,
## a baked-at-runtime painterly albedo + subtle tangent-space normal texture,
## low-poly trunks, stylized broadleaf trees, banana and coconut fronds.
## Textures/materials are cached once; no asset downloads or extra plugins.

const TEX_SIZE := 192

var _materials: Dictionary = {}

func _material(kind: String) -> StandardMaterial3D:
    if _materials.has(kind):
        return _materials[kind] as StandardMaterial3D
    var palette := {
        "plaster": Color("dfcfab"),
        "old_plaster": Color("b7ae87"),
        "roof": Color("ae624b"),
        "wood": Color("77513b"),
        "leaf": Color("608f58"),
        "leaf_light": Color("80a76b"),
        "leaf_dark": Color("46734a"),
        "bark": Color("82694d"),
        "moss": Color("6b8052"),
        "soil": Color("8c6a4d"),
        "stone": Color("baad93"),
    }
    var base: Color = palette.get(kind, Color.WHITE)
    var noise := FastNoiseLite.new()
    noise.seed = 117 + kind.length() * 41
    noise.noise_type = FastNoiseLite.TYPE_SIMPLEX
    noise.frequency = 0.043

    var albedo := Image.create(TEX_SIZE, TEX_SIZE, false, Image.FORMAT_RGBA8)
    var normal := Image.create(TEX_SIZE, TEX_SIZE, false, Image.FORMAT_RGBA8)
    for y in range(TEX_SIZE):
        for x in range(TEX_SIZE):
            var variation := noise.get_noise_2d(float(x), float(y))
            var fine := sin(float(x) * 0.65 + float(y) * 0.23) * 0.025
            var wash := 0.5 + variation * 0.22 + fine
            if kind == "roof":
                # Brick-red interlocking tile rows with staggered vertical joints.
                var row := int(y / 23)
                var joint := (x + (row % 2) * 16) % 32
                if y % 23 < 3 or joint < 2:
                    wash -= 0.30
                elif y % 23 < 6:
                    wash += 0.12
            elif kind == "wood" or kind == "bark":
                wash += sin(float(x) * 0.13 + variation * 4.0) * 0.11
            elif kind == "plaster" or kind == "old_plaster":
                wash -= maxf(0.0, variation * 0.18)
                if kind == "old_plaster" and y > 126 and variation > 0.06:
                    wash -= 0.22
            elif kind.begins_with("leaf"):
                wash += sin(float(x + y) * 0.22) * 0.05
            var color: Color = base.darkened(0.27).lerp(base.lightened(0.16), clampf(wash, 0.0, 1.0))
            albedo.set_pixel(x, y, color)
            # Soft painted relief rather than noisy photorealistic bump.
            var dx := noise.get_noise_2d(float(x + 1), float(y)) - variation
            var dy := noise.get_noise_2d(float(x), float(y + 1)) - variation
            if kind == "roof" and y % 23 < 3:
                dy -= 0.28
            var n := Vector3(-dx * 1.7, -dy * 1.7, 1.0).normalized()
            normal.set_pixel(x, y, Color(n.x * 0.5 + 0.5, n.y * 0.5 + 0.5, n.z * 0.5 + 0.5))
    albedo.generate_mipmaps()
    normal.generate_mipmaps()
    var mat := StandardMaterial3D.new()
    mat.albedo_texture = ImageTexture.create_from_image(albedo)
    mat.normal_enabled = true
    mat.normal_texture = ImageTexture.create_from_image(normal)
    mat.normal_scale = 0.35
    mat.roughness = 0.96
    mat.metallic = 0.0
    mat.cull_mode = BaseMaterial3D.CULL_DISABLED
    mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
    _materials[kind] = mat
    return mat

func _box(parent: Node3D, name: String, pos: Vector3, dims: Vector3, material: String) -> MeshInstance3D:
    var node := MeshInstance3D.new()
    node.name = name
    var mesh := BoxMesh.new()
    mesh.size = dims
    node.mesh = mesh
    node.position = pos
    node.material_override = _material(material)
    parent.add_child(node)
    return node

func _sphere(parent: Node3D, name: String, pos: Vector3, scale: Vector3, material: String) -> void:
    var node := MeshInstance3D.new()
    node.name = name
    var mesh := SphereMesh.new()
    mesh.radial_segments = 9
    mesh.rings = 5
    mesh.radius = 1.0
    mesh.height = 2.0
    node.mesh = mesh
    node.scale = scale
    node.position = pos
    node.material_override = _material(material)
    parent.add_child(node)

func _surface(parent: Node3D, name: String, vertices: Array[Vector3], uv_size: Vector2, material: String) -> void:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var uv := [Vector2(0, 0), Vector2(uv_size.x, 0), Vector2(uv_size.x, uv_size.y), Vector2(0, uv_size.y)]
    var indices := [0, 1, 2, 0, 2, 3] if vertices.size() == 4 else [0, 1, 2]
    for index in indices:
        st.set_uv(uv[index])
        st.add_vertex(vertices[index])
    st.generate_normals()
    st.generate_tangents()
    var node := MeshInstance3D.new()
    node.name = name
    node.mesh = st.commit()
    node.material_override = _material(material)
    parent.add_child(node)

func _branch(parent: Node3D, name: String, start: Vector3, finish: Vector3, base_radius: float, mat: String) -> void:
    var delta := finish - start
    var cylinder := CylinderMesh.new()
    cylinder.height = delta.length()
    cylinder.bottom_radius = base_radius * 1.15
    cylinder.top_radius = base_radius * 0.72
    cylinder.radial_segments = 8
    var node := MeshInstance3D.new()
    node.name = name
    node.mesh = cylinder
    node.material_override = _material(mat)
    node.position = (start + finish) * 0.5
    node.quaternion = Quaternion(Vector3.UP, delta.normalized())
    parent.add_child(node)

func _frond(parent: Node3D, name: String, base: Vector3, heading: Vector3, length: float, width: float, banana: bool, mat: String) -> void:
    # Six-step curved ribbon with wide middle and tapered tip; two-sided shading.
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var sideways := Vector3(-heading.z, 0.0, heading.x).normalized()
    for i in range(6):
        var t0 := float(i) / 6.0
        var t1 := float(i + 1) / 6.0
        var edge_points: Array[Vector3] = []
        for t_index in range(2):
            var t: float = t0 if t_index == 0 else t1
            var lift: float = (0.9 if banana else 0.55) * sin(t * PI) - (0.85 if banana else 1.15) * t * t
            var mid: Vector3 = base + heading * (length * t) + Vector3.UP * lift
            var half_width: float = width * sin(t * PI) * 0.5 + 0.018
            edge_points.append(mid - sideways * half_width)
            edge_points.append(mid + sideways * half_width)
        var points: Array[Vector3] = [edge_points[0], edge_points[1], edge_points[3], edge_points[0], edge_points[3], edge_points[2]]
        var uvs := [Vector2(0, t0), Vector2(1, t0), Vector2(1, t1), Vector2(0, t0), Vector2(1, t1), Vector2(0, t1)]
        for idx in range(6):
            st.set_uv(uvs[idx] * 2.0)
            st.add_vertex(points[idx])
    st.generate_normals()
    st.generate_tangents()
    var leaf := MeshInstance3D.new()
    leaf.name = name
    leaf.mesh = st.commit()
    leaf.material_override = _material(mat)
    parent.add_child(leaf)

func build_house(parent: Node3D, at: Vector3, abandoned: bool) -> Node3D:
    var house := Node3D.new()
    house.name = "RumahMasaKecilTerbengkalai" if abandoned else "RumahKampungJawa"
    house.position = at
    parent.add_child(house)
    _box(house, "DindingKapurBertekstur", Vector3(0, 1.4, 0), Vector3(6.5, 2.8, 5.3),
        "old_plaster" if abandoned else "plaster")
    # One authentic Javanese gable roof, not a tiered Japanese pagoda.
    _surface(house, "GentengTanahLiatKiri", [
        Vector3(-4, 2.76, -3.45), Vector3(-4, 2.76, 3.45),
        Vector3(0, 4.22, 3.45), Vector3(0, 4.22, -3.45)
    ], Vector2(4, 5), "roof")
    _surface(house, "GentengTanahLiatKanan", [
        Vector3(0, 4.22, -3.45), Vector3(0, 4.22, 3.45),
        Vector3(4, 2.76, 3.45), Vector3(4, 2.76, -3.45)
    ], Vector2(4, 5), "roof")
    for z in [-2.66, 2.66]:
        _surface(house, "SegitigaGununganRumah", [
            Vector3(-3.23, 2.79, z), Vector3(3.23, 2.79, z), Vector3(0, 4.01, z)
        ], Vector2(2, 1), "old_plaster" if abandoned else "plaster")
    _branch(house, "BubunganGenteng", Vector3(0, 4.23, -3.6), Vector3(0, 4.23, 3.6), 0.12, "roof")
    # Terrace extends forward; lean-to porch uses slender structural wooden posts.
    _box(house, "LantaiTeras", Vector3(0, 0.10, 3.67), Vector3(7.05, 0.19, 2.5), "stone")
    _surface(house, "KanopiTeras", [
        Vector3(-3.65, 3.14, 2.5), Vector3(-3.65, 2.67, 4.95),
        Vector3(3.65, 2.67, 4.95), Vector3(3.65, 3.14, 2.5)
    ], Vector2(4, 2), "roof")
    for x in [-3.15, 3.15]:
        _branch(house, "TiangKayuTeras", Vector3(x, 0.18, 4.68), Vector3(x, 2.7, 4.68), 0.12, "wood")
        _box(house, "BatuUmpak", Vector3(x, 0.14, 4.68), Vector3(0.45, 0.28, 0.45), "stone")
    _box(house, "PintuKayuTunggal", Vector3(0, 1.26, 2.72), Vector3(1.42, 2.35, 0.14), "wood")
    _box(house, "KusenPintuAtas", Vector3(0, 2.49, 2.83), Vector3(1.72, 0.15, 0.16), "wood")
    for x in [-0.78, 0.78]:
        _box(house, "KusenPintuSamping", Vector3(x, 1.28, 2.85), Vector3(0.13, 2.43, 0.14), "wood")
    _sphere(house, "GagangPintu", Vector3(0.43, 1.22, 2.82), Vector3(0.065, 0.065, 0.065), "stone")
    for x in [-2.05, 2.05]:
        _box(house, "RonggaJendela", Vector3(x, 1.63, 2.72), Vector3(1.16, 1.32, 0.13), "wood")
        _box(house, "BidangKacaGelap", Vector3(x, 1.63, 2.80), Vector3(0.92, 1.09, 0.09), "leaf_dark")
        for dy in [-0.62, 0.62]:
            _box(house, "BingkaiJendelaHorisontal", Vector3(x, 1.63 + dy, 2.84), Vector3(1.35, 0.11, 0.12), "wood")
        for dx in [-0.62, 0.0, 0.62]:
            _box(house, "BingkaiJendelaVertikal", Vector3(x + dx, 1.63, 2.84), Vector3(0.11, 1.31, 0.12), "wood")
        _box(house, "DaunJendelaKisi", Vector3(x - 0.77, 1.63, 2.92), Vector3(0.38, 1.14, 0.10), "wood")
    if abandoned:
        for i in range(8):
            var x := -2.9 + float(i) * 0.81
            if i % 2 == 0:
                _sphere(house, "LumutPadaAtap", Vector3(x, 3.36, 0.3 + float(i % 3)), Vector3(0.29, 0.035, 0.26), "moss")
            _sphere(house, "SemakDiTeras", Vector3(x, 0.24, 4.82), Vector3(0.34, 0.38, 0.31), "leaf_dark")
    var wall := StaticBody3D.new()
    wall.name = "DindingCollision"
    wall.position.y = 1.4
    house.add_child(wall)
    var shape := CollisionShape3D.new()
    var box := BoxShape3D.new()
    box.size = Vector3(6.4, 2.8, 5.1)
    shape.shape = box
    wall.add_child(shape)
    return house

func build_tree(parent: Node3D, at: Vector3, scale_factor: float = 1.0) -> Node3D:
    var tree := Node3D.new()
    tree.name = "PohonTropisBerdaun"
    tree.position = at
    tree.scale = Vector3.ONE * scale_factor
    parent.add_child(tree)
    _branch(tree, "BatangUtama", Vector3.ZERO, Vector3(0.05, 4.1, 0.05), 0.34, "bark")
    for p in [Vector3(-1.6, 4.8, 0.2), Vector3(1.3, 5.2, 0.5), Vector3(0.5, 5.0, -1.4)]:
        _branch(tree, "Cabang", Vector3(0, 3.0, 0), p, 0.13, "bark")
    _sphere(tree, "TajukDaunUtama", Vector3(-0.75, 4.5, 0.3), Vector3(1.65, 1.25, 1.55), "leaf")
    _sphere(tree, "TajukDaunTerang", Vector3(1.05, 4.85, 0.6), Vector3(1.55, 1.45, 1.25), "leaf_light")
    _sphere(tree, "TajukDaunBelakang", Vector3(0.35, 5.30, -0.95), Vector3(1.65, 1.25, 1.45), "leaf_dark")
    _sphere(tree, "TajukPucuk", Vector3(-0.3, 5.9, 0.1), Vector3(1.35, 0.95, 1.1), "leaf_light")
    return tree

func build_palm(parent: Node3D, at: Vector3) -> Node3D:
    var palm := Node3D.new()
    palm.name = "KelapaBerpelepah"
    palm.position = at
    parent.add_child(palm)
    var nodes := [
        Vector3.ZERO, Vector3(0.05, 1.7, -0.03),
        Vector3(0.18, 3.5, -0.13), Vector3(0.52, 6.15, -0.3)
    ]
    for i in range(nodes.size() - 1):
        _branch(palm, "BatangKelapaMelengkung", nodes[i], nodes[i + 1], 0.24 - float(i) * 0.04, "bark")
    var crown: Vector3 = nodes[nodes.size() - 1]
    for i in range(9):
        var angle := TAU * float(i) / 9.0
        var heading := Vector3(cos(angle), 0, sin(angle))
        _frond(palm, "PelepahKelapa", crown, heading, 3.0 + float(i % 3) * 0.35, 0.63, false,
            "leaf" if i % 2 == 0 else "leaf_light")
    for p in [Vector3(0.3, -0.25, 0), Vector3(-0.12, -0.4, 0.22), Vector3(0.15, -0.35, -0.3)]:
        _sphere(palm, "BuahKelapa", crown + p, Vector3(0.17, 0.19, 0.18), "bark")
    return palm

func build_banana(parent: Node3D, at: Vector3) -> Node3D:
    var banana := Node3D.new()
    banana.name = "PohonPisang"
    banana.position = at
    parent.add_child(banana)
    _branch(banana, "PelepahBatangPisang", Vector3.ZERO, Vector3(0.07, 2.55, 0), 0.22, "leaf_dark")
    for i in range(7):
        var angle := TAU * float(i) / 7.0 + 0.2
        var heading := Vector3(cos(angle), 0, sin(angle))
        var start := Vector3(0.07, 2.37 + float(i % 3) * 0.13, 0)
        _frond(banana, "DaunPisangLebar", start, heading, 2.05 + float(i % 2) * 0.55, 0.9, true,
            "leaf_light" if i % 3 == 0 else "leaf")
    return banana
