extends Node2D
## Standalone multi-touch controls for the 3D blockout.
## Each TouchScreenButton owns its own finger; Run+Move+Jump can overlap.
## Hidden on keyboard/mouse-only desktops.

const BUTTON_DIAMETER := 92
const ACTION_NAMES := {
    "Forward": "touch_forward",
    "Back": "touch_back",
    "Left": "touch_left",
    "Right": "touch_right",
    "Run": "touch_run",
    "Jump": "touch_jump"
}

var _buttons: Dictionary = {}
var _normal_texture: Texture2D
var _pressed_texture: Texture2D

func _ready() -> void:
    name = "Buttons"
    _normal_texture = _make_texture(false)
    _pressed_texture = _make_texture(true)
    for button_name in ACTION_NAMES.keys():
        var action_name: String = ACTION_NAMES[button_name]
        if not InputMap.has_action(action_name):
            InputMap.add_action(action_name)
        _make_button(button_name, action_name)
    visible = DisplayServer.is_touchscreen_available()
    _layout_buttons()
    get_viewport().size_changed.connect(_layout_buttons)

func _make_texture(pressed: bool) -> Texture2D:
    var image := Image.create(BUTTON_DIAMETER, BUTTON_DIAMETER, false, Image.FORMAT_RGBA8)
    var center := Vector2(float(BUTTON_DIAMETER) * 0.5, float(BUTTON_DIAMETER) * 0.5)
    for y in range(BUTTON_DIAMETER):
        for x in range(BUTTON_DIAMETER):
            var radius := Vector2(float(x) + 0.5, float(y) + 0.5).distance_to(center)
            if radius <= 43.0:
                var color := Color(0.17, 0.34, 0.29, 0.86) if pressed else Color(0.07, 0.19, 0.17, 0.66)
                if radius >= 38.0:
                    color = Color(0.96, 0.93, 0.74, 0.92)
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
    button.passby_press = true
    var collision := CircleShape2D.new()
    collision.radius = 43.0
    button.shape = collision
    button.shape_centered = true
    add_child(button)

    var text := Label.new()
    text.name = "Caption"
    match button_name:
        "Forward":
            text.text = "↑"
        "Back":
            text.text = "↓"
        "Left":
            text.text = "←"
        "Right":
            text.text = "→"
        "Run":
            text.text = "LARI"
        "Jump":
            text.text = "LOMPAT"
    text.position = Vector2(0.0, 26.0)
    text.size = Vector2(92.0, 40.0)
    text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
    text.add_theme_font_size_override("font_size", 17 if button_name in ["Run", "Jump"] else 28)
    text.add_theme_color_override("font_color", Color(1, 0.98, 0.89))
    text.mouse_filter = Control.MOUSE_FILTER_IGNORE
    button.add_child(text)
    _buttons[button_name] = button

func _layout_buttons() -> void:
    if _buttons.size() != 6:
        return
    var viewport_size := get_viewport().get_visible_rect().size
    var factor := clampf(minf(viewport_size.x / 900.0, viewport_size.y / 650.0), 0.56, 1.0)
    var spacing := 80.0 * factor
    var dpad_origin := Vector2(115.0 * factor, viewport_size.y - 130.0 * factor)
    var locations := {
        "Forward": dpad_origin + Vector2(0.0, -spacing),
        "Back": dpad_origin + Vector2(0.0, spacing),
        "Left": dpad_origin + Vector2(-spacing, 0.0),
        "Right": dpad_origin + Vector2(spacing, 0.0),
        "Run": Vector2(viewport_size.x - 190.0 * factor, viewport_size.y - 105.0 * factor),
        "Jump": Vector2(viewport_size.x - 86.0 * factor, viewport_size.y - 185.0 * factor)
    }
    for button_name in _buttons.keys():
        var button: TouchScreenButton = _buttons[button_name]
        # Textures draw from their top-left; align their center with the hit target.
        button.position = locations[button_name] - Vector2(46.0, 46.0) * factor
        button.scale = Vector2.ONE * factor

func controls_are_visible() -> bool:
    return visible
