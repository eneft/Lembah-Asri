extends Node2D
## Mobile virtual analog joystick + separate Run / Jump touch buttons.
## One finger controls direction, while another can Run or Jump.
## Keep desktop keyboard controls and the existing FBX animations intact.

const BUTTON_DIAMETER := 92
const JOYSTICK_RADIUS := 66.0
const JOYSTICK_DEADZONE := 0.12
const TOUCH_ACTIONS := [
    "touch_forward", "touch_back", "touch_left", "touch_right",
    "touch_run", "touch_jump"
]

var _buttons: Dictionary = {}
var _normal_texture: Texture2D
var _pressed_texture: Texture2D
var _joystick_center := Vector2.ZERO
var _joystick_radius := JOYSTICK_RADIUS
var _joystick_scale := 1.0
var _joystick_axis := Vector2.ZERO
var _active_finger := -1
var _mouse_held := false

func _ready() -> void:
    name = "Buttons"
    for action_name in TOUCH_ACTIONS:
        if not InputMap.has_action(action_name):
            InputMap.add_action(action_name)
    _normal_texture = _make_texture(false)
    _pressed_texture = _make_texture(true)
    _make_button("Run", "touch_run")
    _make_button("Jump", "touch_jump")
    # Mobile Web detection differs across Safari and other browsers. Show
    # the joystick in Web builds too; PC WASD/Shift/Space still work.
    visible = DisplayServer.is_touchscreen_available() or OS.has_feature("web")
    _layout_controls()
    get_viewport().size_changed.connect(_layout_controls)
    queue_redraw()

func _make_texture(pressed: bool) -> Texture2D:
    var image := Image.create(BUTTON_DIAMETER, BUTTON_DIAMETER, false, Image.FORMAT_RGBA8)
    var center := Vector2(46.0, 46.0)
    for y in range(BUTTON_DIAMETER):
        for x in range(BUTTON_DIAMETER):
            var radius := Vector2(float(x) + 0.5, float(y) + 0.5).distance_to(center)
            if radius <= 43.0:
                var color := Color(0.22, 0.39, 0.30, 0.90) if pressed else Color(0.09, 0.22, 0.17, 0.73)
                if radius >= 39.0:
                    color = Color(0.91, 0.87, 0.69, 0.92)
                image.set_pixel(x, y, color)
            else:
                image.set_pixel(x, y, Color.TRANSPARENT)
    return ImageTexture.create_from_image(image)

func _make_button(button_name: String, action_name: String) -> void:
    var button := TouchScreenButton.new()
    button.name = button_name
    button.action = action_name
    button.texture_normal = _normal_texture
    button.texture_pressed = _pressed_texture
    button.visibility_mode = TouchScreenButton.VISIBILITY_ALWAYS
    button.passby_press = true
    var collision := CircleShape2D.new()
    collision.radius = 43.0
    button.shape = collision
    button.shape_centered = true
    add_child(button)

    var caption := Label.new()
    caption.name = "Caption"
    caption.text = "LARI" if button_name == "Run" else "LOMPAT"
    caption.position = Vector2(0.0, 26.0)
    caption.size = Vector2(92.0, 40.0)
    caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    caption.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
    caption.add_theme_font_size_override("font_size", 16)
    caption.add_theme_color_override("font_color", Color(1.0, 0.98, 0.87))
    caption.mouse_filter = Control.MOUSE_FILTER_IGNORE
    button.add_child(caption)
    _buttons[button_name] = button

func _layout_controls() -> void:
    if _buttons.size() != 2:
        return
    var viewport_size := get_viewport().get_visible_rect().size
    var scale_factor := clampf(minf(viewport_size.x / 900.0, viewport_size.y / 650.0), 0.56, 1.0)
    _joystick_scale = scale_factor
    _joystick_radius = JOYSTICK_RADIUS * scale_factor
    _joystick_center = Vector2(118.0 * scale_factor, viewport_size.y - 139.0 * scale_factor)
    var locations := {
        "Run": Vector2(viewport_size.x - 190.0 * scale_factor, viewport_size.y - 105.0 * scale_factor),
        "Jump": Vector2(viewport_size.x - 86.0 * scale_factor, viewport_size.y - 185.0 * scale_factor)
    }
    for button_name in _buttons.keys():
        var button: TouchScreenButton = _buttons[button_name]
        button.position = locations[button_name] - Vector2(46.0, 46.0) * scale_factor
        button.scale = Vector2.ONE * scale_factor
    queue_redraw()

func _draw() -> void:
    if not visible:
        return
    var r := _joystick_radius
    draw_circle(_joystick_center, r + 7.0 * _joystick_scale, Color(0.02, 0.10, 0.08, 0.28))
    draw_circle(_joystick_center, r, Color(0.06, 0.19, 0.14, 0.53))
    draw_arc(_joystick_center, r, 0.0, TAU, 64, Color(0.94, 0.89, 0.70, 0.78), 2.7 * _joystick_scale, true)
    var knob_center := _joystick_center + _joystick_axis * (r * 0.63)
    draw_circle(knob_center, 26.0 * _joystick_scale, Color(0.09, 0.19, 0.14, 0.96))
    draw_arc(knob_center, 25.0 * _joystick_scale, 0.0, TAU, 48, Color(0.95, 0.92, 0.76, 0.92), 2.7 * _joystick_scale, true)
    draw_circle(knob_center, 7.0 * _joystick_scale, Color(0.76, 0.83, 0.64, 0.65))

func _to_local_screen_position(screen_position: Vector2) -> Vector2:
    return get_global_transform_with_canvas().affine_inverse() * screen_position

func _set_joystick_position(screen_position: Vector2) -> void:
    var displacement: Vector2 = (_to_local_screen_position(screen_position) - _joystick_center) / _joystick_radius
    var raw_axis := displacement.limit_length(1.0)
    var amount := raw_axis.length()
    var axis := Vector2.ZERO
    if amount > JOYSTICK_DEADZONE:
        axis = raw_axis.normalized() * ((amount - JOYSTICK_DEADZONE) / (1.0 - JOYSTICK_DEADZONE))
    _set_joystick_axis(axis)

func _set_joystick_axis(axis: Vector2) -> void:
    _joystick_axis = axis.limit_length(1.0)
    _set_action_strength("touch_right", maxf(0.0, _joystick_axis.x))
    _set_action_strength("touch_left", maxf(0.0, -_joystick_axis.x))
    _set_action_strength("touch_back", maxf(0.0, _joystick_axis.y))
    _set_action_strength("touch_forward", maxf(0.0, -_joystick_axis.y))
    queue_redraw()

func _set_action_strength(action_name: StringName, strength: float) -> void:
    if strength <= 0.001:
        Input.action_release(action_name)
    else:
        Input.action_press(action_name, strength)

func _input(event: InputEvent) -> void:
    if not visible:
        return
    if event is InputEventScreenTouch:
        var touch := event as InputEventScreenTouch
        if touch.pressed:
            if _active_finger < 0 and not _mouse_held:
                var local_pos := _to_local_screen_position(touch.position)
                if local_pos.distance_to(_joystick_center) <= _joystick_radius * 1.35:
                    _active_finger = touch.index
                    _set_joystick_position(touch.position)
                    get_viewport().set_input_as_handled()
        elif touch.index == _active_finger:
            _active_finger = -1
            _set_joystick_axis(Vector2.ZERO)
            get_viewport().set_input_as_handled()
    elif event is InputEventScreenDrag:
        var drag := event as InputEventScreenDrag
        if drag.index == _active_finger:
            _set_joystick_position(drag.position)
            get_viewport().set_input_as_handled()
    elif event is InputEventMouseButton:
        var mouse_button := event as InputEventMouseButton
        if mouse_button.button_index == MOUSE_BUTTON_LEFT and _active_finger < 0:
            if mouse_button.pressed:
                if _to_local_screen_position(mouse_button.position).distance_to(_joystick_center) <= _joystick_radius * 1.35:
                    _mouse_held = true
                    _set_joystick_position(mouse_button.position)
                    get_viewport().set_input_as_handled()
            elif _mouse_held:
                _mouse_held = false
                _set_joystick_axis(Vector2.ZERO)
                get_viewport().set_input_as_handled()
    elif event is InputEventMouseMotion and _mouse_held:
        _set_joystick_position((event as InputEventMouseMotion).position)
        get_viewport().set_input_as_handled()

func _exit_tree() -> void:
    _set_joystick_axis(Vector2.ZERO)

func controls_are_visible() -> bool:
    return visible
