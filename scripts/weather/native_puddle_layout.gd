extends RefCounted
## Sparse pools in approved soil pockets. Each new rain episode picks
## a fresh seed, while heavy rain/storm retain the same locations.
const SURFACE = preload("res://scripts/weather/native_surface_zones.gd")
const MIN_COUNT := 3
const MAX_COUNT := 4
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
 var count: int = rng.randi_range(MIN_COUNT, MAX_COUNT)
 # Eight manually reviewed soil pockets. Shuffle with the local RNG
 # (Array.shuffle uses a global RNG, breaking seeded reproducibility).
 var pockets: Array[Vector2] = SURFACE.puddle_spots()
 var indices: Array[int] = []
 for i in range(pockets.size()):
  indices.append(i)
 for i in range(indices.size() - 1, 0, -1):
  var j: int = rng.randi_range(0, i)
  var swap: int = indices[i]
  indices[i] = indices[j]
  indices[j] = swap
 # Prefer selected pockets. Slight jitter means positions aren't a grid.
 for index in indices:
  if output.size() >= count:
   break
  var anchor: Vector2 = pockets[index]
  for attempt in range(22):
   var center := anchor + Vector2(
    rng.randf_range(-13.0, 13.0), rng.randf_range(-8.0, 8.0))
   var size := Vector2(
    rng.randf_range(36.0, 65.0), rng.randf_range(15.0, 25.0))
   var rotation: float = rng.randf_range(-0.22, 0.22)
   if not _can_place(center, size, rotation, soil, forbidden, output):
    continue
   output.append(_pool(center, size, rotation, rng))
   break
 # A few authored pockets can be blocked in future PSD edits.
 # Fill remaining slots by rejection sampling on the CURRENT soil mask,
 # rather than putting water on a roof/rock or silently yielding zero.
 for attempt in range(MAX_CANDIDATE_ATTEMPTS):
  if output.size() >= count:
   break
  var region: PackedVector2Array = soil[rng.randi_range(0, soil.size() - 1)]
  var bounds := Rect2(region[0], Vector2.ZERO)
  for point in region:
   bounds = bounds.expand(point)
  var center := Vector2(
   rng.randf_range(bounds.position.x, bounds.end.x),
   rng.randf_range(bounds.position.y, bounds.end.y))
  var size := Vector2(
   rng.randf_range(32.0, 56.0), rng.randf_range(14.0, 22.0))
  var rotation: float = rng.randf_range(-0.20, 0.20)
  if _can_place(center, size, rotation, soil, forbidden, output):
   output.append(_pool(center, size, rotation, rng))
 return output

static func _can_place(
 center: Vector2, size: Vector2, rotation: float,
 soil: Array[PackedVector2Array],
 forbidden: Array[PackedVector2Array],
 placed: Array[Dictionary]
) -> bool:
 if not SURFACE.puddle_ellipse_on_soil(center, size, rotation, soil, forbidden):
  return false
 for existing in placed:
  var delta: Vector2 = center - (existing["center"] as Vector2)
  var old_size: Vector2 = existing["size"]
  var gap_x: float = (size.x + old_size.x) * 0.5 + 18.0
  var gap_y: float = (size.y + old_size.y) * 0.5 + 10.0
  if (delta.x / gap_x) ** 2 + (delta.y / gap_y) ** 2 < 1.0:
   return false
 return true

static func _pool(
 center: Vector2, size: Vector2, rotation: float,
 rng: RandomNumberGenerator
) -> Dictionary:
 return {
  "center": center,
  "size": size,
  "rotation": rotation,
  "phase": rng.randf_range(0.0, TAU),
  "opacity": rng.randf_range(0.78, 0.94),
  "shape_seed": rng.randf(),
  "edge_jag": rng.randf_range(0.075, 0.135),
  "lobes": rng.randi_range(3, 6)
 }
