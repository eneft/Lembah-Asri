extends Node3D
## Standalone Godot 4.3 world: new isometric 3D village blockout, NOT legacy 2D.
## All meshes are temporary authored placeholders with named scene regions.
const PLAYER_SCRIPT = preload("res://scripts/player.gd")
const TERRACOTTA := Color("b46748")
const EARTH := Color("c1a479")
const WOOD := Color("866146")
const LEAVES := Color("5b9556")

var player: CharacterBody3D
var village_art: RefCounted
var house_import: RefCounted
var house_asset_loaded := false
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
    _world_light()
    _load_island()
    _make_player()
    _make_camera()
    _apply_camera_preset()
    _make_hud()
    _make_touch_controls()
    print("LEMBAH ASRI ISLAND V01 READY: original FBX character, terrain collision, village plaza spawn")

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
    sun.light_energy = 1.0
    sun.shadow_enabled = true
    add_child(sun)
    var world_env := WorldEnvironment.new()
    world_env.name = "Atmosphere"
    var env := Environment.new()
    env.background_mode = Environment.BG_COLOR
    env.background_color = Color("b5d4d8")
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color("eff1db")
    env.ambient_light_energy = 0.45
    world_env.environment = env
    add_child(world_env)

func _make_player() -> void:
    player = CharacterBody3D.new()
    player.name = "Player3D"
    player.position = Vector3(6, 6.2, 15)
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
    var house_status := Label.new()
    house_status.name = "HouseAssetStatus"
    house_status.position = Vector2(18, 137)
    house_status.add_theme_font_size_override("font_size", 14)
    house_status.add_theme_color_override("font_color", Color("fff2d4"))
    house_status.text = "18 rumah tropis bertekstur • Genteng, dinding, kayu dan teras"
    layer.add_child(house_status)
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

func _load_island() -> void:
    var packed := load("res://assets/environment/island/island_blockout.glb") as PackedScene
    assert(packed != null, "Island blockout gagal diimpor")
    var island := packed.instantiate() as Node3D
    island.name = "IslandBlockoutV01"
    # Source GLB is authored Z-up; Godot gameplay uses Y-up.
    island.rotation_degrees.x = -90.0
    add_child(island)
    for child in island.find_children("*", "MeshInstance3D", true, false):
        var mesh := child as MeshInstance3D
        var label := str(mesh.name)
        if label.begins_with("07_HOUSE_"):
            mesh.hide()
            continue
        # Water and vegetation stay non-solid. Terrain, roads and structures are walkable.
        if label.begins_with("01_") or label.begins_with("04_") or label.begins_with("05_") or label.begins_with("06_FARM_Paddy") or label.begins_with("07_") or label.begins_with("08_") or label.begins_with("09_") or label.begins_with("10_") or label.begins_with("11_") or label.begins_with("12_") or label.ends_with("Trunks") or label.begins_with("14_"):
            mesh.create_trimesh_collision()

    house_import = load("res://scripts/village_houses.gd").new()
    house_import.populate(self, island)

func _physics_process(_delta: float) -> void:
    if is_instance_valid(player) and player.position.y < -8.0:
        player.position = Vector3(6, 6.2, 15)
        player.velocity = Vector3.ZERO
