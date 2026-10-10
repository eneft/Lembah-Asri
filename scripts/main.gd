extends Node3D
## Lembah Asri — Godot 4 starter. Shapes are placeholders, not final art.
## Locked view: high three-quarter camera, small character, readable village paths.

const PLAYER_SCENE = preload("res://scenes/player.tscn")
const CAMERA_HEIGHT := 20.0
const CAMERA_DEPTH := 14.0

var player: CharacterBody3D
var camera: Camera3D
var dialogue_label: Label
var interaction_label: Label
var npcs: Array[Node3D] = []
var dialogue_timer := 0.0
var npc_lines := [
    "Pak Darto: Wah, akhirnya pulang lagi! Selamat datang di Lembah Asri.",
    "Bu Sari: Dulu kamu sering bermain di halaman ini. Apa masih ingat?",
    "Nenek Minten: Rumah yang lama kosong itu akhirnya ramai lagi, Nak."
]

func _ready() -> void:
    _make_light()
    _make_floor()
    _make_village()
    player = PLAYER_SCENE.instantiate()
    player.position = Vector3(0.0, 0.2, 6.0)
    add_child(player)
    camera = Camera3D.new()
    camera.current = true
    camera.fov = 47.0
    camera.far = 250.0
    add_child(camera)
    _make_ui()

func _process(delta: float) -> void:
    if is_instance_valid(player):
        var focus := player.global_position + Vector3(0.0, 0.8, 0.0)
        var target_pos := focus + Vector3(0.0, CAMERA_HEIGHT, CAMERA_DEPTH)
        camera.global_position = camera.global_position.lerp(target_pos, min(1.0, delta * 7.0))
        camera.look_at(focus, Vector3.UP)
        _update_interaction_hint()
    if dialogue_timer > 0.0:
        dialogue_timer -= delta
        dialogue_label.visible = true
    else:
        dialogue_label.visible = false

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_E:
        var closest := _nearest_npc()
        if closest != null:
            var idx: int = closest.get_meta("line_idx", 0)
            dialogue_label.text = npc_lines[idx]
            dialogue_timer = 4.5

func _nearest_npc() -> Node3D:
    if not is_instance_valid(player):
        return null
    var closest: Node3D = null
    var best := 2.4
    for npc in npcs:
        var distance := npc.global_position.distance_to(player.global_position)
        if distance < best:
            best = distance
            closest = npc
    return closest

func _update_interaction_hint() -> void:
    if _nearest_npc() == null:
        interaction_label.text = "WASD / Panah: Jalan   •   E: Bicara saat dekat warga"
    else:
        interaction_label.text = "[E] Bicara dengan warga"

func _mat(color: Color) -> StandardMaterial3D:
    var material := StandardMaterial3D.new()
    material.albedo_color = color
    material.roughness = 1.0
    return material

func _box(size: Vector3, at: Vector3, color: Color, parent: Node3D = null) -> MeshInstance3D:
    var mesh_instance := MeshInstance3D.new()
    var mesh := BoxMesh.new()
    mesh.size = size
    mesh_instance.mesh = mesh
    mesh_instance.material_override = _mat(color)
    mesh_instance.position = at
    if parent == null:
        add_child(mesh_instance)
    else:
        parent.add_child(mesh_instance)
    return mesh_instance

func _sphere(radius: float, at: Vector3, color: Color, parent: Node3D = null) -> MeshInstance3D:
    var mesh_instance := MeshInstance3D.new()
    var mesh := SphereMesh.new()
    mesh.radius = radius
    mesh.height = radius * 2.0
    mesh.radial_segments = 12
    mesh.rings = 6
    mesh_instance.mesh = mesh
    mesh_instance.material_override = _mat(color)
    mesh_instance.position = at
    if parent == null:
        add_child(mesh_instance)
    else:
        parent.add_child(mesh_instance)
    return mesh_instance

func _make_light() -> void:
    var sunlight := DirectionalLight3D.new()
    sunlight.light_energy = 1.2
    sunlight.rotation_degrees = Vector3(-45.0, 28.0, 0.0)
    sunlight.shadow_enabled = true
    add_child(sunlight)
    var sky := WorldEnvironment.new()
    var env := Environment.new()
    env.background_mode = Environment.BG_COLOR
    env.background_color = Color("b1d8ed")
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color("e7e4cc")
    env.ambient_light_energy = 0.75
    sky.environment = env
    add_child(sky)

func _make_floor() -> void:
    var floor_body := StaticBody3D.new()
    floor_body.name = "WalkableGround"
    floor_body.position.y = -0.45
    add_child(floor_body)
    _box(Vector3(64.0, 0.9, 64.0), Vector3.ZERO, Color("85a862"), floor_body)
    var floor_collision := CollisionShape3D.new()
    var floor_shape := BoxShape3D.new()
    floor_shape.size = Vector3(64.0, 0.9, 64.0)
    floor_collision.shape = floor_shape
    floor_body.add_child(floor_collision)
    _box(Vector3(45.0, 0.07, 2.7), Vector3(0, 0.035, -2.4), Color("c6ac7e"))
    _box(Vector3(3.0, 0.08, 23.0), Vector3(-3.5, 0.05, 2.8), Color("c6ac7e"))

func _make_village() -> void:
    _make_house(Vector3(-11.0, 0.0, -11.0))
    _make_farm()
    _make_chicken_coop(Vector3(11.0, 0.0, -8.0))
    _make_water()
    for tree_pos in [Vector3(-20, 0, -19), Vector3(18, 0, -18), Vector3(20, 0, 10), Vector3(-19, 0, 12), Vector3(14, 0, 17)]:
        _make_tree(tree_pos)
    for idx in range(3):
        _make_npc(Vector3(-3.0 + idx * 7.0, 0.0, -7.0 - idx * 4.0), idx)
    for i in range(14):
        _sphere(0.18, Vector3(-14.5 + i * 2.1, 0.18, 12.7), Color("f0ce8e") if i % 2 == 0 else Color("f4b5ba"))

func _make_house(at: Vector3) -> void:
    var house := Node3D.new()
    house.name = "RumahMasaKecil_Placeholder"
    house.position = at
    add_child(house)
    _box(Vector3(9, 4, 7), Vector3(0, 2, 0), Color("e8d7b5"), house)
    var roof_left := _box(Vector3(5.3, 0.38, 8.5), Vector3(-2.2, 4.8, 0), Color("b75e43"), house)
    roof_left.rotation.z = -0.36
    var roof_right := _box(Vector3(5.3, 0.38, 8.5), Vector3(2.2, 4.8, 0), Color("b75e43"), house)
    roof_right.rotation.z = 0.36
    _box(Vector3(1.5, 2.7, 0.1), Vector3(0, 1.4, 3.55), Color("7b5437"), house)
    _box(Vector3(2, 1.5, 0.12), Vector3(-2.6, 2.3, 3.55), Color("8eb9bd"), house)

func _make_farm() -> void:
    for row in range(4):
        for col in range(7):
            var x := -10.5 + float(col) * 1.75
            var z := 5.0 + float(row) * 1.8
            _box(Vector3(1.55, 0.10, 1.55), Vector3(x, 0.08, z), Color("6e4c32"))
            if (row + col) % 4 != 0:
                var green := Color("4f934c") if col % 2 == 0 else Color("83b954")
                _sphere(0.3 + float((row + col) % 3) * 0.065, Vector3(x, 0.48, z), green)

func _make_chicken_coop(at: Vector3) -> void:
    var coop := Node3D.new()
    coop.name = "Kandang_Ternak_Placeholder"
    coop.position = at
    add_child(coop)
    _box(Vector3(6, 2.2, 4.5), Vector3(0, 1.1, 0), Color("9f7650"), coop)
    var roof := _box(Vector3(6.6, 0.35, 5), Vector3(0, 2.5, 0), Color("bd704e"), coop)
    roof.rotation.z = -0.08
    for i in range(4):
        _sphere(0.36, Vector3(-1.8 + i * 1.15, 0.38, 3.4), Color("f4dfb1"), coop)

func _make_water() -> void:
    _box(Vector3(5, 0.1, 39), Vector3(18, 0.01, 0), Color("74b6c8"))
    _box(Vector3(8, 0.38, 2.7), Vector3(18, 0.36, -3.8), Color("99734f"))

func _make_tree(at: Vector3) -> void:
    var tree := Node3D.new()
    tree.position = at
    add_child(tree)
    _box(Vector3(0.7, 4.2, 0.7), Vector3(0, 2.1, 0), Color("a37a4a"), tree)
    _sphere(2.0, Vector3(-0.7, 4.35, 0), Color("4f9160"), tree)
    _sphere(2.3, Vector3(0.9, 4.55, 0.6), Color("6fac65"), tree)
    _sphere(1.8, Vector3(0, 5.15, -0.7), Color("79b56a"), tree)

func _make_npc(at: Vector3, idx: int) -> void:
    var npc := Node3D.new()
    npc.name = ["PakDarto_Placeholder", "BuSari_Placeholder", "NenekMinten_Placeholder"][idx]
    npc.position = at
    npc.set_meta("line_idx", idx)
    add_child(npc)
    var colors := [Color("b17a50"), Color("d88c86"), Color("a995c7")]
    _box(Vector3(0.8, 1.15, 0.55), Vector3(0, 1.1, 0), colors[idx], npc)
    _sphere(0.45, Vector3(0, 2.05, 0), Color("d9b08d"), npc)
    npcs.append(npc)

func _make_ui() -> void:
    var layer := CanvasLayer.new()
    add_child(layer)
    var hud := Label.new()
    hud.text = "LEMBAH ASRI | Prototipe kamera 3/4 | Desa Indonesia"
    hud.position = Vector2(22, 18)
    hud.add_theme_font_size_override("font_size", 20)
    hud.add_theme_color_override("font_color", Color("fff4d2"))
    layer.add_child(hud)
    var status := Label.new()
    status.text = "Pagi 07:20  •  Musim Kemarau  •  Rumah Masa Kecil"
    status.position = Vector2(22, 50)
    status.add_theme_font_size_override("font_size", 17)
    status.add_theme_color_override("font_color", Color("fff4d2"))
    layer.add_child(status)
    interaction_label = Label.new()
    interaction_label.position = Vector2(22, 665)
    interaction_label.add_theme_color_override("font_color", Color("fff4d2"))
    interaction_label.add_theme_font_size_override("font_size", 17)
    layer.add_child(interaction_label)
    dialogue_label = Label.new()
    dialogue_label.position = Vector2(22, 612)
    dialogue_label.add_theme_font_size_override("font_size", 20)
    dialogue_label.add_theme_color_override("font_color", Color("ffe6b2"))
    dialogue_label.visible = false
    layer.add_child(dialogue_label)
