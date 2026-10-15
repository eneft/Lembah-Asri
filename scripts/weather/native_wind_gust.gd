extends Node2D
## Few faint moving wind trails; baked single background cannot sway trees.
var gust: float = 0.0
var clock: float = 0.0
var redraw_clock: float = 0.0

func _ready() -> void:
 z_index = 9
 visible = false

func set_gust(amount: float) -> void:
 gust = clampf(amount, -1.0, 1.0)
 visible = absf(gust) > 0.22
 if visible:
  queue_redraw()

func _process(delta: float) -> void:
 if not visible:
  return
 clock += minf(delta, 0.05)
 redraw_clock += minf(delta, 0.05)
 if redraw_clock >= 0.085:
  redraw_clock = 0.0
  queue_redraw()

func _draw() -> void:
 if absf(gust) < 0.22:
  return
 for i in range(9):
  var phase: float = float(i) * 0.62
  var x: float = 460.0 + fposmod(float(i) * 117.0 + clock * gust * 102.0, 720.0)
  var y: float = 493.0 + float((i * 41) % 128) + sin(clock * 1.3 + phase) * 8.0
  var span: float = 15.0 + float(i % 3) * 10.0
  var start := Vector2(x, y)
  var finish := start + Vector2(span * signf(gust), -span * 0.08)
  draw_line(start, finish, Color(0.85, 0.96, 1.0, absf(gust) * 0.20), 1.1, true)
