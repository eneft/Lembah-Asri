extends RefCounted
## Author-controlled random puddles for the Camera2D scene only.
## Spawn once per rain episode; NOT each rendered frame. All perimeter
## probes must be inside approved soil AND outside red Photoshop obstacles.
const SURFACE = preload("res://scripts/weather/native_surface_zones.gd")
const MIN_COUNT := 7
const MAX_COUNT := 11
const MAX_CANDIDATE_ATTEMPTS := 220

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
  var accepted: bool = false
  for attempt in range(MAX_CANDIDATE_ATTEMPTS):
   var polygon: PackedVector2Array = soil[rng.randi_range(0, soil.size()-1)]
   var bounds := Rect2(polygon[0], Vector2.ZERO)
   for vertex in polygon:
    bounds = bounds.expand(vertex)
   var center := Vector2(
    rng.randf_range(bounds.position.x, bounds.end.x),
    rng.randf_range(bounds.position.y, bounds.end.y))
   var size := Vector2(rng.randf_range(38.0, 83.0), rng.randf_range(15.0, 30.0))
   var rotation: float = rng.randf_range(-0.22, 0.22)
   if not SURFACE.puddle_ellipse_on_soil(center, size, rotation, soil, forbidden):
    continue
   var spaced: bool = true
   for existing in output:
    var neighbor: Vector2 = existing["center"]
    var neighbor_size: Vector2 = existing["size"]
    # Loose separation in isometric screen-space: clusters are allowed,
    # but puddles must never form identical overlapping blue bands.
    var safe_x: float = (size.x + neighbor_size.x) * 0.49 + 8.0
    var safe_y: float = (size.y + neighbor_size.y) * 0.49 + 5.0
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
    "opacity": rng.randf_range(0.55, 0.83)
   })
   accepted = true
   break
  if not accepted:
   break
 return output
