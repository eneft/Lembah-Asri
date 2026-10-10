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
    # Explicit scene texture dependency: guaranteed included in exported PCK.
    artwork = get_node("ConceptArtwork2D") as Sprite2D
    art_loaded = artwork != null and artwork.texture != null
    if not art_loaded:
        push_error("LEMBAH ASRI: approved concept texture is missing from scene export")
    else:
        artwork.scale = WORLD_SIZE / artwork.texture.get_size()
        print("ART LOADED: %s (%d x %d)" % [CONCEPT_FILE, artwork.texture.get_width(), artwork.texture.get_height()])
    player = PLAYER_SCENE.instantiate()
    player.position = Vector2(698, 560)
    add_child(player)
    _make_ui()

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
