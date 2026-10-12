extends Node2D
## Standalone, non-breaking 8-direction movement preview.
## Uses the 16-frame, five-view native walk atlases ALREADY in the repository.
## Three left views mirror their right counterparts.
## The separately uploaded 8x8 RUN spritesheets are not committed yet.
const DIRS := ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]
const SOURCES := {
    "right": "res://assets/characters/player_hd/walk_atlases/right.png",
    "down_right": "res://assets/characters/player_hd/walk_atlases/down_right.png",
    "down": "res://assets/characters/player_hd/walk_atlases/down.png",
    "up_right": "res://assets/characters/player_hd/walk_atlases/up_right.png",
    "up": "res://assets/characters/player_hd/walk_atlases/up.png"
}
const TOUCH := {
    "up_left": Vector2(-1, -1), "up": Vector2(0, -1), "up_right": Vector2(1, -1),
    "left": Vector2(-1, 0), "right": Vector2(1, 0),
    "down_left": Vector2(-1, 1), "down": Vector2(0, 1), "down_right": Vector2(1, 1)
}
const CELL := Vector2i(512, 640)
const FPS := 16.0
@onready var actor: AnimatedSprite2D = $Runner
var heading: String = "down"
var touch_held: String = ""
var label_status: Label
var toggle_run: CheckButton

func _ready() -> void:
    _load_animations()
    _make_overlay()
    show_direction("down", false)
    queue_redraw()

func _load_animations() -> void:
    var bank := SpriteFrames.new()
    if bank.has_animation("default"):
        bank.remove_animation("default")
    for dir in DIRS:
        var basename: String = dir
        if dir == "left":
            basename = "right"
        elif dir == "down_left":
            basename = "down_right"
        elif dir == "up_left":
            basename = "up_right"
        var sheet: Texture2D = load(SOURCES[basename]) as Texture2D
        assert(sheet != null, "RUN8 missing atlas for " + dir)
        assert(sheet.get_size() == Vector2(2048, 2560), "RUN8 wrong atlas dimensions")
        var animation: String = "run_" + dir
        bank.add_animation(animation)
        bank.set_animation_speed(animation, FPS)
        bank.set_animation_loop(animation, true)
        for i in range(16):
            var region := AtlasTexture.new()
            region.atlas = sheet
            region.region = Rect2((i % 4) * CELL.x, int(i / 4) * CELL.y, CELL.x, CELL.y)
            region.filter_clip = true
            bank.add_frame(animation, region)
    actor.sprite_frames = bank

func show_direction(dir: String, moving: bool) -> void:
    heading = dir
    actor.flip_h = dir == "left" or dir == "up_left" or dir == "down_left"
    var anim: String = "run_" + dir
    if actor.animation != anim:
        var old_frame: int = actor.frame
        actor.animation = anim
        actor.frame = old_frame % 16
    if moving:
        if not actor.is_playing():
            actor.play()
    else:
        actor.stop()
        actor.frame = 0
    if label_status != null:
        label_status.text = "Arah: " + dir + " | Frame: " + str(actor.frame + 1) + "/16 | " + ("LARI" if moving else "DIAM")

func _process(delta: float) -> void:
    var motion := Vector2.ZERO
    if Input.is_action_pressed("ui_left") or Input.is_key_pressed(KEY_A):
        motion.x -= 1.0
    if Input.is_action_pressed("ui_right") or Input.is_key_pressed(KEY_D):
        motion.x += 1.0
    if Input.is_action_pressed("ui_up") or Input.is_key_pressed(KEY_W):
        motion.y -= 1.0
    if Input.is_action_pressed("ui_down") or Input.is_key_pressed(KEY_S):
        motion.y += 1.0
    if motion.length_squared() < 0.01 and touch_held != "":
        motion = TOUCH[touch_held]
    if motion.length_squared() > 0.01:
        motion = motion.normalized()
        var octant: int = posmod(int(round(motion.angle() / (PI / 4.0))), 8)
        var speed: float = 245.0 if (Input.is_key_pressed(KEY_SHIFT) or toggle_run.button_pressed) else 150.0
        actor.position += motion * speed * delta
        actor.position = actor.position.clamp(Vector2(120, 160), Vector2(1160, 645))
        show_direction(DIRS[octant], true)
    elif actor.is_playing():
        show_direction(heading, false)
    elif label_status != null:
        label_status.text = "Arah: " + heading + " | Frame: " + str(actor.frame + 1) + "/16 | DIAM"

func _draw() -> void:
    draw_rect(Rect2(0, 0, 1280, 720), Color("d6e5c9"))
    for x in range(0, 1281, 40):
        draw_line(Vector2(x, 0), Vector2(x, 720), Color(0.31, 0.49, 0.34, 0.13), 1.0)
    for y in range(0, 721, 40):
        draw_line(Vector2(0, y), Vector2(1280, y), Color(0.31, 0.49, 0.34, 0.13), 1.0)
    draw_rect(Rect2(90, 105, 1100, 565), Color("65865e"), false, 2.0)

func _make_overlay() -> void:
    var layer := CanvasLayer.new()
    add_child(layer)
    var ui := Control.new()
    layer.add_child(ui)
    ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    var title := Label.new()
    title.text = "LEMBAH ASRI | UJI 8 ARAH (ATLAS REPO)"
    title.position = Vector2(18, 10)
    title.add_theme_font_size_override("font_size", 24)
    title.add_theme_color_override("font_color", Color("203a25"))
    ui.add_child(title)
    var hint := Label.new()
    hint.text = "WASD / Panah: gerak  |  Shift: cepat  |  Touch: tombol arah"
    hint.position = Vector2(18, 48)
    hint.add_theme_color_override("font_color", Color("203a25"))
    ui.add_child(hint)
    label_status = Label.new()
    label_status.position = Vector2(18, 76)
    label_status.add_theme_color_override("font_color", Color("203a25"))
    ui.add_child(label_status)
    var buttons := [
        ["up_left", "↖", 0, 0], ["up", "↑", 1, 0], ["up_right", "↗", 2, 0],
        ["left", "←", 0, 1], ["right", "→", 2, 1],
        ["down_left", "↙", 0, 2], ["down", "↓", 1, 2], ["down_right", "↘", 2, 2]
    ]
    for entry in buttons:
        var btn := Button.new()
        btn.text = str(entry[1])
        btn.anchor_top = 1.0
        btn.anchor_bottom = 1.0
        btn.offset_left = 18.0 + int(entry[2]) * 65.0
        btn.offset_right = btn.offset_left + 60.0
        btn.offset_top = -220.0 + int(entry[3]) * 66.0
        btn.offset_bottom = btn.offset_top + 60.0
        btn.add_theme_font_size_override("font_size", 23)
        ui.add_child(btn)
        btn.button_down.connect(_touch_down.bind(str(entry[0])))
        btn.button_up.connect(_touch_up.bind(str(entry[0])))
    toggle_run = CheckButton.new()
    toggle_run.text = "LARI"
    toggle_run.button_pressed = true
    toggle_run.anchor_left = 1.0
    toggle_run.anchor_right = 1.0
    toggle_run.anchor_top = 1.0
    toggle_run.anchor_bottom = 1.0
    toggle_run.offset_left = -130.0
    toggle_run.offset_right = -12.0
    toggle_run.offset_top = -90.0
    toggle_run.offset_bottom = -35.0
    ui.add_child(toggle_run)

func _touch_down(name: String) -> void:
    touch_held = name

func _touch_up(name: String) -> void:
    if touch_held == name:
        touch_held = ""
