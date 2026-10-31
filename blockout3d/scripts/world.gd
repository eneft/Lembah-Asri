extends Node3D
## Standalone Godot 4.3 world: new isometric 3D village blockout, NOT legacy 2D.
## All meshes are temporary authored placeholders with named scene regions.
const PLAYER_SCRIPT = preload("res://scripts/player.gd")
const TERRACOTTA := Color("b46748")
const EARTH := Color("c1a479")
const WOOD := Color("866146")
const LEAVES := Color("5b9556")

var player: CharacterBody3D
var cam: Camera3D
const DEFAULT_CAMERA_SIZE := 22.0
const MIN_CAMERA_SIZE := 9.0
const MAX_CAMERA_SIZE := 65.0
const ZOOM_STEP := 2.0

# Low angle is the default: see more of the character's face.
# C switches back to the original elevated isometric view.
const CAMERA_OFFSETS := [
    Vector3(26.0, 31.0, 26.0), # Isometric
    Vector3(8.0, 10.0, 18.0)   # Low Angle: lower and more front-facing
]
const CAMERA_SIZES := [22.0, 16.0]
const CAMERA_NAMES := ["Isometric", "Low Angle"]

var camera_mode := 1
var zoom := 16.0
var camera_mode_label: Label

func _ready() -> void:
    _world_light()
    _ground()
    _make_map()
    _make_player()
    _make_camera()
    _apply_camera_preset()
    _make_hud()
    print("LEMBAH ASRI NEW 3D BLOCKOUT READY: standalone world, ortho camera, villages, garden, forest, hills, commons, coast")

func _process(delta: float) -> void:
    if is_instance_valid(player) and is_instance_valid(cam):
        var focus := player.global_position + Vector3(0.0, 1.2, 0.0)
        var offset: Vector3 = CAMERA_OFFSETS[camera_mode]
        cam.global_position = cam.global_position.lerp(focus + offset, minf(1.0, delta * 4.0))
        cam.look_at(focus, Vector3.UP)

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo:
        if event.keycode == KEY_C or event.physical_keycode == KEY_C:
            _toggle_camera_mode()
            return
    if event is InputEventMouseButton and event.pressed:
        if event.button_index == MOUSE_BUTTON_WHEEL_UP:
            zoom = maxf(MIN_CAMERA_SIZE, zoom - ZOOM_STEP)
        elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
            zoom = minf(MAX_CAMERA_SIZE, zoom + ZOOM_STEP)
        cam.size = zoom

func _apply_camera_preset() -> void:
    zoom = CAMERA_SIZES[camera_mode]
    if is_instance_valid(cam):
        cam.size = zoom
    if is_instance_valid(camera_mode_label):
        camera_mode_label.text = "Kamera: " + CAMERA_NAMES[camera_mode] + "  |  C: Ganti sudut"

func _toggle_camera_mode() -> void:
    camera_mode = (camera_mode + 1) % CAMERA_OFFSETS.size()
    _apply_camera_preset()

func _mat(color: Color) -> StandardMaterial3D:
    var material := StandardMaterial3D.new()
    material.albedo_color = color
    material.roughness = 1.0
    return material

func _box(parent: Node3D, name: String, pos: Vector3, dimensions: Vector3, color: Color) -> MeshInstance3D:
    var n := MeshInstance3D.new()
    n.name = name
    var m := BoxMesh.new()
    m.size = dimensions
    n.mesh = m
    n.material_override = _mat(color)
    n.position = pos
    parent.add_child(n)
    return n

func _sphere(parent: Node3D, name: String, pos: Vector3, radius: float, color: Color) -> MeshInstance3D:
    var n := MeshInstance3D.new()
    n.name = name
    var m := SphereMesh.new()
    m.radius = radius
    m.height = radius * 2.0
    m.radial_segments = 12
    m.rings = 7
    n.mesh = m
    n.material_override = _mat(color)
    n.position = pos
    parent.add_child(n)
    return n

func _region(label: String) -> Node3D:
    var n := Node3D.new()
    n.name = label
    add_child(n)
    return n

func _collision(parent: Node3D, name: String, pos: Vector3, dimensions: Vector3) -> void:
    var body := StaticBody3D.new()
    body.name = name
    body.position = pos
    parent.add_child(body)
    var collider := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = dimensions
    collider.shape = shape
    body.add_child(collider)

func _world_light() -> void:
    var sun := DirectionalLight3D.new()
    sun.name = "PagiJawa"
    sun.rotation_degrees = Vector3(-52, 30, -15)
    sun.light_energy = 1.3
    sun.shadow_enabled = true
    add_child(sun)
    var world_env := WorldEnvironment.new()
    world_env.name = "Atmosphere"
    var env := Environment.new()
    env.background_mode = Environment.BG_COLOR
    env.background_color = Color("b5d4d8")
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color("eff1db")
    env.ambient_light_energy = 0.75
    world_env.environment = env
    add_child(world_env)

func _ground() -> void:
    var ground := _region("TanahUtama")
    _box(ground, "Landscape", Vector3(0, -0.45, 0), Vector3(138, 0.9, 120), Color("88a968"))
    _collision(ground, "GroundPhysics", Vector3(0, -0.45, 0), Vector3(138, 0.9, 120))

func _path(parent: Node3D, pos: Vector3, dimensions: Vector3) -> void:
    _box(parent, "JalanTanah", pos, dimensions, EARTH)

func _tree(parent: Node3D, at: Vector3, scale_factor: float = 1.0) -> void:
    var tree := Node3D.new()
    tree.name = "PohonTropis"
    tree.position = at
    tree.scale = Vector3.ONE * scale_factor
    parent.add_child(tree)
    _box(tree, "Batang", Vector3(0, 2.0, 0), Vector3(0.6, 4.0, 0.6), WOOD)
    _sphere(tree, "DaunA", Vector3(-0.6, 4.15, 0), 1.55, LEAVES)
    _sphere(tree, "DaunB", Vector3(0.8, 4.5, 0.3), 1.75, Color("71a863"))
    _sphere(tree, "DaunC", Vector3(0, 5.2, -0.6), 1.45, Color("7cae67"))

func _palm(parent: Node3D, at: Vector3) -> void:
    var palm := Node3D.new()
    palm.name = "Kelapa"
    palm.position = at
    parent.add_child(palm)
    _box(palm, "BatangKelapa", Vector3(0, 2.9, 0), Vector3(0.36, 5.8, 0.36), Color("9a784c"))
    for offset in [Vector3(-1.25, 5.8, 0), Vector3(1.25, 5.8, 0), Vector3(0, 5.8, -1.25), Vector3(0, 5.8, 1.25)]:
        var leaf := _sphere(palm, "Pelepah", offset, 1.05, Color("508d52"))
        leaf.scale = Vector3(1.6, 0.2, 0.65) if absf(offset.x) > 0.01 else Vector3(0.65, 0.2, 1.6)

func _house(parent: Node3D, pos: Vector3, abandoned: bool) -> void:
    var house := Node3D.new()
    house.name = "RumahMasaKecilTerbengkalai" if abandoned else "RumahKampungJawa"
    house.position = pos
    parent.add_child(house)
    _box(house, "DindingKapuran", Vector3(0, 1.4, 0), Vector3(6.5, 2.8, 5.3), Color("d4c4a4") if abandoned else Color("ebdec1"))
    # Traditional simple SINGLE ridge clay-tile roof, not tiered pagoda.
    var left := _box(house, "GentengKiri", Vector3(-1.5, 3.40, 0), Vector3(4.12, 0.24, 6.65), TERRACOTTA)
    left.rotation.z = -0.32
    var right := _box(house, "GentengKanan", Vector3(1.5, 3.40, 0), Vector3(4.12, 0.24, 6.65), TERRACOTTA)
    right.rotation.z = 0.32
    _box(house, "Teras", Vector3(0, 0.12, 3.6), Vector3(7.2, 0.22, 2.3), Color("bfa88a"))
    for side in [-3.0, 3.0]:
        _box(house, "TiangTeras", Vector3(side, 1.5, 4.1), Vector3(0.2, 3.0, 0.2), WOOD)
    _box(house, "PintuKayu", Vector3(0, 1.2, 2.7), Vector3(1.45, 2.3, 0.12), Color("78543d"))
    for x in [-2.1, 2.1]:
        _box(house, "JendelaKayu", Vector3(x, 1.68, 2.74), Vector3(1.12, 1.26, 0.12), Color("79664c"))
        _box(house, "BingkaiJendela", Vector3(x, 1.68, 2.83), Vector3(0.07, 1.26, 0.13), Color("533e2e"))
    if abandoned:
        for x in [-2.0, -0.6, 1.9]:
            _sphere(house, "LumutAtap", Vector3(x, 3.7, 0.2), 0.28, Color("688354"))
            _sphere(house, "SemakTeras", Vector3(x, 0.3, 4.3), 0.40, Color("5e894f"))
    _collision(house, "DindingCollision", Vector3(0, 1.4, 0), Vector3(6.4, 2.8, 5.1))

func _boat(parent: Node3D, at: Vector3) -> void:
    var boat := Node3D.new()
    boat.name = "PerahuNelayan"
    boat.position = at
    parent.add_child(boat)
    _box(boat, "Lambung", Vector3(0, 0.25, 0), Vector3(2.1, 0.5, 5.1), Color("8b553d"))
    _box(boat, "GubukPerahu", Vector3(0, 0.96, -0.7), Vector3(1.5, 1.2, 1.6), Color("e1caa2"))
    _box(boat, "AtapPerahu", Vector3(0, 1.62, -0.7), Vector3(1.8, 0.16, 1.9), Color("af6345"))

func _make_map() -> void:
    var family := _region("01_RumahTerpisahDanKebun")
    var village := _region("02_DesaJawa")
    var commons := _region("03_LapanganKumpulWarga")
    var woods := _region("04_HutanTropis")
    var hill := _region("05_Bukit")
    var river := _region("06_SungaiJembatan")
    var farming := _region("07_Sawah")
    var coast := _region("08_LautPantai")
    var port := _region("09_DermagaNelayan")

    # Large family plot, genuinely isolated from village homes.
    _box(family, "HalamanLuas", Vector3(-46, 0.08, -31), Vector3(35, 0.14, 35), Color("79a05d"))
    _house(family, Vector3(-47, 0.2, -40), true)
    _box(family, "TanahKebun", Vector3(-44, 0.13, -19), Vector3(25, 0.12, 14), Color("9fbb79"))
    for row in range(4):
        for col in range(6):
            var x := -54.0 + float(col) * 3.6
            var z := -24.0 + float(row) * 2.8
            _box(family, "BedenganSayur", Vector3(x, 0.25, z), Vector3(2.7, 0.15, 1.25), Color("6d523b"))
            for i in range(3):
                _sphere(family, "BibitTanaman", Vector3(x - 0.8 + i * 0.75, 0.50, z), 0.24, LEAVES)
    _palm(family, Vector3(-60, 0, -39))
    _tree(family, Vector3(-33, 0, -42), 1.0)

    # Dirt village paths and basic single-ridge Javanese houses.
    for z in [-23.0, 17.0]:
        _path(village, Vector3(-3, 0.10, z), Vector3(56, 0.12, 3.0))
    _path(village, Vector3(8, 0.12, 4), Vector3(3.3, 0.14, 50))
    for pos in [
        Vector3(-6, 0.0, -34), Vector3(6, 0.0, -34), Vector3(19, 0.0, -31),
        Vector3(-7, 0.0, 28), Vector3(6, 0.0, 31), Vector3(20, 0.0, 28)
    ]:
        _house(village, pos, false)

    # OPEN communal ground: deliberately no football pitch or goal.
    _box(commons, "LapanganTanahWarga", Vector3(8, 0.15, 5), Vector3(23, 0.13, 16), EARTH)
    _tree(commons, Vector3(-2, 0.2, 4), 1.35)
    for pos in [Vector3(-1, 0.3, 11), Vector3(12, 0.3, 11), Vector3(16, 0.3, -1)]:
        _box(commons, "BangkuWarga", pos + Vector3(0, 0.4, 0), Vector3(2.5, 0.19, 0.85), WOOD)
        for dx in [-0.9, 0.9]:
            _box(commons, "KakiBangku", pos + Vector3(dx, 0.1, 0), Vector3(0.17, 0.6, 0.18), WOOD)

    # River crosses the west side and has two safe wooden crossings.
    _box(river, "AirSungai", Vector3(-23, 0.08, 0), Vector3(6.0, 0.1, 110), Color("52a8bc"))
    for z in [-23.0, 17.0]:
        _box(river, "JembatanKayu", Vector3(-23, 0.26, z), Vector3(9.0, 0.27, 4.6), WOOD)
    _collision(river, "TebingUtara", Vector3(-23, 0.7, -42), Vector3(5.7, 1.4, 32))
    _collision(river, "TebingTengah", Vector3(-23, 0.7, -3), Vector3(5.7, 1.4, 34))
    _collision(river, "TebingSelatan", Vector3(-23, 0.7, 37), Vector3(5.7, 1.4, 35))
    _path(family, Vector3(-34, 0.12, -23), Vector3(18, 0.12, 3))
    _path(village, Vector3(-13, 0.12, -23), Vector3(17, 0.12, 3))

    # Rice paddies to the north-east of the commons.
    for row in range(3):
        for col in range(4):
            var p := Vector3(20.0 + col * 3.7, 0.14, -11.0 + row * 3.8)
            _box(farming, "PetakSawah", p, Vector3(3.2, 0.11, 3.3), Color("8db76b"))
            _box(farming, "Padi", p + Vector3(0, 0.1, 0), Vector3(2.3, 0.1, 2.3), Color("a6be61"))

    # Forest and hills are aesthetic blockout, not yet custom terrain meshes.
    for x in [-58.0, -49.0, -40.0, -31.0]:
        for z in [17.0, 27.0, 37.0, 47.0]:
            _tree(woods, Vector3(x + fmod(z, 3.0), 0, z), 0.85)
    for i in range(4):
        _box(hill, "BukitBerundak", Vector3(27, 1.0 + i * 2.0, -44),
            Vector3(33.0 - i * 4.4, 2.0, 27.0 - i * 3.5),
            Color("648c55").lightened(i * 0.06))
    for pos in [Vector3(35, 0, 30), Vector3(38, 0, -13), Vector3(-58, 0, 49)]:
        _palm(woods, pos)

    # East Java coastal fishermen area.
    _box(coast, "PantaiBerpasir", Vector3(43, 0.14, 5), Vector3(15, 0.12, 100), Color("dfc594"))
    _box(coast, "Laut", Vector3(59, 0.11, 0), Vector3(19, 0.12, 115), Color("3997ba"))
    _collision(coast, "BatasLaut", Vector3(59, 0.8, 0), Vector3(17, 1.6, 114))
    _path(village, Vector3(32, 0.12, 16), Vector3(26, 0.12, 2.5))
    _box(port, "DermagaKayu", Vector3(49, 0.35, 16), Vector3(13, 0.23, 2.8), WOOD)
    for z in [6.0, 18.0, 29.0]:
        _boat(port, Vector3(57, 0.22, z))
    for pos in [Vector3(39, 0, -33), Vector3(39, 0, 34)]:
        _palm(coast, pos)

func _make_player() -> void:
    player = CharacterBody3D.new()
    player.name = "Player3D"
    player.position = Vector3(5, 0.3, 9)
    player.set_script(PLAYER_SCRIPT)
    add_child(player)
    var coll := CollisionShape3D.new()
    coll.name = "PlayerCollision"
    coll.position.y = 0.9
    var cap := CapsuleShape3D.new()
    cap.radius = 0.32
    cap.height = 1.7
    coll.shape = cap
    player.add_child(coll)
    var visual := Node3D.new()
    visual.name = "Visual"
    player.add_child(visual)
    var placeholder := Node3D.new()
    placeholder.name = "Placeholder"
    visual.add_child(placeholder)
    _box(placeholder, "JaketKrem", Vector3(0, 1.08, 0), Vector3(0.67, 0.8, 0.4), Color("dbc9a7"))
    _sphere(placeholder, "Kepala", Vector3(0, 1.85, 0), 0.34, Color("bc8c65"))
    _box(placeholder, "TopiOlive", Vector3(0, 2.20, -0.05), Vector3(0.76, 0.13, 0.70), Color("5e7450"))
    for x in [-0.18, 0.18]:
        _box(placeholder, "Kaki", Vector3(x, 0.39, 0), Vector3(0.24, 0.77, 0.27), Color("697180"))
    _box(placeholder, "Ransel", Vector3(0, 1.19, 0.30), Vector3(0.57, 0.76, 0.24), Color("607c55"))
    var fbx_character := Node3D.new()
    fbx_character.name = "FbxCharacter"
    fbx_character.set_script(preload("res://scripts/fbx_character.gd"))
    visual.add_child(fbx_character)

func _make_camera() -> void:
    cam = Camera3D.new()
    cam.name = "IsometricCamera"
    cam.projection = Camera3D.PROJECTION_ORTHOGONAL
    cam.size = zoom
    cam.far = 350
    cam.current = true
    add_child(cam)
    cam.position = player.position + CAMERA_OFFSETS[camera_mode] + Vector3(0, 1.2, 0)
    cam.look_at(player.position + Vector3(0, 1.2, 0), Vector3.UP)

func _make_hud() -> void:
    var layer := CanvasLayer.new()
    layer.name = "BlockoutHUD"
    add_child(layer)
    var title := Label.new()
    title.name = "Title"
    title.position = Vector2(18, 16)
    title.text = "LEMBAH ASRI  |  BLOCKOUT 3D BARU  |  Desa Jawa"
    title.add_theme_font_size_override("font_size", 23)
    title.add_theme_color_override("font_color", Color("fff2d4"))
    layer.add_child(title)
    var controls := Label.new()
    controls.name = "Controls"
    controls.position = Vector2(18, 51)
    controls.text = "WASD: Jalan  •  Shift: Lari  •  Space: Lompat  •  Scroll: Zoom  •  C: Kamera"
    var avatar_status := Label.new()
    avatar_status.name = "AvatarStatus"
    avatar_status.position = Vector2(18, 80)
    avatar_status.add_theme_font_size_override("font_size", 15)
    avatar_status.add_theme_color_override("font_color", Color("fff2d4"))
    var character_node := player.get_node_or_null("Visual/FbxCharacter")
    var fbx_ready: bool = false
    if character_node != null and character_node.has_method("is_model_ready"):
        fbx_ready = bool(character_node.call("is_model_ready"))
    avatar_status.text = "4 FBX: Idle / Walk / Run / Jump aktif" if fbx_ready else "Model sementara — 4 FBX belum lengkap di GitHub"
    layer.add_child(avatar_status)
    controls.add_theme_font_size_override("font_size", 17)
    controls.add_theme_color_override("font_color", Color("fff2d4"))
    layer.add_child(controls)
    camera_mode_label = Label.new()
    camera_mode_label.name = "CameraMode"
    camera_mode_label.position = Vector2(18, 111)
    camera_mode_label.add_theme_font_size_override("font_size", 16)
    camera_mode_label.add_theme_color_override("font_color", Color("fff2d4"))
    layer.add_child(camera_mode_label)
    _apply_camera_preset()
