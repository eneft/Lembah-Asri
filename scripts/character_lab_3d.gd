extends Node3D
## Non-destructive Lembah Asri character-model inspection lab.
## Model is real GLB geometry with separate mesh groups and pivot nodes.

const MODEL_PATH := "res://assets/characters/lembah_asri_protagonist_3d.glb"
const MAIN_SCENE := "res://scenes/house_garden_stage1.tscn"
const ANIMATION_FPS := 12.0

@onready var hero: Node3D = $ProtagonistModel
@onready var camera: Camera3D = $Camera3D

var head: Node3D
var arm_l: Node3D
var arm_r: Node3D
var leg_l: Node3D
var leg_r: Node3D
var states := ["idle", "walk", "run"]
var demo_state: String = "idle"
var state: String = "idle"
var clock := 0.0
var turntable := true
var base_yaw: float = 0.38
var hud: CanvasLayer
var status_label: Label
var has_rig := false

func _ready() -> void:
    head = hero.find_child("HeadPivot", true, false) as Node3D
    arm_l = hero.find_child("ArmPivot_L", true, false) as Node3D
    arm_r = hero.find_child("ArmPivot_R", true, false) as Node3D
    leg_l = hero.find_child("LegPivot_L", true, false) as Node3D
    leg_r = hero.find_child("LegPivot_R", true, false) as Node3D
    has_rig = head != null and arm_l != null and arm_r != null and leg_l != null and leg_r != null
    if not has_rig:
        push_error("MODEL LAB: exported GLB is missing required animation pivots")
        return
    hero.rotation.y = base_yaw
    camera.position = Vector3(4.4, 4.4, 7.9)
    camera.look_at(Vector3(0.0, 1.94, 0.0), Vector3.UP)
    _build_ground()
    _setup_lighting()
    _build_hud()
    print("MODEL LAB READY: real GLB loaded; five animation pivots; 12 FPS stepped motion")

func _input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo:
        match event.keycode:
            KEY_F6, KEY_ESCAPE:
                get_tree().change_scene_to_file(MAIN_SCENE)
            KEY_1:
                demo_state = "idle"
            KEY_2:
                demo_state = "walk"
            KEY_3:
                demo_state = "run"
            KEY_I:
                turntable = not turntable
            KEY_Q:
                turntable = false
                base_yaw -= PI / 4.0
            KEY_E:
                turntable = false
                base_yaw += PI / 4.0
    elif event is InputEventScreenDrag:
        turntable = false
        base_yaw += event.relative.x * 0.012
    elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
        turntable = false
        base_yaw += event.relative.x * 0.012

func _process(delta: float) -> void:
    if not has_rig:
        return
    clock += delta
    var directional := Vector2.ZERO
    if Input.is_key_pressed(KEY_A) or Input.is_action_pressed("ui_left"): directional.x -= 1.0
    if Input.is_key_pressed(KEY_D) or Input.is_action_pressed("ui_right"): directional.x += 1.0
    if Input.is_key_pressed(KEY_W) or Input.is_action_pressed("ui_up"): directional.y -= 1.0
    if Input.is_key_pressed(KEY_S) or Input.is_action_pressed("ui_down"): directional.y += 1.0
    directional = directional.normalized()
    if directional.length_squared() > 0.0:
        state = "run" if Input.is_key_pressed(KEY_SHIFT) else "walk"
        turntable = false
        base_yaw = atan2(directional.x, directional.y)
    else:
        state = demo_state
        if turntable:
            base_yaw += delta * 0.52
    hero.rotation.y = lerp_angle(hero.rotation.y, base_yaw, minf(1.0, delta * 9.0))

    var stepped_time: float = floor(clock * ANIMATION_FPS) / ANIMATION_FPS
    var cycle_speed := 1.0 if state == "idle" else (1.55 if state == "walk" else 2.8)
    var sine := sin(stepped_time * TAU * cycle_speed)
    var cosi := cos(stepped_time * TAU * cycle_speed)
    var amplitude := 0.02 if state == "idle" else (0.27 if state == "walk" else 0.48)
    arm_l.rotation.x = -sine * amplitude * 0.7
    arm_r.rotation.x = sine * amplitude * 0.7
    leg_l.rotation.x = sine * amplitude
    leg_r.rotation.x = -sine * amplitude
    head.rotation.z = sin(stepped_time * TAU * 0.7) * 0.021
    head.rotation.x = -0.03 + 0.012 * cosi
    hero.position.y = abs(sine) * (0.012 if state == "idle" else (0.035 if state == "walk" else 0.065))
    if status_label != null:
        status_label.text = "MODEL 3D • %s • 12 FPS • arah %.0f°" % [state.to_upper(), rad_to_deg(wrapf(hero.rotation.y, -PI, PI))]

func set_demo_mode(next_mode: String) -> void:
    demo_state = next_mode

func go_back() -> void:
    get_tree().change_scene_to_file(MAIN_SCENE)

func toggle_turntable() -> void:
    turntable = not turntable

func _build_ground() -> void:
    var grass := MeshInstance3D.new()
    grass.name = "LabGrass"
    var floor_mesh := PlaneMesh.new()
    floor_mesh.size = Vector2(30,30)
    grass.mesh = floor_mesh
    grass.material_override = _mat(Color("#91AE74"))
    grass.position.y = -0.09
    add_child(grass)
    var path := MeshInstance3D.new()
    path.name = "Walkway"
    var floor_path := PlaneMesh.new()
    floor_path.size = Vector2(2.5,14.0)
    path.mesh = floor_path
    path.position = Vector3(0,-0.08,0)
    path.material_override = _mat(Color("#C7B18D"))
    add_child(path)
    for i in range(14):
        var side := -1 if i % 2 == 0 else 1
        var bush := MeshInstance3D.new()
        bush.name = "Bush"
        var sphere := SphereMesh.new()
        sphere.radius = 0.29 + 0.03 * (i % 3)
        sphere.height = 0.55
        bush.mesh = sphere
        bush.material_override = _mat(Color("#4C8353") if i % 3 else Color("#6A9B58"))
        bush.position = Vector3(float(side)*2.1, .13, -6 + i*.85)
        add_child(bush)
    for i in range(5):
        for side in [-1,1]:
            var boxnode := MeshInstance3D.new()
            var crop_mesh := BoxMesh.new()
            crop_mesh.size = Vector3(.72,.065,.7)
            boxnode.mesh = crop_mesh
            boxnode.material_override = _mat(Color("#755039"))
            boxnode.position = Vector3(float(side)*3.6,0.03,-3+i*1.5)
            add_child(boxnode)

func _mat(col: Color) -> StandardMaterial3D:
    var m := StandardMaterial3D.new()
    m.albedo_color = col
    m.roughness = 0.97
    return m

func _setup_lighting() -> void:
    var directional := DirectionalLight3D.new()
    directional.rotation_degrees = Vector3(-44,-23,0)
    directional.light_energy = 1.25
    directional.shadow_enabled = true
    add_child(directional)
    var envnode := WorldEnvironment.new()
    var environment := Environment.new()
    environment.background_mode = Environment.BG_COLOR
    environment.background_color = Color("#BCE1EE")
    environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    environment.ambient_light_color = Color("#EDE7D5")
    environment.ambient_light_energy = 0.66
    envnode.environment = environment
    add_child(envnode)

func _build_hud() -> void:
    hud = CanvasLayer.new()
    add_child(hud)
    var panel := PanelContainer.new()
    panel.set_anchors_preset(Control.PRESET_TOP_LEFT)
    panel.position = Vector2(14,14)
    hud.add_child(panel)
    var rows := VBoxContainer.new()
    panel.add_child(rows)
    var heading := Label.new()
    heading.text = "LEMBAH ASRI — UJI MODEL 3D"
    heading.add_theme_font_size_override("font_size",22)
    rows.add_child(heading)
    var info := Label.new()
    info.text = "Model percobaan, belum mengganti karakter 2D\nGeser layar / Q-E: putar • WASD: jalan • Shift: lari"
    rows.add_child(info)
    status_label = Label.new()
    rows.add_child(status_label)
    var buttons := HBoxContainer.new()
    rows.add_child(buttons)
    for n in states:
        var b := Button.new()
        b.text = n.capitalize()
        b.pressed.connect(set_demo_mode.bind(n))
        buttons.add_child(b)
    var rot := Button.new()
    rot.text = "Putar 360°"
    rot.pressed.connect(toggle_turntable)
    rows.add_child(rot)
    var back := Button.new()
    back.text = "Kembali ke Game 2D"
    back.pressed.connect(go_back)
    rows.add_child(back)