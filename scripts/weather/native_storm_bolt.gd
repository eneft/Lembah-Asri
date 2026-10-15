extends Node2D
## Small stylized lightning bolt in screen space, visible only during a
## short storm flash. Everything is CanvasItem: no 3D lights or new sprites.
var flash: float = 0.0
func set_flash(intensity: float) -> void:
 flash = clampf(intensity, 0.0, 1.0)
 visible = flash > 0.08
 if visible:
  queue_redraw()

func _draw() -> void:
 if flash < 0.08:
  return
 var viewport: Vector2 = get_viewport_rect().size
 var start := Vector2(viewport.x * 0.81, viewport.y * 0.06)
 var unit: float = minf(viewport.x, viewport.y) * 0.015
 var line := PackedVector2Array([
  start, start + Vector2(-unit, 3.0*unit),
  start + Vector2(1.0*unit, 4.0*unit),
  start + Vector2(-0.7*unit, 7.0*unit),
  start + Vector2(0.0, 8.0*unit),
  start + Vector2(-1.7*unit, 12.0*unit)
 ])
 draw_polyline(line, Color(0.65, 0.85, 1.0, 0.18 * flash), 15.0 * flash, true)
 draw_polyline(line, Color(0.95, 0.99, 1.0, 0.8 * flash), 2.0 + 2.5 * flash, true)
