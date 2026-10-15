extends Control
## Touch/desktop friendly manual lighting presets; never blocks WASD or mobile joystick.
signal preset_delta(step: int)

var _caption: Label

func _ready() -> void:
 set_anchors_preset(Control.PRESET_TOP_RIGHT)
 offset_left = -253.0
 offset_top = 12.0
 offset_right = -12.0
 offset_bottom = 58.0
 mouse_filter = Control.MOUSE_FILTER_PASS
 var panel := PanelContainer.new()
 panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 add_child(panel)
 var row := HBoxContainer.new()
 row.alignment = BoxContainer.ALIGNMENT_CENTER
 panel.add_child(row)
 var previous := Button.new()
 previous.text = "‹"
 previous.custom_minimum_size = Vector2(35, 38)
 previous.focus_mode = Control.FOCUS_NONE
 previous.pressed.connect(func() -> void: preset_delta.emit(-1))
 row.add_child(previous)
 _caption = Label.new()
 _caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
 _caption.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
 _caption.custom_minimum_size = Vector2(158, 38)
 _caption.add_theme_font_size_override("font_size", 13)
 row.add_child(_caption)
 var next_button := Button.new()
 next_button.text = "›"
 next_button.custom_minimum_size = Vector2(35, 38)
 next_button.focus_mode = Control.FOCUS_NONE
 next_button.pressed.connect(func() -> void: preset_delta.emit(1))
 row.add_child(next_button)

func set_lighting_label(label: String) -> void:
 if _caption != null:
  _caption.text = label
