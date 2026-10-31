extends Node3D
## Standalone Godot 4.3 world: new isometric 3D village blockout, NOT legacy 2D.
## All meshes are temporary authored placeholders with named scene regions.
const PLAYER_SCRIPT = preload("res://scripts/player.gd")
const VILLAGE_ART = preload("res://scripts/village_art.gd")
const TERRACOTTA := Color("b46748")
const EARTH := Color("c1a479")
const WOOD := Color("866146")
const LEAVES := Color("5b9556")

var player: CharacterBody3D
var village_art: RefCounted
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

const CAMERA_ORBIT_STEP := PI / 6.0
const CAMERA_DRAG_SENSITIVITY := 0.009

var camera_mode := 1
var zoom := 16.0
var camera_yaw := 0.0
var camera_mode_label: Label

func _ready() -> void:
    village_art = VILLAGE_ART.new()
    _world_light()
    _ground()
    _make_map()
    _make_player()
    _make_camera()
    _apply_camera_preset()
    _make_hud()
    _make_touch_controls()
    print("LEMBAH ASRI NEW 3D BLOCKOUT READY: standalone world, ortho camera, villages, garden, forest, hills, commons, coast")

func _process(delta: float) -> void:
    if is_instance_valid(player) and is_instance_valid(cam):
        var focus := player.global_position + Vector3(0.0, 1.2, 0.0)
        # Orbit around the player without changing the original camera presets.
        var offset: Vector3 = Basis(Vector3.UP, camera_yaw) * CAMERA_OFFSETS[camera_mode]
        cam.global_position = cam.global_position.lerp(focus + offset, minf(1.0, delta * 4.0))
        cam.look_at(focus, Vector3.UP)

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo:
        if event.keycode == KEY_C or event.physical_keycode == KEY_C:
            _toggle_camera_mode()
            return
        if event.keycode == KEY_Q or event.physical_keycode == KEY_Q:
            _rotate_camera(-CAMERA_ORBIT_STEP)
            return
        if event.keycode == KEY_E or event.physical_keycode == KEY_E:
            _rotate_camera(CAMERA_ORBIT_STEP)
            return
        if event.keycode == KEY_R or event.physical_keycode == KEY_R:
            _reset_camera_rotation()
            return
    if event is InputEventMouseMotion:
        if (event.button_mask & MOUSE_BUTTON_MASK_RIGHT) != 0:
            _rotate_camera(-event.relative.x * CAMERA_DRAG_SENSITIVITY)
            return
    if event is InputEventScreenDrag:
        # Reserve the lower screen zone for multi-touch D-pad, Run and Jump.
        # Swipes in the upper gameplay area still orbit the camera.
        var viewport_height := get_viewport().get_visible_rect().size.y
        if event.position.y < viewport_height - minf(230.0, viewport_height * 0.35):
            _rotate_camera(-event.relative.x * CAMERA_DRAG_SENSITIVITY)
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
    _update_camera_mode_label()

func _update_camera_mode_label() -> void:
    if is_instance_valid(camera_mode_label):
        camera_mode_label.text = "Kamera: %s  |  Orbit: %d°  |  C: Mode  •  Q/E: Putar  •  R: Reset" % [
            CAMERA_NAMES[camera_mode], roundi(rad_to_deg(camera_yaw))
        ]

func _rotate_camera(amount: float) -> void:
    camera_yaw = wrapf(camera_yaw + amount, -PI, PI)
    _update_camera_mode_label()

func _reset_camera_rotation() -> void:
    camera_yaw = 0.0
    _update_camera_mode_label()

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
    var road := _box(parent, "JalanTanahBertekstur", pos, dimensions, EARTH)
    road.material_override = village_art._material("soil")

func _tree(parent: Node3D, at: Vector3, scale_factor: float = 1.0) -> void:
    village_art.build_tree(parent, at, scale_factor)

func _palm(parent: Node3D, at: Vector3) -> void:
    village_art.build_palm(parent, at)

func _banana(parent: Node3D, at: Vector3) -> void:
    village_art.build_banana(parent, at)

func _house(parent: Node3D, pos: Vector3, abandoned: bool) -> void:
    village_art.build_house(parent, pos, abandoned)

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
    _banana(family, Vector3(-56, 0, -34))
    _banana(family, Vector3(-34, 0, -33))
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

    _banana(village, Vector3(-2, 0, 36))
    _banana(village, Vector3(26, 0, 34))

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
    _banana(coast, Vector3(36, 0, 41))

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
    controls.text = "WASD: Jalan  •  Shift: Lari  •  Space: Lompat  •  C: Kamera  •  Q/E: Putar  •  Sentuh: Arah/Lari/Lompat"
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

    # Accessible buttons for mobile/touch users; right-mouse drag also works on desktop.
    var orbit_controls := HBoxContainer.new()
    orbit_controls.name = "OrbitControls"
    orbit_controls.set_anchors_preset(Control.PRESET_TOP_RIGHT)
    orbit_controls.offset_left = -292.0
    orbit_controls.offset_right = -12.0
    orbit_controls.offset_top = 14.0
    orbit_controls.offset_bottom = 64.0
    orbit_controls.add_theme_constant_override("separation", 6)
    layer.add_child(orbit_controls)

    var turn_left := Button.new()
    turn_left.name = "OrbitLeft"
    turn_left.text = "↶ Putar"
    turn_left.custom_minimum_size = Vector2(88.0, 48.0)
    turn_left.pressed.connect(_rotate_camera.bind(-CAMERA_ORBIT_STEP))
    orbit_controls.add_child(turn_left)

    var reset_orbit := Button.new()
    reset_orbit.name = "OrbitReset"
    reset_orbit.text = "Reset"
    reset_orbit.custom_minimum_size = Vector2(76.0, 48.0)
    reset_orbit.pressed.connect(_reset_camera_rotation)
    orbit_controls.add_child(reset_orbit)

    var turn_right := Button.new()
    turn_right.name = "OrbitRight"
    turn_right.text = "Putar ↷"
    turn_right.custom_minimum_size = Vector2(88.0, 48.0)
    turn_right.pressed.connect(_rotate_camera.bind(CAMERA_ORBIT_STEP))
    orbit_controls.add_child(turn_right)

func _make_touch_controls() -> void:
    var touch_layer := CanvasLayer.new()
    touch_layer.name = "TouchControls"
    touch_layer.layer = 2
    add_child(touch_layer)
    var buttons := Node2D.new()
    buttons.name = "Buttons"
    buttons.set_script(preload("res://scripts/mobile_controls.gd"))
    touch_layer.add_child(buttons)
