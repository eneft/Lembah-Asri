extends Node3D
## Independent modular Balai Desa modelling sandbox; NOT the live game scene.
const KIT := preload("res://scripts/modular_balai_kit.gd")
var kit: Node3D
var camera: Camera3D
var orbit := 0.44
var elevation := 0.35
var distance_m := 18.0
var target := Vector3(0.0,2.1,0.0)

func _ready() -> void:
    kit = Node3D.new()
    kit.name = "BalaiDesaModular"
    kit.set_script(KIT)
    add_child(kit)
    kit.call("build_balai")
    _preview_ground()
    _lighting()
    camera = Camera3D.new()
    camera.name = "ModularPreviewCamera"
    camera.current = true
    camera.fov = 49.0
    camera.near = 0.12
    camera.far = 200.0
    add_child(camera)
    _aim_camera()
    _instructions()
    print("BALAI MODULAR PREVIEW READY — rotate drag/mouse, zoom wheel; original 2K GLB untouched")

func _lighting() -> void:
    var sun := DirectionalLight3D.new()
    sun.name = "SiangJawa"
    sun.rotation_degrees = Vector3(-46.0,-27.0,0.0)
    sun.light_energy = 1.10
    sun.light_color = Color("fff3df")
    sun.shadow_enabled = true
    add_child(sun)
    var env := WorldEnvironment.new()
    env.name = "StudioOutdoor"
    var environment := Environment.new()
    environment.background_mode = Environment.BG_COLOR
    environment.background_color = Color("b9d5d9")
    environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    environment.ambient_light_color = Color("dce6dc")
    environment.ambient_light_energy = 0.8
    env.environment = environment
    add_child(env)

func _preview_ground() -> void:
    var ground := MeshInstance3D.new()
    ground.name = "DemoGround"
    var plane := PlaneMesh.new()
    plane.size = Vector2(30.0,30.0)
    ground.mesh = plane
    var ground_mat := StandardMaterial3D.new()
    ground_mat.albedo_color = Color("8fa77c")
    ground_mat.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
    ground_mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
    ground_mat.roughness = 1.0
    ground.material_override = ground_mat
    ground.position.y = -0.017
    add_child(ground)

func _aim_camera() -> void:
    if camera == null:
        return
    var pitch := clampf(elevation,0.13,1.15)
    camera.global_position = target + Vector3(
        sin(orbit)*cos(pitch)*distance_m,
        sin(pitch)*distance_m,
        cos(orbit)*cos(pitch)*distance_m)
    camera.look_at(target,Vector3.UP)

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventScreenDrag:
        orbit -= event.relative.x*0.006
        elevation = clampf(elevation+event.relative.y*0.004,0.13,1.10)
        _aim_camera()
    elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
        orbit -= event.relative.x*0.008
        elevation = clampf(elevation+event.relative.y*0.005,0.13,1.10)
        _aim_camera()
    elif event is InputEventMouseButton and event.pressed:
        if event.button_index == MOUSE_BUTTON_WHEEL_UP:
            distance_m = maxf(8.0,distance_m-1.0)
            _aim_camera()
        elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
            distance_m = minf(32.0,distance_m+1.0)
            _aim_camera()

func _instructions() -> void:
    var layer := CanvasLayer.new()
    layer.name = "ModularPreviewUI"
    add_child(layer)
    var panel := PanelContainer.new()
    panel.name = "Help"
    panel.position = Vector2(18,18)
    layer.add_child(panel)
    var text := Label.new()
    text.name = "Title"
    text.text = "LEMBAH ASRI | BALAI MODULAR V0.1\nPlane + texture | Drag: putar kamera | Scroll: zoom\nPrototipe terpisah, belum mengganti Balai Desa asli"
    text.add_theme_font_size_override("font_size",15)
    panel.add_child(text)
