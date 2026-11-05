extends Node3D
## Lightweight 360-degree background for the isolated Balai Desa scene only.
## Uses the actual illustrated countryside panorama from this conversation,
## downscaled to a 512x170 WebP (~6.4 KB). The seven tiny GDScript data
## fragments ensure that Godot's Web export always includes the texture.
## NO collision, terrain changes, building changes, navigation, or gameplay.
const PART0 = preload("res://scripts/balai_panorama_data_0.gd")
const PART1 = preload("res://scripts/balai_panorama_data_1.gd")
const PART2 = preload("res://scripts/balai_panorama_data_2.gd")
const PART3 = preload("res://scripts/balai_panorama_data_3.gd")
const PART4 = preload("res://scripts/balai_panorama_data_4.gd")
const PART5 = preload("res://scripts/balai_panorama_data_5.gd")
const PART6 = preload("res://scripts/balai_panorama_data_6.gd")
const PANORAMA_CENTER := Vector3(55.71429, 6.0, 39.0)
const PANORAMA_RADIUS_M := 92.0
const PANORAMA_HEIGHT_M := 84.0

func _ready() -> void:
    var encoded := PART0.DATA + PART1.DATA + PART2.DATA + PART3.DATA + PART4.DATA + PART5.DATA + PART6.DATA
    if encoded.length() != 8488:
        push_error("BALAI PANORAMA FAIL: panorama data is incomplete")
        return
    var bytes := Marshalls.base64_to_raw(encoded)
    if bytes.size() != 6366:
        push_error("BALAI PANORAMA FAIL: invalid embedded WebP length")
        return
    var image := Image.new()
    var result := image.load_webp_from_buffer(bytes)
    if result != OK or image.get_width() != 512 or image.get_height() != 170:
        push_error("BALAI PANORAMA FAIL: embedded illustrated WebP cannot be decoded")
        return
    var panorama := ImageTexture.create_from_image(image)
    var mat := StandardMaterial3D.new()
    mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    mat.albedo_texture = panorama
    mat.cull_mode = BaseMaterial3D.CULL_DISABLED
    mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
    var surround := CylinderMesh.new()
    surround.top_radius = PANORAMA_RADIUS_M
    surround.bottom_radius = PANORAMA_RADIUS_M
    surround.height = PANORAMA_HEIGHT_M
    surround.radial_segments = 96
    surround.rings = 1
    surround.cap_top = false
    surround.cap_bottom = false
    var visual := MeshInstance3D.new()
    visual.name = "IllustratedVillageHorizon"
    visual.mesh = surround
    visual.material_override = mat
    visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(visual)
    global_position = PANORAMA_CENTER
    set_meta("balai_panorama_ready", true)
    set_meta("panorama_texture_size", panorama.get_size())
    print("BALAI PANORAMA ACTIVE: 360-degree illustrated background, 512x170 WebP, no collision")
