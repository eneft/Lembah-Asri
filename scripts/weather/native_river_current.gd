extends Node2D
## Continuous downstream water motion in PSD water-only regions.
## Keep baked shorelines, bridge deck, rocks and scenery untouched.
const REGIONS = preload("res://scripts/weather/native_surface_zones.gd")
const CURRENT_SHADER = preload("res://shaders/native_river_current.gdshader")
@export_range(0.0, 1.5, 0.05) var normal_strength: float = 0.95
@export_range(0.0, 1.5, 0.05) var rainy_strength: float = 1.25
var current_strength: float = 0.95
var material_instances: Array[ShaderMaterial] = []
const FLOW_DIRECTIONS := [
 Vector2(-0.84, 0.54),  # Main diagonal stream under the bridge.
 Vector2(-0.38, 0.92),  # Upper right continuation.
 Vector2(-0.70, 0.71)   # Lower downstream reach.
]

func _ready() -> void:
 z_index = 1
 var masks: Array[PackedVector2Array] = REGIONS.river_water()
 for i in range(masks.size()):
  var mask: PackedVector2Array = masks[i]
  var shape := Polygon2D.new()
  shape.name = "RiverCurrentOnly"
  shape.polygon = mask
  var uvs := PackedVector2Array()
  for pt in mask:
   uvs.append(pt / Vector2(1672.0, 941.0))
  shape.uv = uvs
  shape.color = Color.WHITE
  var mat := ShaderMaterial.new()
  mat.shader = CURRENT_SHADER
  mat.set_shader_parameter("flow_direction",
   FLOW_DIRECTIONS[i % FLOW_DIRECTIONS.size()])
  mat.set_shader_parameter("flow_speed", 1.15)
  mat.set_shader_parameter("current_strength", normal_strength)
  mat.set_shader_parameter("foam_strength", 0.42)
  shape.material = mat
  add_child(shape)
  material_instances.append(mat)
 current_strength = normal_strength
 print("PSD DOWNSTREAM FLOW READY: %d continuous masked water paths" % material_instances.size())

func set_rain_boost(raining: bool) -> void:
 current_strength = rainy_strength if raining else normal_strength
 for mat in material_instances:
  mat.set_shader_parameter("current_strength", current_strength)
  mat.set_shader_parameter("foam_strength", 0.68 if raining else 0.42)
  mat.set_shader_parameter("flow_speed", 1.55 if raining else 1.15)

func set_flow_phase(phase: float) -> void:
 for mat in material_instances:
  mat.set_shader_parameter("phase_offset", phase)
