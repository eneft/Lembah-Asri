extends Node2D
## Soft contact shadow anchored to the physical foot. Never drives movement.
## This is separate from the animated cast silhouette: the player always
## touches the ground even when a RUN8 frame naturally lifts one shoe.
const GROUND_OPACITY := [0.27, 0.31, 0.30, 0.18]
@export_range(10.0, 30.0, 1.0) var contact_width: float = 18.0
@export_range(3.0, 12.0, 1.0) var contact_height: float = 6.0
@onready var avatar: CharacterBody2D = get_node("../Run8Player") as CharacterBody2D
@onready var hero: AnimatedSprite2D = get_node("../Run8Player/AnimatedSprite2D") as AnimatedSprite2D
@onready var stage: Node2D = get_parent() as Node2D
var _opacity: float = 0.31

func _ready() -> void:
 z_index = 7
 process_priority = 11
 _sync_contact(true)
 print("PSD NATIVE2D FOOT CONTACT READY: soft shadow glued to real character foot")

func _process(delta: float) -> void:
 _sync_contact(false, delta)

func _sync_contact(instant: bool = false, delta: float = 0.0) -> void:
 if avatar == null or hero == null:
  return
 position = avatar.position + Vector2(0.0, 1.0)
 var density: float = float(avatar.get("raster_density"))
 var native_scale: float = float(avatar.get("character_height_px")) / (640.0 * density)
 var depth: float = hero.scale.x / maxf(0.001, native_scale)
 scale = Vector2.ONE * depth
 var mode: int = clampi(int(stage.get("lighting_preset_index")), 0, 3)
 var speed: float = maxf(0.1, float(stage.get("lighting_transition_speed")))
 var weight: float = 1.0 if instant else 1.0 - exp(-speed * maxf(0.0, delta))
 var new_alpha: float = lerpf(_opacity, GROUND_OPACITY[mode], weight)
 if absf(new_alpha - _opacity) > 0.0005:
  _opacity = new_alpha
  queue_redraw()

func _draw() -> void:
 for ring in range(3):
  var ratio: float = 1.0 - float(ring) * 0.22
  var alpha: float = _opacity * (0.16 + float(ring) * 0.11)
  var verts := PackedVector2Array()
  for k in range(28):
   var angle: float = TAU * float(k) / 28.0
   verts.append(Vector2(cos(angle) * contact_width * ratio,
    sin(angle) * contact_height * ratio))
  draw_colored_polygon(verts, Color(0.045, 0.06, 0.045, alpha))
