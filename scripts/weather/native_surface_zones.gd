extends RefCounted
## Deliberately conservative terrain/river zoning for ONE baked 1672x941 PNG.
## This is not the old 4-layer PSD alpha mask: those objects are now baked in.
## Ellipse clearance is tested independently, so puddles cannot sit on a wall.
static func bare_soil() -> Array[PackedVector2Array]:
 return [
  PackedVector2Array([
   Vector2(515, 520), Vector2(605, 485), Vector2(748, 487),
   Vector2(851, 510), Vector2(845, 580), Vector2(760, 618),
   Vector2(637, 615), Vector2(535, 585)
  ]),
  PackedVector2Array([
   Vector2(845, 515), Vector2(958, 486), Vector2(1081, 484),
   Vector2(1138, 518), Vector2(1123, 565), Vector2(1045, 605),
   Vector2(936, 604), Vector2(853, 578)
  ])
 ]

static func bridge_deck() -> Array[PackedVector2Array]:
 # Painted plank-face-only rain contacts, in original 1672x941 PSD pixels.
 # Does not include handrails, river or the far-bank soil.
 return [PackedVector2Array([
  Vector2(1226, 684), Vector2(1326, 625),
  Vector2(1479, 734), Vector2(1382, 773)
 ])]

static func rain_contact_soil() -> Array[PackedVector2Array]:
 # Impacts belong to the two original yard zones AND the exposed far-bank
 # footpath beyond the wooden bridge. Puddles remain only in bare_soil().
 var zones: Array[PackedVector2Array] = bare_soil()
 zones.append(PackedVector2Array([
  Vector2(1563, 844), Vector2(1669, 820),
  Vector2(1670, 939), Vector2(1592, 939), Vector2(1563, 899)
 ]))
 return zones

static func puddle_spots() -> Array[Vector2]:
 return [
  Vector2(605, 544), Vector2(689, 545), Vector2(775, 544),
  Vector2(681, 584), Vector2(780, 583),
  Vector2(928, 548), Vector2(1020, 543),
  Vector2(959, 573)
 ]

static func river_water() -> Array[PackedVector2Array]:
 # Cut out the bridge deck entirely; the baked art does not have a
 # physically separate water texture that can be sorted underneath it.
 return [
  PackedVector2Array([
   Vector2(820, 939), Vector2(863, 891), Vector2(944, 851),
   Vector2(1025, 817), Vector2(1102, 784), Vector2(1159, 771),
   Vector2(1228, 775), Vector2(1260, 816), Vector2(1197, 852),
   Vector2(1110, 889), Vector2(1034, 924), Vector2(980, 940)
  ]),
  PackedVector2Array([
   Vector2(1545, 579), Vector2(1670, 585), Vector2(1670, 679),
   Vector2(1602, 661), Vector2(1554, 635)
  ])
 ]

static func point_in_any(point: Vector2, regions: Array[PackedVector2Array]) -> bool:
 for polygon in regions:
  if Geometry2D.is_point_in_polygon(point, polygon):
   return true
 return false

static func ellipse_on_soil(point: Vector2, ground: Array[PackedVector2Array]) -> bool:
 # 96x48 puddle quad is rendered around 0.80x0.53; four extra interior
 # probes cover the visible reflective rim, rather than only its center.
 for delta in [Vector2.ZERO,
  Vector2(39.0, 0.0), Vector2(-39.0, 0.0),
  Vector2(0.0, 15.0), Vector2(0.0, -15.0),
  Vector2(28.0, 10.0), Vector2(-28.0, 10.0),
  Vector2(28.0, -10.0), Vector2(-28.0, -10.0)]:
  if not point_in_any(point + delta, ground):
   return false
 return true

static func puddle_ellipse_on_soil(
 center: Vector2,
 full_size: Vector2,
 angle: float,
 ground: Array[PackedVector2Array],
 blocked: Array[PackedVector2Array] = []
) -> bool:
 # Test complete visible extent, not just the center. A 5% margin also
 # accounts for irregular rims and texture antialiasing.
 if not point_in_any(center, ground):
  return false
 for polygon in blocked:
  if Geometry2D.is_point_in_polygon(center, polygon):
   return false
 var cosine: float = cos(angle)
 var sine: float = sin(angle)
 for radial in [0.55, 1.06]:
  for index in range(24):
   var theta: float = TAU * float(index) / 24.0
   var local := Vector2(
    cos(theta) * full_size.x * 0.5 * radial,
    sin(theta) * full_size.y * 0.5 * radial)
   var point := center + Vector2(
    local.x * cosine - local.y * sine,
    local.x * sine + local.y * cosine)
   if not point_in_any(point, ground):
    return false
   for polygon in blocked:
    if Geometry2D.is_point_in_polygon(point, polygon):
     return false
 return true
