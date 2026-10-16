extends Node2D
## One continuous river surface pass, color-gated to REAL painted water.
## The old three tiny masks covered only fragments of the visible river.
## The underlying Photoshop image, collision and bridge stay unchanged.
const CURRENT_SHADER = preload("res://shaders/native_river_current.gdshader")
const CANVAS := Vector2(1672.0, 941.0)
@export_range(0.0, 1.5, 0.05) var normal_strength: float = 0.86
@export_range(0.0, 1.5, 0.05) var rainy_strength: float = 1.18
var current_strength: float = 0.86
var material_instances: Array[ShaderMaterial] = []

func _ready() -> void:
 z_index = 1
 # Generous river corridor; actual water-only pixels are keyed in the
 # fragment shader against the original background's blue/cyan color.
 # This single pass spans river bends on BOTH sides of the bridge.
 var channel := Polygon2D.new()
 channel.name = "ContinuousRiverColorMasked"
 channel.polygon = PackedVector2Array([
  Vector2(475, 941), Vector2(565, 842), Vector2(765, 755),
  Vector2(918, 685), Vector2(1070, 635), Vector2(1188, 583),
  Vector2(1380, 505), Vector2(1672, 425), Vector2(1672, 941)
 ])
 var uvs := PackedVector2Array()
 for pos in channel.polygon:
  uvs.append(pos / CANVAS)
 channel.uv = uvs
 channel.color = Color.WHITE
 var material := ShaderMaterial.new()
 material.shader = CURRENT_SHADER
 material.set_shader_parameter("flow_direction", Vector2(-0.84, 0.54))
 channel.material = material
 add_child(channel)
 material_instances.append(material)
 set_rain_boost(false)
 print("PSD CONTINUOUS RIVER FLOW READY: full downstream channel, blue-water-only shading")

func set_rain_boost(raining: bool) -> void:
 current_strength = rainy_strength if raining else normal_strength
 for material in material_instances:
  material.set_shader_parameter("current_strength", current_strength)
  material.set_shader_parameter("foam_strength", 0.59 if raining else 0.44)
  material.set_shader_parameter("flow_speed", 1.15 if raining else 0.84)

func set_flow_phase(phase: float) -> void:
 for material in material_instances:
  material.set_shader_parameter("phase_offset", phase)
