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
var render_accumulator: float = 0.0
var update_fps: float = 30.0
var batched_mesh: MultiMesh
var batched_sprites: MultiMeshInstance2D
var batch_update_count: int = 0

func _ready() -> void:
 var rng := RandomNumberGenerator.new()
 rng.seed = 20261014 + int(abs(effect_kind.hash()))
 if effect_kind.begins_with("rain"):
  _seed_rain(rng)
 elif effect_kind == "yard":
  _seed_ground(rng)
 elif effect_kind == "water":
  _seed_water(rng)
 _create_batch()
 _update_batch()
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


## 2D GPU instance batching: ONE MultiMesh draw per weather layer.
## Old _draw loop issued hundreds of line/arc/crown commands EACH frame.
func _create_batch() -> void:
 batched_mesh = MultiMesh.new()
 batched_mesh.transform_format = MultiMesh.TRANSFORM_2D
 batched_mesh.use_colors = true
 var quad := QuadMesh.new()
 var is_rain: bool = effect_kind.begins_with("rain")
 quad.size = Vector2(2.8, 27.0) if is_rain else Vector2(48.0, 48.0)
 batched_mesh.mesh = quad
 batched_mesh.instance_count = entries.size()
 batched_sprites = MultiMeshInstance2D.new()
 batched_sprites.name = "BatchedSprites"
 batched_sprites.multimesh = batched_mesh
 batched_sprites.texture = _rain_texture() if is_rain else _splash_texture()
 batched_sprites.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
 add_child(batched_sprites)

func _rain_texture() -> Texture2D:
 var img := Image.create(4, 32, false, Image.FORMAT_RGBA8)
 img.fill(Color.TRANSPARENT)
 for y in range(32):
  var t: float = float(y) / 31.0
  var alpha: float = (0.17 + 0.78 * pow(t, 0.8)) * 0.95
  img.set_pixel(1, y, Color(1, 1, 1, alpha))
  img.set_pixel(2, y, Color(1, 1, 1, alpha))
  img.set_pixel(0, y, Color(1, 1, 1, alpha * 0.24))
  img.set_pixel(3, y, Color(1, 1, 1, alpha * 0.24))
 return ImageTexture.create_from_image(img)

func _splash_texture() -> Texture2D:
 # 48x48 alpha-only painterly ring + two tiny upward droplets.
 # Constructed ONCE instead of drawing 16-segment arcs every frame.
 var img := Image.create(48, 48, false, Image.FORMAT_RGBA8)
 img.fill(Color.TRANSPARENT)
 for y in range(48):
  for x in range(48):
   var fx: float = float(x) - 23.5
   var fy: float = float(y) - 29.0
   var ring_distance: float = sqrt(pow(fx / 15.0, 2) + pow(fy / 5.5, 2))
   var ring_alpha: float = clampf((0.14 - absf(ring_distance - 1.0)) / 0.14, 0.0, 1.0) * 0.78
   var left_drop: float = Vector2(fx + 6.0, fy + 11.0).length()
   var right_drop: float = Vector2(fx - 5.0, fy + 9.0).length()
   var crown_alpha: float = maxf(0.0, 1.0 - left_drop / 2.2)
   crown_alpha = maxf(crown_alpha, maxf(0.0, 1.0 - right_drop / 2.1))
   var alpha: float = maxf(ring_alpha, crown_alpha * 0.88)
   if alpha > 0.001:
    img.set_pixel(x, y, Color(1, 1, 1, alpha))
 return ImageTexture.create_from_image(img)

func _process(delta: float) -> void:
 # Never rebuild CanvasItem draw commands at browser render FPS.
 # Cap cosmetic updates independently of player movement/camera.
 elapsed += minf(delta, 0.05)
 render_accumulator += minf(delta, 0.05)
 var interval: float = 1.0 / update_fps
 if render_accumulator < interval:
  return
 render_accumulator = fmod(render_accumulator, interval)
 _update_batch()

func _update_batch() -> void:
 if batched_mesh == null:
  return
 batch_update_count += 1
 if effect_kind.begins_with("rain"):
  _update_rain()
 else:
  _update_impacts()

func _update_rain() -> void:
 var is_front: bool = effect_kind == "rain_front"
 var fall_speed: float = 1050.0 if is_front else 735.0
 var wind_speed: float = 92.0 if is_front else 60.0
 var canvas_w: float = world_size.x + 160.0
 var canvas_h: float = world_size.y + 220.0
 var base_alpha: float = 0.83 if is_front else 0.53
 for i in range(entries.size()):
  var drop: Vector4 = entries[i]
  var y: float = fposmod(drop.y + elapsed * fall_speed * drop.z + 110.0, canvas_h) - 110.0
  var x: float = fposmod(drop.x + elapsed * wind_speed * drop.z + 80.0, canvas_w) - 80.0
  batched_mesh.set_instance_transform_2d(i, Transform2D(-0.12, Vector2(0.86, 0.84 + drop.w * 0.20), 0.0, Vector2(x, y)))
  batched_mesh.set_instance_color(i, Color(0.84, 0.93, 1.0, base_alpha * (0.75 + 0.25 * drop.w) * strength))

func _update_impacts() -> void:
 var is_water: bool = effect_kind == "water"
 for i in range(entries.size()):
  var drop: Vector4 = entries[i]
  var age: float = fposmod(elapsed * (1.20 + drop.w * 0.22) + drop.z, 1.0)
  var fade: float = 1.0 - age
  var scale_factor: float = (0.21 + age * (0.34 if is_water else 0.24)) * drop.w
  batched_mesh.set_instance_transform_2d(i, Transform2D(0.0, Vector2(scale_factor, scale_factor), 0.0, Vector2(drop.x, drop.y)))
  batched_mesh.set_instance_color(i, Color(0.85, 0.95, 1.0, (0.82 if is_water else 0.64) * fade * fade * strength))
