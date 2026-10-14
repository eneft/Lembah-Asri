extends Node2D
## Reusable weather: rain behind and in front + terrain/water impacts.
const PASS_SCRIPT = preload("res://scripts/weather/rain_layer.gd")
const WATER_MASK: Texture2D = preload("res://assets/art/separated/river_water.webp")

@export var raining: bool = true
@export_range(0.25, 1.5, 0.05) var intensity: float = 1.0
@export var map_size: Vector2 = Vector2(1672.0, 941.0)

func _ready() -> void:
 _make_pass("RainBack", "rain_back", -5, 165)
 _make_pass("RainFront", "rain_front", 12, 145)
 _make_pass("GroundSplashes", "yard", 14, 75)
 _make_pass("RiverRipples", "water", 15, 65)
 set_raining(raining)
 print("LEMBAH ASRI RAIN READY: batched GPU rain, ground splashes and river-masked ripples; reduced Web density")

func _make_pass(node_name: String, kind: String, depth: int, base_count: int) -> void:
 var layer := Node2D.new()
 layer.name = node_name
 layer.set_script(PASS_SCRIPT)
 layer.set("effect_kind", kind)
 # Web and mobile need smaller update buffers; the batched visuals remain full-map.
 var web_quality: float = 0.75 if OS.has_feature("web") else 1.0
 layer.set("particle_count", maxi(1, roundi(float(base_count) * intensity * web_quality)))
 layer.set("update_fps", 30.0 if kind.begins_with("rain") else 20.0)
 layer.set("strength", intensity)
 layer.set("world_size", map_size)
 layer.set("water_mask", WATER_MASK)
 layer.z_index = depth
 layer.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
 add_child(layer)

func set_raining(active: bool) -> void:
 raining = active
 for child in get_children():
  if child is CanvasItem:
   child.visible = active
   child.set_process(active)

func toggle_rain() -> void:
 set_raining(not raining)
