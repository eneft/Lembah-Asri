extends Node2D
## Lembah Asri art-first prototype.
## 2D illustrated artwork drives the level view; no 3D placeholder meshes.

const PLAYER_SCENE: PackedScene = preload("res://scenes/player_2d.tscn")
const CONCEPT_FILE: String = "res://assets/art/concept_farm.png"
const WORLD_SIZE: Vector2 = Vector2(1650.0, 928.0)

var player: CharacterBody2D
var artwork: Sprite2D
var hint_label: Label
var dialogue_panel: ColorRect
var dialogue_label: Label
var art_loaded: bool = false
var interaction_timer: float = 0.0
var places: Array[Dictionary] = [
    {"name": "Bu Sari", "position": Vector2(800, 524), "dialogue": "Bu Sari: Masih ingat waktu kecil sering main di sini? Selamat pulang ke Lembah Asri!"},
    {"name": "Pasar Desa", "position": Vector2(1485, 310), "dialogue": "Penjual: Selamat pagi! Sayuran segar dari kebun warga, ayo mampir!"},
    {"name": "Kandang", "position": Vector2(1210, 500), "dialogue": "Sapi dan domba tampak senang melihatmu datang."},
    {"name": "Kebun", "position": Vector2(450, 736), "dialogue": "Kebun masa kecilmu menunggu ditanami lagi. Sistem bercocok tanam menyusul."},
    {"name": "Jembatan", "position": Vector2(1260, 310), "dialogue": "Suara air sungai mengingatkanmu pada masa kecil di desa."}
]

func _ready() -> void:
    artwork = Sprite2D.new()
    artwork.name = "ConceptArtwork2D"
    artwork.centered = false
    artwork.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
    artwork.z_index = -20
    add_child(artwork)
    if ResourceLoader.exists(CONCEPT_FILE):
        var tex := load(CONCEPT_FILE) as Texture2D
        if tex != null:
            artwork.texture = tex
            artwork.scale = WORLD_SIZE / tex.get_size()
            art_loaded = true
    queue_redraw()
    player = PLAYER_SCENE.instantiate()
    player.position = Vector2(698, 560)
    add_child(player)
    _make_ui()

func _draw() -> void:
    if art_loaded:
        return
    # Placeholder ONLY when the actual user-approved concept file is missing.
    draw_rect(Rect2(Vector2.ZERO, WORLD_SIZE), Color("#6cae70"))
    draw_rect(Rect2(Vector2(0, 210), WORLD_SIZE - Vector2(0, 210)), Color("#9dba7a"))
    draw_rect(Rect2(180, 330, 430, 250), Color("#efddba"))
    draw_rect(Rect2(145, 275, 500, 80), Color("#bb6b42"))
    draw_rect(Rect2(200, 600, 750, 180), Color("#805c3c"))
    draw_rect(Rect2(1280, 250, 210, 610), Color("#5bacc6"))
    draw_rect(Rect2(50, 200, 1550, 40), Color("#7baf86"))

func _process(delta: float) -> void:
    if interaction_timer > 0.0:
        interaction_timer -= delta
        dialogue_panel.visible = true
    else:
        dialogue_panel.visible = false
    var nearby := _nearby_place()
    if nearby.is_empty():
        hint_label.text = "WASD / Panah: jalan     •     E: interaksi"
    else:
        hint_label.text = "[E] %s" % nearby["name"]

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_E:
        var nearby := _nearby_place()
        if not nearby.is_empty():
            dialogue_label.text = nearby["dialogue"]
            interaction_timer = 5.0
            dialogue_panel.visible = true

func _nearby_place() -> Dictionary:
    if not is_instance_valid(player):
        return {}
    var nearest: Dictionary = {}
    var dist := 105.0
    for place in places:
        var d := player.position.distance_to(place["position"])
        if d < dist:
            dist = d
            nearest = place
    return nearest

func _make_ui() -> void:
    var hud := CanvasLayer.new()
    hud.name = "Interface"
    add_child(hud)
    hint_label = Label.new()
    hint_label.position = Vector2(26, 655)
    hint_label.add_theme_font_size_override("font_size", 19)
    hint_label.add_theme_color_override("font_color", Color("#fff5df"))
    hint_label.add_theme_color_override("font_shadow_color", Color("#353524"))
    hint_label.add_theme_constant_override("shadow_offset_x", 2)
    hint_label.add_theme_constant_override("shadow_offset_y", 2)
    hud.add_child(hint_label)
    dialogue_panel = ColorRect.new()
    dialogue_panel.color = Color(0.12, 0.19, 0.13, 0.87)
    dialogue_panel.position = Vector2(240, 565)
    dialogue_panel.size = Vector2(800, 72)
    dialogue_panel.visible = false
    hud.add_child(dialogue_panel)
    dialogue_label = Label.new()
    dialogue_label.position = Vector2(20, 15)
    dialogue_label.size = Vector2(760, 56)
    dialogue_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    dialogue_label.add_theme_font_size_override("font_size", 18)
    dialogue_label.add_theme_color_override("font_color", Color("#fff8e8"))
    dialogue_panel.add_child(dialogue_label)
    if not art_loaded:
        var missing_panel := ColorRect.new()
        missing_panel.color = Color(0.17, 0.16, 0.12, 0.91)
        missing_panel.position = Vector2(200, 220)
        missing_panel.size = Vector2(880, 135)
        hud.add_child(missing_panel)
        var warning := Label.new()
        warning.position = Vector2(22, 16)
        warning.size = Vector2(830, 100)
        warning.text = "MODE 2D SUDAH AKTIF — gambar konsep belum ada di repository.\nUpload assets/art/concept_farm.png untuk menampilkan visual aslinya.\nKamera, gerakan, dan interaksi NPC sudah disiapkan."
        warning.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
        warning.add_theme_font_size_override("font_size", 23)
        warning.add_theme_color_override("font_color", Color("#ffeed1"))
        missing_panel.add_child(warning)
