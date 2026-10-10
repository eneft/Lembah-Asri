extends Node2D
## Lembah Asri / Tahap 1. Native Godot 2D scene with nine separate PNGs.
## Every texture is preloaded so the Godot Web exporter includes real binary assets.

const PLAYER_SCRIPT = preload("res://scripts/stage1_player.gd")
const GROUND = preload("res://assets/art/layers/background_base.png")
const HOUSE = preload("res://assets/art/layers/house.png")
const COOP = preload("res://assets/art/layers/coop.png")
const TOMATO = preload("res://assets/art/layers/garden_tomato.png")
const EGGPLANT = preload("res://assets/art/layers/garden_eggplant.png")
const GREENS = preload("res://assets/art/layers/garden_greens.png")
const FOLIAGE = preload("res://assets/art/layers/foliage_front.png")
const HERO = preload("res://assets/art/layers/player_idle.png")
const BU_SARI = preload("res://assets/art/layers/npc_bu_sari.png")
const SIZE := Vector2(1672.0, 941.0)

var player: CharacterBody2D
var npc: StaticBody2D
var hint_label: Label
var dialogue_panel: ColorRect
var dialogue_label: Label
var interaction_timer := 0.0
var layer_count := 0

func _ready() -> void:
    _sprite(self,"BackgroundBase",GROUND,Vector2.ZERO,-20)
    _sprite(self,"HouseMain",HOUSE,Vector2(0,34),3)
    _sprite(self,"SmallCoop",COOP,Vector2(665,273),4)
    _sprite(self,"GardenTomato",TOMATO,Vector2(90,516),5)
    _sprite(self,"GardenEggplant",EGGPLANT,Vector2(686,508),5)
    _sprite(self,"GardenGreens",GREENS,Vector2(131,670),5)
    _sprite(self,"ForegroundFoliage",FOLIAGE,Vector2(0,585),20)
    _make_obstacles()
    _make_bu_sari()
    _make_player()
    _make_ui()
    print("STAGE1 ART LOADED: %d layer sprites, player and Bu Sari separated" % layer_count)

func _sprite(parent: Node, name: String, tex: Texture2D, at: Vector2, depth: int) -> Sprite2D:
    var result := Sprite2D.new()
    result.name = name
    result.texture = tex
    result.centered = false
    result.position = at
    result.z_index = depth
    result.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
    parent.add_child(result)
    layer_count += 1
    return result

func _solid(name: String, at: Vector2, size: Vector2) -> void:
    var body := StaticBody2D.new()
    body.name = name
    body.collision_layer = 2
    body.collision_mask = 0
    body.position = at
    var collision := CollisionShape2D.new()
    var shape := RectangleShape2D.new()
    shape.size = size
    collision.shape = shape
    body.add_child(collision)
    add_child(body)

func _make_obstacles() -> void:
    # Practical walk boundaries around walls, not the visual roof:
    _solid("HouseWallsCollision",Vector2(335,290),Vector2(372,166))
    _solid("CoopCollision",Vector2(869,385),Vector2(183,97))
    # The garden fences are solid; harvestable plants themselves are not.
    _solid("TomatoFenceCollision",Vector2(377,683),Vector2(470,15))
    _solid("EggplantFenceCollision",Vector2(1006,733),Vector2(270,14))
    # River strip cannot be crossed except by a planned bridge transition.
    _solid("RiverBankCollision",Vector2(1490,693),Vector2(125,430))

func _make_bu_sari() -> void:
    npc = StaticBody2D.new()
    npc.name = "BuSari"
    npc.position = Vector2(802,596)
    npc.collision_layer = 2
    npc.collision_mask = 0
    var sprite := _sprite(npc,"NPCArt",BU_SARI,Vector2(-47,-149),8)
    sprite.z_index = 0
    var collision := CollisionShape2D.new()
    var shape := CircleShape2D.new()
    shape.radius = 12.0
    collision.shape = shape
    collision.position = Vector2(0,-7)
    npc.add_child(collision)
    add_child(npc)

func _make_player() -> void:
    player = CharacterBody2D.new()
    player.name = "Player"
    player.set_script(PLAYER_SCRIPT)
    player.collision_layer = 1
    player.collision_mask = 2
    player.position = Vector2(700,617)
    player.z_index = 10
    var sprite := _sprite(player,"Avatar",HERO,Vector2(-45,-176),0)
    sprite.z_index = 0
    var actor := AnimatedSprite2D.new()
    actor.name = "AnimatedSprite2D"
    actor.position = Vector2(0, -80)
    actor.scale = Vector2(1.95, 1.95)
    actor.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
    player.add_child(actor)
    var collision := CollisionShape2D.new()
    var shape := CircleShape2D.new()
    shape.radius = 11.0
    collision.shape = shape
    collision.position = Vector2.ZERO
    player.add_child(collision)
    var camera := Camera2D.new()
    camera.name = "Camera2D"
    camera.enabled = true
    camera.zoom = Vector2(0.80,0.80)
    camera.position = Vector2(0,-33)
    camera.position_smoothing_enabled = true
    camera.position_smoothing_speed = 4.0
    camera.limit_left = 0
    camera.limit_top = 0
    camera.limit_right = 1672
    camera.limit_bottom = 941
    player.add_child(camera)
    add_child(player)

func _panel(parent: Node, color: Color, at: Vector2, size: Vector2) -> ColorRect:
    var panel := ColorRect.new()
    panel.position = at
    panel.size = size
    panel.color = color
    parent.add_child(panel)
    return panel

func _label(parent: Node, caption: String, at: Vector2, font_size: int, color: Color = Color.WHITE) -> Label:
    var label := Label.new()
    label.position = at
    label.text = caption
    label.add_theme_font_size_override("font_size",font_size)
    label.add_theme_color_override("font_color",color)
    parent.add_child(label)
    return label

func _make_ui() -> void:
    var hud := CanvasLayer.new()
    hud.name = "HUD"
    add_child(hud)
    # Artwork already has the approved in-image HUD; don't obscure it
    # with large prototype dark boxes. Native dynamic UI will replace it
    # only when the HUD is extracted as real transparent assets.
    _panel(hud,Color(0.10,0.18,0.13,0.70),Vector2(809,660),Vector2(445,43))
    hint_label = _label(hud,"WASD / Panah: jalan  |  E: interaksi",Vector2(820,665),16,Color("#fff6e3"))
    dialogue_panel = _panel(hud,Color(0.13,0.20,0.16,0.95),Vector2(273,548),Vector2(740,86))
    dialogue_label = _label(dialogue_panel,"",Vector2(23,16),20,Color("#fff5e4"))
    dialogue_label.size = Vector2(680,62)
    dialogue_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    dialogue_panel.visible = false

func _process(delta: float) -> void:
    if interaction_timer > 0.0:
        interaction_timer -= delta
        dialogue_panel.visible = true
    else:
        dialogue_panel.visible = false
    if is_instance_valid(player) and is_instance_valid(npc) and player.position.distance_to(npc.position) <= 112.0:
        hint_label.text = "[E] Bicara dengan Bu Sari"
    elif is_instance_valid(player) and player.position.distance_to(Vector2(475,690)) < 110.0:
        hint_label.text = "[E] Lihat kebun tomat"
    else:
        hint_label.text = "WASD / Panah: jalan  |  E: interaksi"

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_E:
        if player.position.distance_to(npc.position) <= 112.0:
            dialogue_label.text = "Bu Sari: Selamat pulang, Nak! Rumah ini sudah lama menunggumu."
            interaction_timer = 5.0
            dialogue_panel.visible = true
        elif player.position.distance_to(Vector2(475,690)) < 110.0:
            dialogue_label.text = "Kebun tomat. Nanti kamu bisa mencangkul, menanam, menyiram, lalu panen."
            interaction_timer = 4.0
            dialogue_panel.visible = true
