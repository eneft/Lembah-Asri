extends Node2D
## Optional F3 collision visualizer. No physics or GPU work when hidden.
var walkable_regions: Dictionary = {}
var player_foot: Vector2 = Vector2.ZERO
var clearance_radius: float = 9.0

func _draw() -> void:
 for name in walkable_regions:
  var polygon: PackedVector2Array = walkable_regions[name]
  if polygon.size() < 3:
   continue
  draw_colored_polygon(polygon, Color(0.11, 0.89, 0.31, 0.19) if name == "Halaman dalam pagar" else Color(0.08, 0.69, 1.0, 0.23))
  var outline := polygon.duplicate()
  outline.append(polygon[0])
  draw_polyline(outline, Color(0.1, 1.0, 0.38, 0.9) if name == "Halaman dalam pagar" else Color(0.1, 0.73, 1.0, 0.98), 3.0, true)
 draw_circle(player_foot, clearance_radius, Color(0.97, 0.18, 0.12, 0.25))
 draw_arc(player_foot, clearance_radius, 0.0, TAU, 40, Color(1, 0.15, 0.11, 0.95), 2.0, true)
