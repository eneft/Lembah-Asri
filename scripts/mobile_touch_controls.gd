extends Control
## Lembah Asri — genuine two-finger mobile control surface.
## Touch events are tracked by distinct finger indices. No mouse/keyboard spoofing.
## Drawing is resolution-independent and uses built-in Godot primitives, not
## external textures. Works on Android/iOS browsers and native mobile.
signal move_changed(direction: Vector2)
signal run_changed(is_running: bool)
signal interact_requested

@export var force_show_for_testing: bool = false
@export var action_enabled: bool = false # No usable interactions in Stage 1; retain future support
const JOY_RADIUS := 76.0
const JOY_HIT_RADIUS := 103.0
const STICK_TRAVEL := 53.0
const RUN_RADIUS := 51.0
const ACTION_RADIUS := 63.0

## Animated mobile controls use PNG skins when supplied, without changing input.
var _skin_joy: Texture2D
var _skin_thumb: Texture2D
var _skin_run: Texture2D
var _skin_action: Texture2D

func _load_control_skin() -> void:
 var root_path: String = "res://assets/ui/rpg_hud_v1/"
 var names: Array[String] = ["joystick.png","joystick_thumb.png","run_button.png","action_button.png"]
 for name in names:
  if not ResourceLoader.exists(root_path+name):
   return
 _skin_joy = load(root_path+names[0]) as Texture2D
 _skin_thumb = load(root_path+names[1]) as Texture2D
 _skin_run = load(root_path+names[2]) as Texture2D
 _skin_action = load(root_path+names[3]) as Texture2D

func _draw_png_controls() -> void:
 var s: float = _ui_scale()
 var joy: Vector2 = get_joystick_center()
 var center: Vector2 = joy+move_vector*STICK_TRAVEL*s
 var joy_side: float = 195*s
 draw_texture_rect(_skin_joy,Rect2(joy-Vector2.ONE*joy_side*.5,Vector2.ONE*joy_side),false)
 var thumb_side: float = 80*s
 draw_texture_rect(_skin_thumb,Rect2(center-Vector2.ONE*thumb_side*.5,Vector2.ONE*thumb_side),false)
 var run_side: float = 118*s
 var run: Vector2 = get_run_center()
 draw_texture_rect(_skin_run,Rect2(run-Vector2.ONE*run_side*.5,Vector2.ONE*run_side),
  false,Color(0.78,0.92,0.72,1.0) if run_held else Color.WHITE)
 if action_enabled:
  var action: Vector2 = get_interact_center()
  var action_side: float = 140*s
  draw_texture_rect(_skin_action,Rect2(action-Vector2.ONE*action_side*.5,
   Vector2.ONE*action_side),false,
   Color(0.90,0.85,0.66,1.0) if _action_finger!=-1 else Color.WHITE)

var move_vector: Vector2 = Vector2.ZERO
var run_held: bool = false
var _joystick_finger: int = -1
var _run_finger: int = -1
var _action_finger: int = -1

func _ready() -> void:
    _load_control_skin()
    set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    # On Godot Web this looks at the actual browser device instead of merely
    # OS.has_feature("web"), which is true on desktop browsers too.
    visible = force_show_for_testing or _is_touch_device()
    set_process_input(visible)
    resized.connect(queue_redraw)
    print("MOBILE CONTROLS: " + ("enabled" if visible else "desktop keyboard mode"))

func _is_touch_device() -> bool:
    if DisplayServer.is_touchscreen_available():
        return true
    if OS.has_feature("web"):
        var touch_capability: Variant = JavaScriptBridge.eval(
            "Boolean((navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches))",
            true
        )
        return touch_capability is bool and touch_capability
    return OS.has_feature("mobile")

func set_test_visible(enable: bool) -> void:
    visible = enable
    set_process_input(enable)
    if not enable:
        cancel_touches()
    queue_redraw()

func _ui_scale() -> float:
    return clampf(minf(size.x / 1150.0, size.y / 670.0), 0.68, 1.17)

func get_joystick_center() -> Vector2:
    var s := _ui_scale()
    return Vector2(121.0 * s, size.y - 117.0 * s)

func get_run_center() -> Vector2:
    var s := _ui_scale()
    return Vector2(size.x - 225.0 * s, size.y - 101.0 * s)

func get_interact_center() -> Vector2:
    var s := _ui_scale()
    return Vector2(size.x - 113.0 * s, size.y - 160.0 * s)

func _input(event: InputEvent) -> void:
    if not visible:
        return
    if event is InputEventScreenTouch:
        var touch := event as InputEventScreenTouch
        if touch.pressed:
            _touch_start(touch.index, touch.position)
        else:
            _touch_end(touch.index)
    elif event is InputEventScreenDrag:
        var drag := event as InputEventScreenDrag
        if drag.index == _joystick_finger:
            _update_joystick(drag.position)

func _touch_start(finger: int, at: Vector2) -> void:
    var scale_factor := _ui_scale()
    if action_enabled and _action_finger == -1 and at.distance_to(get_interact_center()) <= ACTION_RADIUS * scale_factor:
        _action_finger = finger
        interact_requested.emit()
        queue_redraw()
        get_viewport().set_input_as_handled()
    elif _run_finger == -1 and at.distance_to(get_run_center()) <= RUN_RADIUS * scale_factor * 1.18:
        _run_finger = finger
        run_held = true
        run_changed.emit(true)
        queue_redraw()
        get_viewport().set_input_as_handled()
    elif _joystick_finger == -1 and at.distance_to(get_joystick_center()) <= JOY_HIT_RADIUS * scale_factor:
        _joystick_finger = finger
        _update_joystick(at)
        get_viewport().set_input_as_handled()

func _update_joystick(at: Vector2) -> void:
    var offset := (at - get_joystick_center()) / (STICK_TRAVEL * _ui_scale())
    var strength := clampf(offset.length(), 0.0, 1.0)
    # Prevent a stationary finger from causing unwanted player drift.
    var new_direction := Vector2.ZERO
    if strength > 0.17:
        new_direction = offset.normalized() * (strength - 0.17) / 0.83
    move_vector = new_direction
    move_changed.emit(move_vector)
    queue_redraw()

func _touch_end(finger: int) -> void:
    if finger == _joystick_finger:
        _joystick_finger = -1
        move_vector = Vector2.ZERO
        move_changed.emit(Vector2.ZERO)
        queue_redraw()
    elif finger == _run_finger:
        _run_finger = -1
        run_held = false
        run_changed.emit(false)
        queue_redraw()
    elif finger == _action_finger:
        _action_finger = -1
        queue_redraw()

func cancel_touches() -> void:
    _joystick_finger = -1
    _run_finger = -1
    _action_finger = -1
    move_vector = Vector2.ZERO
    run_held = false
    move_changed.emit(Vector2.ZERO)
    run_changed.emit(false)
    queue_redraw()

func _exit_tree() -> void:
    cancel_touches()

func _draw() -> void:
    if not visible:
        return
    if _skin_joy != null and _skin_thumb != null and _skin_run != null and _skin_action != null:
        _draw_png_controls()
        return
    var scale_factor := _ui_scale()
    var joy := get_joystick_center()
    var accent := Color(0.95, 0.84, 0.61, 0.90)
    var background := Color(0.08, 0.20, 0.15, 0.46)
    var edge := Color(0.98, 0.91, 0.74, 0.63)
    draw_circle(joy, JOY_RADIUS * scale_factor, background, true, -1.0, true)
    draw_arc(joy, JOY_RADIUS * scale_factor, 0.0, TAU, 64, edge, 3.0 * scale_factor, true)
    draw_circle(joy + move_vector * STICK_TRAVEL * scale_factor, 30.0 * scale_factor, Color(0.97, 0.88, 0.66, 0.76), true, -1.0, true)
    draw_arc(joy + move_vector * STICK_TRAVEL * scale_factor, 30.0 * scale_factor, 0.0, TAU, 40, Color(0.25, 0.33, 0.20, 0.70), 2.0 * scale_factor, true)
    _draw_button(get_run_center(), RUN_RADIUS * scale_factor, "LARI", accent, run_held)
    if action_enabled:
        _draw_button(get_interact_center(), ACTION_RADIUS * scale_factor, "AKSI", accent, _action_finger != -1)

func _draw_button(at: Vector2, radius: float, caption: String, border_color: Color, active: bool) -> void:
    draw_circle(at, radius, Color(0.27, 0.40, 0.24, 0.81) if active else Color(0.10, 0.23, 0.17, 0.62), true, -1.0, true)
    draw_arc(at, radius, 0.0, TAU, 52, border_color, 3.0 * _ui_scale(), true)
    var font: Font = ThemeDB.fallback_font
    var font_size: int = maxi(14, int(19.0 * _ui_scale()))
    draw_string(font, at + Vector2(0.0, float(font_size) * 0.36), caption, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size, Color(1.0, 0.97, 0.86, 1.0))
