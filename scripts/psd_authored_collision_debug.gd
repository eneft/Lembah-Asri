extends Node2D
## Visualise the red Photoshop Collision group (blocked land).
## A single C tap displays the authored red shapes; never drawn by default.
var walkable_regions: Dictionary = {}
var player_foot: Vector2 = Vector2.ZERO
var clearance_radius: float = 9.0

func _draw() -> void:
 for name in walkable_regions:
  var polygon: PackedVector2Array = walkable_regions[name]
  if polygon.size() < 3:
   continue
  draw_colored_polygon(polygon, Color(1.0, 0.10, 0.08, 0.19))
  var ring := polygon.duplicate()
  ring.append(polygon[0])
  draw_polyline(ring, Color(1.0, 0.19, 0.12, 0.88), 2.0, true)
 draw_circle(player_foot, clearance_radius, Color(1.0, 0.93, 0.35, 0.21))
 draw_arc(player_foot, clearance_radius, 0.0, TAU, 40, Color(1.0, 0.95, 0.34, 0.98), 2.0, true)
