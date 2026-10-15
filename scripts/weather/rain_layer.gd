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
var puddle_positions: Array = []
var next_footstep_slot: int = 0
# Recycled terrain impacts only. The rain, puddles, river and footprints
# deliberately keep their existing animation/update paths unchanged.
var native_ground_regions: Array[PackedVector2Array] = []
var native_water_regions: Array[PackedVector2Array] = []
var wind_strength: float = 0.0
var wind_displacement: float = 0.0
var yard_polygon: PackedVector2Array
var yard_rng := RandomNumberGenerator.new()
var yard_born: PackedFloat32Array = PackedFloat32Array()
var yard_lifetime: PackedFloat32Array = PackedFloat32Array()
var yard_variant: PackedInt32Array = PackedInt32Array()
var yard_relocations: int = 0

func _ready() -> void:
 var rng := RandomNumberGenerator.new()
 rng.seed = 20261014 + int(abs(effect_kind.hash()))
 if effect_kind.begins_with("rain"):
  _seed_rain(rng)
 elif effect_kind == "yard":
  _seed_ground(rng)
 elif effect_kind == "water":
  _seed_water(rng)
 elif effect_kind == "puddle":
  _seed_puddles(rng)
 elif effect_kind == "footstep":
  _seed_footsteps()
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
 # Existing approved exposed-soil polygon, shared by initial placement AND
 # every respawn. Never move rain contacts onto roof/coop/river.
 yard_polygon = PackedVector2Array([
  Vector2(260, 549), Vector2(367, 514), Vector2(530, 485),
  Vector2(650, 496), Vector2(850, 540), Vector2(1050, 552),
  Vector2(1150, 535), Vector2(1250, 523), Vector2(1370, 483),
  Vector2(1450, 477), Vector2(1390, 507), Vector2(1230, 556),
  Vector2(1090, 580), Vector2(970, 591), Vector2(920, 577),
  Vector2(820, 618), Vector2(733, 641), Vector2(590, 609),
  Vector2(510, 603), Vector2(385, 617), Vector2(275, 588)
 ])
 yard_rng.seed = rng.seed
 yard_born.resize(particle_count)
 yard_lifetime.resize(particle_count)
 yard_variant.resize(particle_count)
 for i in range(particle_count):
  entries.append(Vector4.ZERO)
  _recycle_ground_hit(i, true)

func _random_yard_point() -> Vector2:
 if not native_ground_regions.is_empty():
  for trial in range(80):
   var candidate := Vector2(
    yard_rng.randf_range(526.0, 1128.0),
    yard_rng.randf_range(502.0, 599.0))
   var valid: bool = false
   for polygon in native_ground_regions:
    if Geometry2D.is_point_in_polygon(candidate, polygon):
     valid = true
     for probe in [Vector2(12, 0), Vector2(-12, 0), Vector2(0, 10), Vector2(0, -10)]:
      if not Geometry2D.is_point_in_polygon(candidate + probe, polygon):
       valid = false
       break
     if valid:
      return candidate
  # An unquestionably clear open-soil fallback in the single-image yard.
  return Vector2(775.0, 540.0)
 # Rejection sampling distributes impacts across the same open dirt region,
 # rather than reusing a static handful of positions every cycle.
 for trial in range(36):
  var candidate := Vector2(
   yard_rng.randf_range(275.0, 1440.0),
   yard_rng.randf_range(488.0, 635.0)
  )
  if Geometry2D.is_point_in_polygon(candidate, yard_polygon):
   return candidate
 return Vector2(700.0, 555.0)

func _recycle_ground_hit(index: int, initial: bool = false) -> void:
 # Original rain contact was short-lived with tiny rings and brief crowns.
 # Distribution: 65% fine droplets, 25% medium, 10% accent splashes.
 var chance: float = yard_rng.randf()
 var kind: int = 0 if chance < 0.65 else (1 if chance < 0.90 else 2)
 var life: float = yard_rng.randf_range(0.37, 0.67)
 if kind == 1:
  life = yard_rng.randf_range(0.40, 0.73)
 elif kind == 2:
  life = yard_rng.randf_range(0.45, 0.85)
 var size: float = yard_rng.randf_range(0.80, 1.20)
 var birth: float = elapsed - yard_rng.randf_range(0.0, life) if initial else elapsed
 var at: Vector2 = _random_yard_point()
 # All recycled instances have new positions/size/duration/variant.
 entries[index] = Vector4(at.x, at.y, birth, size)
 yard_born[index] = birth
 yard_lifetime[index] = life
 yard_variant[index] = kind
 if not initial:
  yard_relocations += 1

func _seed_puddles(rng: RandomNumberGenerator) -> void:
 # Fallback is intentionally local so a typed/untyped Array handoff cannot
 # silently suppress the entire water surface on browser exports.
 var coordinates: Array = puddle_positions
 if coordinates.is_empty():
  coordinates = [
   Vector2(378, 568), Vector2(474, 585), Vector2(555, 557),
   Vector2(640, 586), Vector2(704, 613), Vector2(821, 562),
   Vector2(900, 576), Vector2(1006, 559), Vector2(1115, 564),
   Vector2(1210, 538), Vector2(1345, 496), Vector2(775, 620)
  ]
 for point in coordinates:
  entries.append(Vector4(point.x, point.y, rng.randf_range(0.0, TAU), rng.randf_range(0.87, 1.13)))

func set_native_terrain_mask(
 ground: Array[PackedVector2Array],
 puddles: Array[Vector2],
 river: Array[PackedVector2Array]) -> void:
 if effect_kind == "yard":
  native_ground_regions = ground
  for i in range(entries.size()):
   _recycle_ground_hit(i, true)
  _update_batch()
 elif effect_kind == "puddle":
  native_ground_regions = ground
  entries.clear()
  puddle_positions.clear()
  for spot in puddles:
   puddle_positions.append(spot)
  var rng := RandomNumberGenerator.new()
  rng.seed = 20261015
  _seed_puddles(rng)
  if batched_mesh != null:
   batched_mesh.instance_count = entries.size()
  _update_batch()
 elif effect_kind == "water":
  native_water_regions = river
  entries.clear()
  var rng := RandomNumberGenerator.new()
  rng.seed = 20261016
  for i in range(particle_count):
   var polygon: PackedVector2Array = native_water_regions[i % native_water_regions.size()]
   var rect := Rect2(polygon[0], Vector2.ZERO)
   for pos in polygon:
    rect = rect.expand(pos)
   var drop: Vector2 = (rect.position + rect.size * 0.5)
   for trial in range(75):
    var candidate := Vector2(
     rng.randf_range(rect.position.x, rect.end.x),
     rng.randf_range(rect.position.y, rect.end.y))
    if Geometry2D.is_point_in_polygon(candidate, polygon):
     drop = candidate
     break
   entries.append(Vector4(drop.x, drop.y, rng.randf(), rng.randf_range(0.65, 1.35)))
  if batched_mesh != null:
   batched_mesh.instance_count = entries.size()
  _update_batch()

func _seed_footsteps() -> void:
 # Fixed-size ring-buffer: no new object is allocated for each footstep.
 for i in range(particle_count):
  entries.append(Vector4(821.0, 562.0, -100000.0, 1.0))

func spawn_footstep(world_pos: Vector2) -> void:
 if effect_kind != "footstep" or entries.is_empty():
  return
 entries[next_footstep_slot] = Vector4(world_pos.x, world_pos.y, elapsed, 1.0)
 next_footstep_slot = (next_footstep_slot + 1) % entries.size()
 _update_batch()

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
 if is_rain:
  quad.size = Vector2(2.8, 27.0)
 elif effect_kind == "puddle":
  quad.size = Vector2(96.0, 48.0)
 else:
  quad.size = Vector2(48.0, 48.0)
 batched_mesh.mesh = quad
 batched_mesh.instance_count = entries.size()
 # An empty footstep ring starts outside the screen. Tell the renderer
 # the FULL possible movement region, otherwise Godot culls the entire
 # MultiMesh before a new splash can enter its dynamically moved bounds.
 batched_mesh.custom_aabb = AABB(Vector3(-120, -120, -10),
  Vector3(world_size.x + 240, world_size.y + 240, 20))
 batched_sprites = MultiMeshInstance2D.new()
 batched_sprites.name = "BatchedSprites"
 batched_sprites.multimesh = batched_mesh
 if is_rain:
  batched_sprites.texture = _rain_texture()
 elif effect_kind == "puddle":
  batched_sprites.texture = _puddle_texture()
 else:
  batched_sprites.texture = _splash_texture()
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
 # Thick luminous oval contact crown + two small ejected droplets.
 # Rendered with one GPU batch at 20 Hz, not hundreds of draw_arc calls.
 var img := Image.create(48, 48, false, Image.FORMAT_RGBA8)
 img.fill(Color.TRANSPARENT)
 for y in range(48):
  for x in range(48):
   var fx: float = float(x) - 23.5
   var fy: float = float(y) - 29.0
   var ring_d: float = sqrt(pow(fx / 16.0, 2.0) + pow(fy / 6.8, 2.0))
   var ring: float = clampf(1.0 - absf(ring_d - 1.0) / 0.22, 0.0, 1.0)
   var crown_left: float = maxf(0.0, 1.0 - Vector2(fx + 5.0, fy + 10.0).length() / 2.8)
   var crown_right: float = maxf(0.0, 1.0 - Vector2(fx - 6.0, fy + 12.0).length() / 2.8)
   var flash: float = maxf(0.0, 1.0 - Vector2(fx, fy).length() / 4.0)
   var alpha: float = maxf(ring * 0.95, maxf(crown_left, crown_right))
   alpha = maxf(alpha, flash * 0.65)
   if alpha > 0.001:
    img.set_pixel(x, y, Color(0.96, 0.99, 1.0, alpha))
 return ImageTexture.create_from_image(img)

func _puddle_texture() -> Texture2D:
 # Soft pseudo-isometric puddle with cool sky reflection and thin rim.
 # All texture pixels are prepared ONCE at startup.
 var img := Image.create(96, 48, false, Image.FORMAT_RGBA8)
 img.fill(Color.TRANSPARENT)
 for y in range(48):
  for x in range(96):
   var fx: float = (float(x) - 47.5) / 46.0
   var fy: float = (float(y) - 23.5) / 20.0
   var d: float = sqrt(fx * fx + fy * fy)
   var fill: float = clampf((1.03 - d) / 0.24, 0.0, 1.0)
   if fill < 0.002:
    continue
   var rim: float = clampf(1.0 - absf(d - 0.88) / 0.095, 0.0, 1.0)
   var highlight: float = 0.0
   if fx > -0.57 and fx < 0.38 and fy < -0.10 and fy > -0.32:
    highlight = (1.0 - absf(fy + 0.21) / 0.12) * 0.58
   var shade: float = 0.18 + 0.13 * (1.0 - fy)
   var alpha: float = minf(0.85, (0.43 + 0.2 * rim) * fill + highlight * fill)
   var tint := Color(0.39 + shade, 0.57 + shade * 0.58, 0.68 + shade * 0.45, alpha)
   if highlight > 0.0:
    tint = tint.lerp(Color(0.96, 0.99, 1.0, alpha), highlight * 0.7)
   img.set_pixel(x, y, tint)
 return ImageTexture.create_from_image(img)

func _process(delta: float) -> void:
 # Never rebuild CanvasItem draw commands at browser render FPS.
 # Cap cosmetic updates independently of player movement/camera.
 elapsed += minf(delta, 0.05)
 render_accumulator += minf(delta, 0.05)
 if effect_kind.begins_with("rain"):
  # Integrate lateral gust: no teleport when wind changes strength.
  wind_displacement += wind_strength * minf(delta, 0.05) * 320.0
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
 elif effect_kind == "puddle":
  _update_puddles()
 elif effect_kind == "yard":
  _update_ground_impacts()
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
  var x: float = fposmod(drop.x + elapsed * wind_speed * drop.z + wind_displacement * drop.z + 80.0, canvas_w) - 80.0
  var tilt: float = -0.12 - wind_strength * 0.35
  batched_mesh.set_instance_transform_2d(i, Transform2D(tilt, Vector2(0.86, 0.84 + drop.w * 0.20), 0.0, Vector2(x, y)))
  batched_mesh.set_instance_color(i, Color(0.84, 0.93, 1.0, base_alpha * (0.75 + 0.25 * drop.w) * strength))

func _update_puddles() -> void:
 # Subtle glimmer animates the painted water surface, never the landscape.
 for i in range(entries.size()):
  var drop: Vector4 = entries[i]
  var shimmer: float = sin(elapsed * 2.2 + drop.z)
  var sx: float = drop.w * (0.77 + 0.015 * shimmer)
  var sy: float = drop.w * 0.53
  batched_mesh.set_instance_transform_2d(i,
   Transform2D(0.0, Vector2(sx, sy), 0.0, Vector2(drop.x, drop.y)))
  batched_mesh.set_instance_color(i, Color(0.92, 0.99, 1.0, (0.77 + 0.12 * shimmer) * strength))

func _update_ground_impacts() -> void:
 # CPU updates a bounded pool at 20 Hz; the GPU still draws ONE MultiMesh.
 # No per-frame Node allocations, CanvasItem arcs, or draw calls per drop.
 for i in range(entries.size()):
  var drop: Vector4 = entries[i]
  var age_seconds: float = elapsed - yard_born[i]
  if age_seconds >= yard_lifetime[i]:
   _recycle_ground_hit(i)
   drop = entries[i]
   age_seconds = 0.0
  var age: float = clampf(age_seconds / yard_lifetime[i], 0.0, 1.0)
  var fade: float = pow(1.0 - age, 1.55)
  var kind: int = yard_variant[i]
  var size: float = drop.w
  var spread: float
  var opacity: float
  if kind == 0:
   # Fine rain: old 2-5px rings, no huge cartoon crown.
   spread = (0.22 + 0.19 * age) * size
   opacity = 0.62
  elif kind == 1:
   spread = (0.32 + 0.22 * age) * size
   opacity = 0.76
  else:
   spread = (0.42 + 0.29 * age) * size
   opacity = 0.87
  var sx: float = spread
  var sy: float = spread * (0.89 + 0.11 * size)
  batched_mesh.set_instance_transform_2d(i,
   Transform2D(0.0, Vector2(sx, sy), 0.0, Vector2(drop.x, drop.y)))
  batched_mesh.set_instance_color(i,
   Color(0.88, 0.96, 1.0, opacity * fade * strength))

func _update_impacts() -> void:
 var is_water: bool = effect_kind == "water"
 var is_footstep: bool = effect_kind == "footstep"
 for i in range(entries.size()):
  var drop: Vector4 = entries[i]
  var age: float
  if is_footstep:
   age = (elapsed - drop.z) / 0.42
   if age < 0.0 or age >= 1.0:
    batched_mesh.set_instance_transform_2d(i, Transform2D(0.0, Vector2(0.001, 0.001), 0.0, Vector2(821, 562)))
    batched_mesh.set_instance_color(i, Color.TRANSPARENT)
    continue
  else:
   age = fposmod(elapsed * (1.28 + drop.w * 0.24) + drop.z, 1.0)
  var fade: float = 1.0 - age
  var scale_factor: float = (0.58 + age * (0.53 if is_footstep else (0.38 if is_water else 0.33))) * drop.w
  batched_mesh.set_instance_transform_2d(i,
   Transform2D(0.0, Vector2(scale_factor, scale_factor), 0.0, Vector2(drop.x, drop.y)))
  var alpha: float = (1.0 if is_footstep else (0.88 if is_water else 0.92)) * pow(fade, 1.35) * strength
  batched_mesh.set_instance_color(i,
   Color(0.96, 0.99, 1.0, alpha))
