extends RefCounted
## Independent random shapes and non-uniform gaps on Photoshop-approved soil.
## Only sample when a rainy episode starts; never move a puddle every frame.
const SURFACE = preload("res://scripts/weather/native_surface_zones.gd")
const MIN_COUNT := 7
const MAX_COUNT := 11
const MAX_CANDIDATE_ATTEMPTS := 420

static func generate(
 soil: Array[PackedVector2Array],
 forbidden: Array[PackedVector2Array],
 seed: int = -1
) -> Array[Dictionary]:
 var output: Array[Dictionary] = []
 if soil.is_empty():
  return output
 var rng := RandomNumberGenerator.new()
 if seed < 0:
  rng.randomize()
 else:
  rng.seed = seed
 var target_count: int = rng.randi_range(MIN_COUNT, MAX_COUNT)
 for i in range(target_count):
  for attempt in range(MAX_CANDIDATE_ATTEMPTS):
   var polygon: PackedVector2Array = soil[rng.randi_range(0, soil.size()-1)]
   var bounds := Rect2(polygon[0], Vector2.ZERO)
   for vertex in polygon:
    bounds = bounds.expand(vertex)
   var size_class: float = rng.randf()
   var size: Vector2
   if size_class < 0.30:
    size = Vector2(rng.randf_range(27.0, 43.0), rng.randf_range(10.0, 19.0))
   elif size_class < 0.82:
    size = Vector2(rng.randf_range(43.0, 72.0), rng.randf_range(17.0, 29.0))
   else:
    size = Vector2(rng.randf_range(73.0, 90.0), rng.randf_range(24.0, 34.0))
   var center := Vector2(
    rng.randf_range(bounds.position.x, bounds.end.x),
    rng.randf_range(bounds.position.y, bounds.end.y))
   # Sometimes sample around an existing pool, sometimes anywhere on soil.
   # This creates natural groups and open spaces rather than a fixed grid.
   if output.size() > 1 and rng.randf() < 0.43:
    var anchor: Vector2 = output[rng.randi_range(0,output.size()-1)]["center"]
    center = anchor + Vector2(
     rng.randf_range(-120.0,120.0), rng.randf_range(-48.0,48.0))
   var rotation: float = rng.randf_range(-0.34, 0.34)
   if not SURFACE.puddle_ellipse_on_soil(center, size, rotation, soil, forbidden):
    continue
   var spaced: bool = true
   var personal_margin: float = rng.randf_range(3.0, 13.0)
   for existing in output:
    var neighbor: Vector2 = existing["center"]
    var neighbor_size: Vector2 = existing["size"]
    var safe_x: float = (size.x + neighbor_size.x) * 0.50 + personal_margin
    var safe_y: float = (size.y + neighbor_size.y) * 0.50 + personal_margin * 0.42
    var delta: Vector2 = center - neighbor
    if (delta.x / safe_x) ** 2 + (delta.y / safe_y) ** 2 < 1.0:
     spaced = false
     break
   if not spaced:
    continue
   output.append({
    "center": center,
    "size": size,
    "rotation": rotation,
    "phase": rng.randf_range(0.0, TAU),
    "opacity": rng.randf_range(0.70, 0.96),
    # Every pool gets its OWN shoreline/noise profile, not a shared oval.
    "shape_seed": rng.randf(),
    "edge_jag": rng.randf_range(0.075, 0.155),
    "lobes": rng.randi_range(3, 6)
   })
   break
 return output
