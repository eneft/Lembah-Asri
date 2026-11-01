extends Node3D
## Coastal house overlay for the real Lembah Asri island.
## Uses the final fisherman GLB if present. Until the binary is added,
## builds a recognizable low-poly stylized in-engine model for browser testing.
const ORIGINAL_GLB := "res://assets/environment/houses/fisherman/rumah_nelayan.glb"
const COAST_LOT := "07_HOUSE_18_Textured"
const COAST_POSITION := Vector3(32.0, 3.8, 36.0)
const FINAL_SCALE := 0.78

var installed := false

func _ready() -> void:
    _install.call_deferred()

func _material(hex_color: String, metallic: float = 0.0) -> StandardMaterial3D:
    var m := StandardMaterial3D.new()
    m.albedo_color = Color(hex_color)
    m.roughness = 0.87
    m.metallic = metallic
    m.cull_mode = BaseMaterial3D.CULL_DISABLED
    return m

func _box(p: Node3D, label: String, at: Vector3, size: Vector3, mat: Material) -> MeshInstance3D:
    var a := MeshInstance3D.new()
    a.name = label
    var b := BoxMesh.new()
    b.size = size
    a.mesh = b
    a.material_override = mat
    a.position = at
    p.add_child(a)
    return a

func _line(p: Node3D, label: String, a: Vector3, b: Vector3, rad: float, mat: Material) -> void:
    var diff: Vector3 = b - a
    if diff.length() < 0.01:
        return
    var n := MeshInstance3D.new()
    n.name = label
    var cyl := CylinderMesh.new()
    cyl.height = diff.length()
    cyl.bottom_radius = rad
    cyl.top_radius = rad
    cyl.radial_segments = 6
    n.mesh = cyl
    n.material_override = mat
    n.position = (a + b) * 0.5
    n.quaternion = Quaternion(Vector3.UP, diff.normalized())
    p.add_child(n)

func _quad(p: Node3D, label: String, pts: Array[Vector3], mat: Material) -> void:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var order := [0, 1, 2, 0, 2, 3]
    var uv := [Vector2.ZERO, Vector2(0, 1), Vector2.ONE, Vector2(1, 0)]
    for k in order:
        st.set_uv(uv[k])
        st.add_vertex(pts[k])
    st.generate_normals()
    var node := MeshInstance3D.new()
    node.name = label
    node.mesh = st.commit()
    node.material_override = mat
    p.add_child(node)

func _sphere(p: Node3D, label: String, at: Vector3, radius: float, mat: Material) -> void:
    var n := MeshInstance3D.new()
    n.name = label
    var s := SphereMesh.new()
    s.radius = radius
    s.height = 2.0 * radius
    s.radial_segments = 8
    s.rings = 4
    n.mesh = s
    n.position = at
    n.material_override = mat
    p.add_child(n)

func _window_front(p: Node3D, x: float, z: float, mats: Dictionary) -> void:
    var wood: Material = mats["wood"]
    _box(p, "Kaca_Jendela_Depan", Vector3(x, 1.72, z), Vector3(1.24, 1.13, 0.055), mats["glass"])
    for yy in [1.11, 1.72, 2.33]:
        _box(p, "Kusen_Depan_H", Vector3(x, yy, z + 0.075), Vector3(1.43, 0.11, 0.16), wood)
    for xx in [x - 0.67, x, x + 0.67]:
        _box(p, "Kusen_Depan_V", Vector3(xx, 1.72, z + 0.075), Vector3(0.11, 1.31, 0.16), wood)

func _window_side(p: Node3D, x: float, z: float, mats: Dictionary) -> void:
    var wood: Material = mats["wood"]
    var off := 0.10 if x > 0.0 else -0.10
    _box(p, "Kaca_Jendela_Samping", Vector3(x, 1.72, z), Vector3(0.07, 1.13, 1.24), mats["glass"])
    for yy in [1.11, 1.72, 2.33]:
        _box(p, "Kusen_Samping_H", Vector3(x + off, yy, z), Vector3(0.15, 0.11, 1.43), wood)
    for zz in [z - 0.67, z, z + 0.67]:
        _box(p, "Kusen_Samping_V", Vector3(x + off, 1.72, zz), Vector3(0.15, 1.31, 0.11), wood)

func _build_preview_model() -> Node3D:
    var p := Node3D.new()
    p.name = "RumahNelayan_Lowpoly_Stylized"
    add_child(p)
    var m := {
        "blue": _material("257ba5"), "blue_light": _material("378db6"),
        "blue_dark": _material("245d7d"), "wood": _material("c48a45"),
        "wood_dark": _material("855c37"), "glass": _material("244e5b"),
        "roof_gray": _material("9aa5b8", 0.15), "roof_rust": _material("be644b", 0.08),
        "roof_light": _material("d8c8ac", 0.08), "roof_blue": _material("6e8ca6", 0.10),
        "stone": _material("96938d"), "stone_light": _material("b3aaa0"),
        "rope": _material("cfb27e"), "red": _material("dc6942"),
        "white": _material("f4e3bf"), "plant": _material("65894d")
    }
    _box(p, "Pondasi_Batu", Vector3(0, 0.10, 0), Vector3(6.45, 0.35, 5.10), m["stone"])
    _box(p, "Badan_Rumah", Vector3(0, 1.57, 0), Vector3(6.0, 2.60, 4.72), m["blue_dark"])
    for i in range(25):
        var xx := -2.91 + float(i) * 0.242
        var wallmat: Material = m["blue"] if (i % 4 != 0) else m["blue_light"]
        _box(p, "Papan_Depan_%d" % i, Vector3(xx, 1.57, 2.405), Vector3(0.225, 2.58, 0.07), wallmat)
        _box(p, "Papan_Belakang_%d" % i, Vector3(xx, 1.57, -2.405), Vector3(0.225, 2.58, 0.07), wallmat)
    for side in [-1, 1]:
        for i in range(20):
            var zz := -2.29 + float(i) * 0.241
            var wallmat: Material = m["blue"] if i % 5 != 0 else m["blue_light"]
            _box(p, "Papan_Samping_%d_%d" % [side, i], Vector3(float(side) * 3.035, 1.57, zz), Vector3(0.07, 2.58, 0.218), wallmat)
    # Roof ridge runs front-to-back. Each metal panel has real geometry and ribs.
    var roof_colors := [m["roof_gray"], m["roof_rust"], m["roof_light"], m["roof_blue"]]
    for side in [-1, 1]:
        for i in range(12):
            var z0 := -2.76 + float(i) * 0.46
            var z1 := z0 + 0.46
            var material: Material = roof_colors[(i * 5 + (0 if side == -1 else 2)) % 4]
            _quad(p, "Seng_%s_%02d" % ["Kiri" if side == -1 else "Kanan", i], [
                Vector3(0, 4.07, z0), Vector3(0, 4.07, z1),
                Vector3(float(side) * 3.42, 2.90, z1),
                Vector3(float(side) * 3.42, 2.90, z0)
            ], material)
            _line(p, "Gelombang_Seng", Vector3(0, 4.09, z0),
                Vector3(float(side) * 3.42, 2.93, z0), 0.027, m["roof_light"])
    _line(p, "Nok_Atap", Vector3(0, 4.10, -2.82), Vector3(0, 4.10, 2.82), 0.10, m["roof_blue"])
    _quad(p, "Gunungan_Depan", [
        Vector3(-2.98, 2.83, 2.42), Vector3(0, 4.0, 2.42),
        Vector3(2.98, 2.83, 2.42), Vector3(2.98, 2.82, 2.42)
    ], m["blue_dark"])
    # Door at front-left, exactly one front window.
    _box(p, "Pintu_Kayu", Vector3(-1.47, 1.31, 2.53), Vector3(1.08, 2.27, 0.12), m["wood_dark"])
    for dx in [-0.60, 0.60]:
        _box(p, "Kusen_Pintu_Samping", Vector3(-1.47 + dx, 1.34, 2.61), Vector3(0.12, 2.40, 0.16), m["wood"])
    _box(p, "Kusen_Pintu_Atas", Vector3(-1.47, 2.55, 2.61), Vector3(1.32, 0.12, 0.16), m["wood"])
    _sphere(p, "Gagang_Pintu", Vector3(-1.13, 1.23, 2.64), 0.052, m["roof_light"])
    _window_front(p, 1.28, 2.56, m)
    # Two evenly sized and spaced windows on EACH side, zero rear windows.
    for side in [-1, 1]:
        for zz in [-1.07, 1.07]:
            _window_side(p, float(side) * 3.12, zz, m)
    # Lean-to front fishing porch.
    _box(p, "Lantai_Teras", Vector3(-1.57, 0.19, 3.26), Vector3(3.25, 0.18, 1.76), m["wood_dark"])
    _quad(p, "Kanopi_Seng", [
        Vector3(-3.38, 3.13, 2.24), Vector3(-0.21, 3.13, 2.24),
        Vector3(-0.21, 2.74, 4.09), Vector3(-3.38, 2.74, 4.09)
    ], m["roof_gray"])
    for x in [-3.13, -0.46]:
        _box(p, "Tiang_Teras", Vector3(x, 1.46, 3.98), Vector3(0.16, 2.65, 0.16), m["wood"])
        _box(p, "Umpak_Teras", Vector3(x, 0.21, 3.98), Vector3(0.31, 0.42, 0.31), m["stone_light"])
    _box(p, "Bangku_Teras", Vector3(-2.06, 0.51, 3.61), Vector3(1.36, 0.15, 0.42), m["wood"])
    for x in [-2.61, -1.51]:
        _box(p, "Kaki_Bangku", Vector3(x, 0.27, 3.61), Vector3(0.09, 0.42, 0.32), m["wood_dark"])
    # Hand-knotted orange net under canopy (coarse stylized low poly).
    for i in range(8):
        var xf := -3.10 + float(i) * 0.36
        _line(p, "Jaring_Tegak", Vector3(xf, 2.60, 4.04), Vector3(xf + 0.16, 1.88, 4.04), 0.012, m["rope"])
    for i in range(5):
        var yy := 1.93 + float(i) * 0.16
        _line(p, "Jaring_Mendatar", Vector3(-3.08, yy, 4.04), Vector3(-0.35, yy, 4.04), 0.010, m["rope"])
    for i in range(5):
        _sphere(p, "Pelampung_Jaring", Vector3(-3.05 + i * 0.53, 1.91, 4.08), 0.08,
            m["red"] if i % 2 == 0 else m["white"])
    # Lifebuoy front wall.
    for i in range(12):
        var a0 := TAU * float(i) / 12.0
        var a1 := TAU * float(i + 1) / 12.0
        var p0 := Vector3(0.00 + cos(a0) * 0.34, 2.06 + sin(a0) * 0.34, 2.68)
        var p1 := Vector3(0.00 + cos(a1) * 0.34, 2.06 + sin(a1) * 0.34, 2.68)
        _line(p, "Pelampung_Cincin", p0, p1, 0.095, m["white"] if i % 3 == 0 else m["red"])
    # Barrel, rope, tools and box keep silhouette identifiable from afar.
    var drum := MeshInstance3D.new()
    drum.name = "Tong_Nelayan"
    var barrel := CylinderMesh.new()
    barrel.bottom_radius = 0.43
    barrel.top_radius = 0.40
    barrel.height = 0.87
    barrel.radial_segments = 10
    drum.mesh = barrel
    drum.material_override = m["wood_dark"]
    drum.position = Vector3(-0.20, 0.66, 3.08)
    p.add_child(drum)
    _box(p, "Peti_Peralatan", Vector3(2.35, 0.47, 3.02), Vector3(0.75, 0.54, 0.60), m["wood"])
    for i in range(3):
        _line(p, "Bambu_Pancing", Vector3(2.45 + i * 0.17, 0.24, 3.25),
            Vector3(2.90 + i * 0.12, 2.34, 2.62), 0.032, m["wood"])
    # Coarse solid body collider, porch remains walkable.
    var collider := StaticBody3D.new()
    collider.name = "RumahNelayan_Collision"
    p.add_child(collider)
    var cs := CollisionShape3D.new()
    var bs := BoxShape3D.new()
    bs.size = Vector3(5.9, 3.0, 4.48)
    cs.shape = bs
    cs.position = Vector3(0, 1.60, 0)
    collider.add_child(cs)
    return p

func _install() -> void:
    # The existing world builds house lots asynchronously; do not race it.
    await get_tree().physics_frame
    var world := get_parent() as Node3D
    if world == null:
        push_error("RUMAH NELAYAN: Missing world root")
        return
    var village: Node3D = null
    for i in range(240):
        village = world.get_node_or_null("VillageTexturedHouses") as Node3D
        if village != null and village.has_meta("textured_house_count"):
            break
        await get_tree().physics_frame
    var target := COAST_POSITION
    if village != null:
        var old_house := village.get_node_or_null(COAST_LOT) as Node3D
        if old_house != null:
            target = old_house.global_position
            old_house.queue_free()
    global_position = target
    rotation.y = 0.0
    if ResourceLoader.exists(ORIGINAL_GLB):
        var packed := load(ORIGINAL_GLB) as PackedScene
        if packed != null:
            var model := packed.instantiate() as Node3D
            if model != null:
                model.name = "RumahNelayan_GLB_Asli"
                add_child(model)
                model.scale = Vector3.ONE * FINAL_SCALE
                var solid := StaticBody3D.new()
                solid.name = "RumahNelayan_WallCollision"
                add_child(solid)
                var cs := CollisionShape3D.new()
                var bs := BoxShape3D.new()
                bs.size = Vector3(4.9, 2.4, 3.5)
                cs.shape = bs
                cs.position = Vector3(0, 1.2, -0.2)
                solid.add_child(cs)
                installed = true
                print("FISHERMAN HOUSE READY: original GLB installed at ", global_position)
    if not installed:
        _build_preview_model()
        installed = true
        print("FISHERMAN HOUSE READY: procedural stylized browser preview at ", global_position)
    var player := world.get_node_or_null("Player3D") as CharacterBody3D
    if player != null:
        player.global_position = target + Vector3(0, 4.5, 8.0)
        player.velocity = Vector3.ZERO
