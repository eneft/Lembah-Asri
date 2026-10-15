extends Node2D
## Reusable weather: rain behind and in front + terrain/water impacts.
const PASS_SCRIPT = preload("res://scripts/weather/rain_layer.gd")
const WATER_MASK: Texture2D = preload("res://assets/art/separated/river_water.webp")
# Fixed patches of bare earth within the approved yard walk polygon.
# Keep positions deterministic; do not scatter puddles onto structures.
const PUDDLE_CENTERS := [
 Vector2(378, 568), Vector2(474, 585), Vector2(555, 557),
 Vector2(640, 586), Vector2(704, 613), Vector2(821, 562),
 Vector2(900, 576), Vector2(1006, 559), Vector2(1115, 564),
 Vector2(1210, 538), Vector2(1345, 496), Vector2(775, 620)
]
var last_step_time: float = -1.0
var last_step_position: Vector2 = Vector2(-5000.0, -5000.0)
var weather_clock: float = 0.0

@export var raining: bool = true
@export_range(0.25, 1.5, 0.05) var intensity: float = 1.0
@export var map_size: Vector2 = Vector2(1672.0, 941.0)

func _ready() -> void:
 _make_pass("RainBack", "rain_back", -5, 230)
 _make_pass("RainFront", "rain_front", 12, 220)
 _make_pass("GroundPuddles", "puddle", -7, PUDDLE_CENTERS.size())
 _make_pass("GroundSplashes", "yard", 14, 125)
 _make_pass("RiverRipples", "water", 15, 65)
 _make_pass("FootstepSplashes", "footstep", 16, 10)
 set_raining(raining)
 print("LEMBAH ASRI RAIN READY: GPU batched rain + stronger soil splash, reflective puddles, river ripple and step splashes")

func _make_pass(node_name: String, kind: String, depth: int, base_count: int) -> void:
 var layer := Node2D.new()
 layer.name = node_name
 layer.set_script(PASS_SCRIPT)
 layer.set("effect_kind", kind)
 # Web and mobile need smaller update buffers; the batched visuals remain full-map.
 var web_quality: float = 1.0
 if OS.has_feature("web"):
  web_quality = 0.90 if kind.begins_with("rain") else (0.82 if kind == "yard" else (0.75 if kind == "water" else 1.0))
 layer.set("particle_count", maxi(1, roundi(float(base_count) * intensity * web_quality)))
 layer.set("update_fps", 30.0 if kind.begins_with("rain") else (12.0 if kind == "puddle" else 20.0))
 layer.set("puddle_positions", PUDDLE_CENTERS)
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

func _process(delta: float) -> void:
 weather_clock += minf(delta, 0.05)

func is_in_puddle(point: Vector2) -> bool:
 # Native single-image maps use ONLY the newly masked puddle centers. Old
 # scenes keep their historic twelve footprints, preserving legacy tests.
 var centers: Array = PUDDLE_CENTERS
 if native_masked:
  centers = $GroundPuddles.get("entries")
 for entry in centers:
  var center: Vector2 = Vector2(entry.x, entry.y) if native_masked else entry
  var dx: float = (point.x - center.x) / 29.0
  var dy: float = (point.y - center.y) / 11.0
  if dx * dx + dy * dy < 1.0:
   return true
 return false

func register_footstep(point: Vector2, is_moving: bool) -> void:
 if not raining or not is_moving or not is_in_puddle(point):
  return
 if weather_clock - last_step_time < 0.16:
  return
 if point.distance_to(last_step_position) < 8.0:
  return
 last_step_time = weather_clock
 last_step_position = point
 $FootstepSplashes.call("spawn_footstep", point)
