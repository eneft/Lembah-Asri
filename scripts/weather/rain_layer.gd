extends Node2D
## Lightweight world-space illustrated rain + true ground/water impacts.
## Drawn on the render clock; does not touch character motion or physics.
var effect_kind: String = "rain_back"
var particle_count: int = 200
var world_size: Vector2 = Vector2(1672.0, 941.0)
var strength: float = 1.0
var water_mask: Texture2D
var water_origin: Vector2 = Vector2(1058.0, 288.0)
var entries: Array[Vector4] = []
var elapsed: float = 0.0

func _ready() -> void:
 var rng := RandomNumberGenerator.new()
 rng.seed = 20261014 + int(abs(effect_kind.hash()))
 if effect_kind.begins_with("rain"):
  _seed_rain(rng)
 elif effect_kind == "yard":
  _seed_ground(rng)
 elif effect_kind == "water":
  _seed_water(rng)
 set_process(true)

func _seed_rain(rng: RandomNumberGenerator) -> void:
 for i in range(particle_count):
  entries.append(Vector4(
   rng.randf_range(-80.0, world_size.x + 80.0),
   rng.randf_range(-110.0, world_size.y + 110.0),
   rng.randf_range(0.76, 1.32),
   rng.randf_range(0.55, 1.0)
  ))

func _seed_ground(rng: RandomNumberGenerator) -> void:
 # Open yard/paths only, excluding roof, walls, garden buildings.
 var yard := PackedVector2Array([
  Vector2(260, 549), Vector2(367, 514), Vector2(530, 485),
  Vector2(650, 496), Vector2(850, 540), Vector2(1050, 552),
  Vector2(1150, 535), Vector2(1250, 523), Vector2(1370, 483),
  Vector2(1450, 477), Vector2(1390, 507), Vector2(1230, 556),
  Vector2(1090, 580), Vector2(970, 591), Vector2(920, 577),
  Vector2(820, 618), Vector2(733, 641), Vector2(590, 609),
  Vector2(510, 603), Vector2(385, 617), Vector2(275, 588)
 ])
 for i in range(particle_count):
  var point := Vector2(700.0, 555.0)
  for trial in range(48):
   var candidate := Vector2(rng.randf_range(275.0, 1440.0), rng.randf_range(488.0, 635.0))
   if Geometry2D.is_point_in_polygon(candidate, yard):
    point = candidate
    break
  entries.append(Vector4(point.x, point.y, rng.randf(), rng.randf_range(0.6, 1.3)))

func _seed_water(rng: RandomNumberGenerator) -> void:
 # Source river RGBA image alpha is the exact water coverage, not a box.
 if water_mask == null:
  push_warning("RainWeather: river RGBA water mask missing")
  return
 var mask: Image = water_mask.get_image()
 if mask == null or mask.is_empty():
  push_warning("RainWeather: cannot read river water mask")
  return
 if mask.is_compressed() and mask.decompress() != OK:
  push_warning("RainWeather: cannot decompress river water mask")
  return
 for i in range(particle_count):
  var found := false
  var point := Vector2.ZERO
  for trial in range(90):
   var px := rng.randi_range(0, mask.get_width() - 1)
   var py := rng.randi_range(0, mask.get_height() - 1)
   if mask.get_pixel(px, py).a > 0.42:
    point = water_origin + Vector2(float(px), float(py))
    found = true
    break
  if found:
   entries.append(Vector4(point.x, point.y, rng.randf(), rng.randf_range(0.65, 1.35)))

func _process(delta: float) -> void:
 elapsed += minf(delta, 0.05)
 queue_redraw()

func _draw() -> void:
 if effect_kind.begins_with("rain"):
  _draw_rain()
 else:
  _draw_impacts()

func _draw_rain() -> void:
 var is_front: bool = effect_kind == "rain_front"
 var fall_speed: float = 1050.0 if is_front else 735.0
 var wind_speed: float = 92.0 if is_front else 60.0
 var trail: float = 13.0 if is_front else 9.0
 var canvas_w: float = world_size.x + 160.0
 var canvas_h: float = world_size.y + 220.0
 var base_alpha: float = 0.50 if is_front else 0.24
 for drop in entries:
  var y: float = fposmod(drop.y + elapsed * fall_speed * drop.z + 110.0, canvas_h) - 110.0
  var x: float = fposmod(drop.x + elapsed * wind_speed * drop.z + 80.0, canvas_w) - 80.0
  var length: float = trail * drop.w
  var lean: float = length * wind_speed / fall_speed
  draw_line(Vector2(x - lean, y - length), Vector2(x, y),
   Color(0.77, 0.89, 1.0, base_alpha * drop.w * strength),
   1.05 if is_front else 0.8, true)

func _draw_impacts() -> void:
 var is_water: bool = effect_kind == "water"
 var base_color := Color(0.85, 0.95, 1.0, 0.8 if is_water else 0.63)
 for drop in entries:
  var age: float = fposmod(elapsed * (1.20 + drop.w * 0.22) + drop.z, 1.0)
  var fade: float = 1.0 - age
  var point := Vector2(drop.x, drop.y)
  var radius: float = (2.4 + age * (6.1 if is_water else 3.9)) * drop.w
  var color: Color = base_color
  color.a *= fade * fade * strength
  draw_set_transform(point, 0.0, Vector2(1.0, 0.34))
  draw_arc(Vector2.ZERO, radius, 0.0, TAU, 16, color, 0.9, true)
  if age < 0.23:
   var crown_alpha: float = 1.0 - age / 0.23
   var crown_color := Color(0.9, 0.97, 1.0, (0.8 if is_water else 0.65) * crown_alpha * strength)
   var lift: float = (2.5 + 3.0 * drop.w) * (1.0 - age / 0.23)
   draw_line(Vector2.ZERO, Vector2(-2.0, -lift), crown_color, 1.1, true)
   draw_line(Vector2.ZERO, Vector2(2.0, -lift * 0.8), crown_color, 1.1, true)
  draw_set_transform(Vector2.ZERO)
