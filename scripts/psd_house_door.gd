extends Node2D
## Interactive front double door for the existing, open-centered house art.
## No PSD pixel changes, no new colliders, no camera/movement modifications.
## Each hinge leaf reuses wood details sampled from the ORIGINAL house PNG.
const HOUSE_WOOD: Texture2D = preload("res://assets/art/psd_background/02_house.png")
const OPEN_SECONDS: float = 0.44
const LEFT_HINGE_TOP := Vector2(608.0, 203.0)
const LEFT_HINGE_BOTTOM := Vector2(608.0, 317.0)
const RIGHT_HINGE_TOP := Vector2(675.0, 195.0)
const RIGHT_HINGE_BOTTOM := Vector2(675.0, 307.0)
const LEFT_SEAM_TOP := Vector2(644.0, 199.0)
const LEFT_SEAM_BOTTOM := Vector2(644.0, 312.0)
const RIGHT_SEAM_TOP := Vector2(644.0, 199.0)
const RIGHT_SEAM_BOTTOM := Vector2(644.0, 312.0)

var is_open: bool = false
var open_progress: float = 0.0
var left_base: Polygon2D
var right_base: Polygon2D
var left_wood: Polygon2D
var right_wood: Polygon2D

func _ready() -> void:
 # This is a separate world layer, BELOW the character, above facade paint.
 z_index = 16
 left_base = _new_leaf("LeftDoorBacking", null, Color(0.31, 0.21, 0.15))
 left_wood = _new_leaf("LeftDoorPaint", HOUSE_WOOD, Color(0.93, 0.91, 0.85))
 right_base = _new_leaf("RightDoorBacking", null, Color(0.28, 0.19, 0.14))
 right_wood = _new_leaf("RightDoorPaint", HOUSE_WOOD, Color(0.92, 0.89, 0.83))
 left_wood.uv = PackedVector2Array([
  Vector2(407, 327), Vector2(446, 320),
  Vector2(446, 425), Vector2(407, 430)
 ])
 right_wood.uv = PackedVector2Array([
  Vector2(511, 307), Vector2(548, 302),
  Vector2(548, 408), Vector2(511, 415)
 ])
 _update_visual()
 set_process(true)

func _new_leaf(node_name: String, source: Texture2D, tint: Color) -> Polygon2D:
 var leaf := Polygon2D.new()
 leaf.name = node_name
 leaf.color = tint
 leaf.texture = source
 leaf.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
 leaf.antialiased = true
 add_child(leaf)
 return leaf

func set_open(want_open: bool) -> void:
 is_open = want_open

func toggle() -> void:
 set_open(not is_open)

func _process(delta: float) -> void:
 var destination: float = 1.0 if is_open else 0.0
 if is_equal_approx(open_progress, destination):
  return
 open_progress = move_toward(open_progress, destination, minf(delta, 0.08) / OPEN_SECONDS)
 _update_visual()

func _update_visual() -> void:
 # Projected hinge swing: leaves shrink to their original side frames,
 # giving natural perspective foreshortening without deforming the house.
 var eased: float = smoothstep(0.0, 1.0, open_progress)
 var projected_width: float = maxf(0.002, cos(eased * PI * 0.5))
 var left_free_top: Vector2 = LEFT_HINGE_TOP.lerp(LEFT_SEAM_TOP, projected_width)
 var left_free_bottom: Vector2 = LEFT_HINGE_BOTTOM.lerp(LEFT_SEAM_BOTTOM, projected_width)
 var right_free_top: Vector2 = RIGHT_HINGE_TOP.lerp(RIGHT_SEAM_TOP, projected_width)
 var right_free_bottom: Vector2 = RIGHT_HINGE_BOTTOM.lerp(RIGHT_SEAM_BOTTOM, projected_width)
 # The opening behind them is the unmodified, authentic painted doorway.
 var left_shape := PackedVector2Array([
  LEFT_HINGE_TOP, left_free_top, left_free_bottom, LEFT_HINGE_BOTTOM
 ])
 var right_shape := PackedVector2Array([
  right_free_top, RIGHT_HINGE_TOP, RIGHT_HINGE_BOTTOM, right_free_bottom
 ])
 left_base.polygon = left_shape
 left_wood.polygon = left_shape
 right_base.polygon = right_shape
 right_wood.polygon = right_shape
 var fully_open: bool = open_progress >= 0.995
 left_base.visible = not fully_open
 left_wood.visible = not fully_open
 right_base.visible = not fully_open
 right_wood.visible = not fully_open
