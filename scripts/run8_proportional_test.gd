extends Node2D
## Desktop: WASD / arrows. Mobile: press any of the eight direction buttons.
## Starting mode intentionally plays in place for animation inspection.

const DIRS: Array[String] = [
    "down", "down_right", "right", "up_right",
    "up", "up_left", "left", "down_left"
]
const DISPLAY_NAMES := {
    "down": "FRONT / S",
    "down_right": "FRONT-RIGHT / SE",
    "right": "RIGHT / E",
    "up_right": "BACK-RIGHT / NE",
    "up": "BACK / N",
    "up_left": "BACK-LEFT / NW",
    "left": "LEFT / W",
    "down_left": "FRONT-LEFT / SW"
}

@onready var player = $Run8Player
@onready var hud: CanvasLayer = $HUD
var state_label: Label
var hint_label: Label
var source_label: Label
var controls: PanelContainer
var auto_rotate := true # Show all new 8-way RUN poses automatically on opening the browser test.
var move_player := false
var elapsed := 0.0
var index := 0
var last_keyboard_direction := Vector2.ZERO

func _ready() -> void:
    player.position = Vector2(get_viewport_rect().size.x * 0.42, get_viewport_rect().size.y * 0.75)
    _build_hud()
    get_viewport().size_changed.connect(_resize_layout)
    _resize_layout()
    _show_direction()
    print("PROPORTIONAL RUN8 PREVIEW ACTIVE: 74 poses, 8 directions, approved normalized atlas")

func _draw() -> void:
    var size := get_viewport_rect().size
    draw_rect(Rect2(Vector2.ZERO, size), Color("#e0efe6"))
    var spacing := 60.0
    var horizontal_count := int(ceil(size.x / spacing))
    var vertical_count := int(ceil(size.y / spacing))
    for i in range(horizontal_count + 1):
        draw_line(Vector2(float(i) * spacing, 0), Vector2(float(i) * spacing, size.y), Color("#c9dfd2"), 1.0)
    for j in range(vertical_count + 1):
        draw_line(Vector2(0, float(j) * spacing), Vector2(size.x, float(j) * spacing), Color("#c9dfd2"), 1.0)
    draw_circle(player.position, 6, Color("#426855"))
    draw_line(player.position + Vector2(-30, 0), player.position + Vector2(30, 0), Color("#527461"), 1.5)

func _process(delta: float) -> void:
    var movement := Vector2.ZERO
    if Input.is_action_pressed("ui_left") or Input.is_physical_key_pressed(KEY_A):
        movement.x -= 1.0
    if Input.is_action_pressed("ui_right") or Input.is_physical_key_pressed(KEY_D):
        movement.x += 1.0
    if Input.is_action_pressed("ui_up") or Input.is_physical_key_pressed(KEY_W):
        movement.y -= 1.0
    if Input.is_action_pressed("ui_down") or Input.is_physical_key_pressed(KEY_S):
        movement.y += 1.0

    if movement.length_squared() > 0.0:
        auto_rotate = false
        movement = movement.normalized()
        player.set_from_vector(movement)
        if move_player:
            player.position += movement * 185.0 * delta
            var viewport_size := get_viewport_rect().size
            player.position = player.position.clamp(Vector2(140, 255), viewport_size - Vector2(220, 35))
            queue_redraw()
        if movement != last_keyboard_direction:
            _show_direction()
        last_keyboard_direction = movement
    else:
        last_keyboard_direction = Vector2.ZERO
        if auto_rotate:
            elapsed += delta
            if elapsed >= 1.2:
                elapsed = 0.0
                index = (index + 1) % DIRS.size()
                player.set_direction(DIRS[index])
                _show_direction()

func _select_direction(direction: String) -> void:
    auto_rotate = false
    player.set_direction(direction)
    index = DIRS.find(direction)
    _show_direction()

func _show_direction() -> void:
    if state_label != null:
        var count: int = player.animated_sprite.sprite_frames.get_frame_count(player.animated_sprite.animation)
        var effective_fps: float = player.animated_sprite.sprite_frames.get_animation_speed(player.animated_sprite.animation) * player.animated_sprite.speed_scale
        state_label.text = "Direction: %s  |  %d frames  |  %.1f FPS" % [DISPLAY_NAMES[player.facing], count, effective_fps]

func _on_auto_toggled(enabled: bool) -> void:
    auto_rotate = enabled
    elapsed = 0.0
    if auto_rotate:
        index = DIRS.find(player.facing)

func _on_move_toggled(enabled: bool) -> void:
    move_player = enabled

func _on_fps_changed(value: float) -> void:
    player.set_fps(value)
    _show_direction()

func _build_hud() -> void:
    var full := Control.new()
    full.name = "Overlay"
    full.mouse_filter = Control.MOUSE_FILTER_IGNORE
    full.set_anchors_preset(Control.PRESET_FULL_RECT)
    hud.add_child(full)

    var title := Label.new()
    title.text = "LEMBAH ASRI  |  RUN8 PROPORTIONAL (NEW)"
    title.add_theme_font_size_override("font_size", 24)
    title.add_theme_color_override("font_color", Color("#173b2c"))
    title.position = Vector2(25, 18)
    full.add_child(title)

    source_label = Label.new()
    source_label.text = "SOURCE: Run8_Normalized_Base + Mirror  |  74 poses  |  bukan WALK 16-frame lama"
    source_label.position = Vector2(25, 55)
    source_label.add_theme_font_size_override("font_size", 15)
    source_label.add_theme_color_override("font_color", Color("#145a36"))
    full.add_child(source_label)

    state_label = Label.new()
    state_label.position = Vector2(25, 84)
    state_label.add_theme_font_size_override("font_size", 17)
    state_label.add_theme_color_override("font_color", Color("#315944"))
    full.add_child(state_label)

    hint_label = Label.new()
    hint_label.text = "RUN automatically plays in place. WASD/arrow or tap 8-direction buttons to test."
    hint_label.position = Vector2(25, 117)
    hint_label.add_theme_color_override("font_color", Color("#315944"))
    full.add_child(hint_label)

    controls = PanelContainer.new()
    controls.name = "DirectionPanel"
    controls.custom_minimum_size = Vector2(308, 0)
    controls.mouse_filter = Control.MOUSE_FILTER_STOP
    full.add_child(controls)

    var section := VBoxContainer.new()
    section.add_theme_constant_override("separation", 10)
    controls.add_child(section)
    var heading := Label.new()
    heading.text = "8 DIRECTIONS  (tap to test)"
    section.add_child(heading)
    var grid := GridContainer.new()
    grid.columns = 3
    grid.add_theme_constant_override("h_separation", 5)
    grid.add_theme_constant_override("v_separation", 5)
    section.add_child(grid)
    var labels := ["NW", "N", "NE", "W", "AUTO", "E", "SW", "S", "SE"]
    var mapped := ["up_left", "up", "up_right", "left", "", "right", "down_left", "down", "down_right"]
    for i in range(9):
        var btn := Button.new()
        btn.text = labels[i]
        btn.custom_minimum_size = Vector2(94, 56)
        grid.add_child(btn)
        if mapped[i].is_empty():
            btn.pressed.connect(_start_auto)
        else:
            btn.pressed.connect(_select_direction.bind(mapped[i]))
    var cycling := CheckButton.new()
    cycling.text = "Auto rotate every 1.2 s"
    cycling.toggled.connect(_on_auto_toggled)
    cycling.button_pressed = true
    section.add_child(cycling)
    var move_toggle := CheckButton.new()
    move_toggle.text = "Move in test area (WASD)"
    move_toggle.toggled.connect(_on_move_toggled)
    section.add_child(move_toggle)
    var fps_label := Label.new()
    fps_label.text = "Playback tempo (10 = normal; LEFT/RIGHT = 8 FPS)"
    section.add_child(fps_label)
    var fps := HSlider.new()
    fps.min_value = 4.0
    fps.max_value = 20.0
    fps.step = 0.5
    fps.value = 10.0
    fps.custom_minimum_size = Vector2(285, 20)
    fps.value_changed.connect(_on_fps_changed)
    section.add_child(fps)
    var size_label := Label.new()
    size_label.text = "Character size (pixels)"
    section.add_child(size_label)
    var size_slider := HSlider.new()
    size_slider.min_value = 140.0
    size_slider.max_value = 340.0
    size_slider.step = 1.0
    size_slider.value = 244.0
    size_slider.custom_minimum_size = Vector2(285, 20)
    size_slider.value_changed.connect(_on_size_changed)
    section.add_child(size_slider)
    var note := Label.new()
    note.text = "All 8 directions: equal 640 px body height.\nUniform X/Y scale. Natural running bounce kept."
    note.add_theme_color_override("font_color", Color("#526e5e"))
    section.add_child(note)

func _on_size_changed(value: float) -> void:
    player.set_character_height(value)

func _start_auto() -> void:
    _on_auto_toggled(true)

func _resize_layout() -> void:
    var sz := get_viewport_rect().size
    controls.position = Vector2(maxf(10.0, sz.x - 335.0), maxf(140.0, sz.y * 0.17))
    if not move_player:
        player.position = Vector2(sz.x * 0.42, sz.y * 0.75)
    queue_redraw()
