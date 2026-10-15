extends Node2D
## Water ONLY: three world-space masks hand traced around painted bridge/rocks.
## Keeps the unique original art untouched; the animation is an additive
## light-flow impression rather than replacement/warping of the baked water.
const REGIONS = preload("res://scripts/weather/native_surface_zones.gd")
const CURRENT_SHADER = preload("res://shaders/native_river_current.gdshader")
@export_range(0.0, 1.0, 0.05) var normal_strength: float = 0.25
@export_range(0.0, 1.0, 0.05) var rainy_strength: float = 0.38
var current_strength: float = 0.25
var material_instances: Array[ShaderMaterial] = []

func _ready() -> void:
 z_index = 1
 for mask in REGIONS.river_water():
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
  mat.set_shader_parameter("current_strength", normal_strength)
  mat.set_shader_parameter("foam_strength", 0.13)
  shape.material = mat
  add_child(shape)
  material_instances.append(mat)
 current_strength = normal_strength
 print("PSD NATIVE2D RIVER FLOW READY: %d shoreline-limited moving water patches" % material_instances.size())

func set_rain_boost(raining: bool) -> void:
 current_strength = rainy_strength if raining else normal_strength
 for mat in material_instances:
  mat.set_shader_parameter("current_strength", current_strength)

func set_flow_phase(phase: float) -> void:
 for mat in material_instances:
  mat.set_shader_parameter("phase_offset", phase)
