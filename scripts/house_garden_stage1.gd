extends Node2D
## Lembah Asri / Tahap 1. Empty abandoned homestead; 2D player only.
## No NPC, prototype HUD or 3D model preview in gameplay.
## Every texture is preloaded so the Godot Web exporter includes real binary assets.

const PLAYER_SCRIPT = preload("res://scripts/stage1_player.gd")
const GAMEPLAY_HUD_SCRIPT = preload("res://scripts/gameplay_hud.gd")
const BG_GRADE = preload("res://assets/materials/village_background_grade.tres")
const WATER_SURFACE_MATERIAL = preload("res://assets/materials/river_surface_motion.tres")
const MOBILE_CONTROLS_SCRIPT = preload("res://scripts/mobile_touch_controls.gd")
const GROUND = preload("res://assets/art/layers/background_base.png")
const HOUSE = preload("res://assets/art/layers/house.png")
const COOP = preload("res://assets/art/layers/coop.png")
const TOMATO = preload("res://assets/art/layers/garden_tomato.png")
const EGGPLANT = preload("res://assets/art/layers/garden_eggplant.png")
const GREENS = preload("res://assets/art/layers/garden_greens.png")
const FOLIAGE = preload("res://assets/art/layers/foliage_front.png")
const SIZE := Vector2(1672.0, 941.0)
# The approved base is now a complete house/yard/shed/bridge illustration.
# Keep legacy source art in repository for future true sprite-layer extraction.
const BACKGROUND_IS_COMPLETE_ILLUSTRATION := true

var player: CharacterBody2D
var layer_count := 0

func _ready() -> void:
    # Camera2D and root Y-sort. Future cutout structures use z=0 and feet-pivots.
    # The original complete image is still painted as one temporary base layer.
    y_sort_enabled = true
    var background := _sprite(self,"BackgroundBase",GROUND,Vector2.ZERO,-20)
    # Slightly subdue the very busy painting. A separate dynamic character and
    # HUD now provide the contrast and focus seen in the visual reference.
    background.material = BG_GRADE
    _make_river_surface()
    # Legacy overlays contain paintings of the former house/gardens. They would
    # double-print objects already present in the new full-screen illustration.
    # Keep nodes/resources for backwards compatibility, but hide them in this mode.
    _sprite(self,"HouseMain",HOUSE,Vector2(0,34),3).visible = not BACKGROUND_IS_COMPLETE_ILLUSTRATION
    _sprite(self,"SmallCoop",COOP,Vector2(665,273),4).visible = not BACKGROUND_IS_COMPLETE_ILLUSTRATION
    _sprite(self,"GardenTomato",TOMATO,Vector2(90,516),5).visible = not BACKGROUND_IS_COMPLETE_ILLUSTRATION
    _sprite(self,"GardenEggplant",EGGPLANT,Vector2(686,508),5).visible = not BACKGROUND_IS_COMPLETE_ILLUSTRATION
    _sprite(self,"GardenGreens",GREENS,Vector2(131,670),5).visible = not BACKGROUND_IS_COMPLETE_ILLUSTRATION
    _sprite(self,"ForegroundFoliage",FOLIAGE,Vector2(0,585),20).visible = not BACKGROUND_IS_COMPLETE_ILLUSTRATION
    _make_obstacles()
    _make_player()
    _make_hud()
    _make_mobile_controls()
    print("STAGE1 ART LOADED: %d layer sprites; empty homestead, 2D protagonist" % layer_count)

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

func _make_river_surface() -> void:
    # Interim moving water on the unmodified base art. Cropped to the river
    # quadrant and chroma-masked. A real hand-painted water mask comes later.
    var river := Sprite2D.new()
    river.name = "RiverWaterfallSurface"
    river.texture = GROUND
    river.region_enabled = true
    river.region_rect = Rect2(980.0, 350.0, 692.0, 591.0)
    river.centered = false
    river.position = Vector2(980.0, 350.0)
    river.z_index = -19
    river.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
    river.material = WATER_SURFACE_MATERIAL
    add_child(river)

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
    if not BACKGROUND_IS_COMPLETE_ILLUSTRATION:
        # Historical planted fields only: new background is an open, untended yard.
        _solid("TomatoFenceCollision",Vector2(377,683),Vector2(470,15))
        _solid("TomatoBedInteriorCollision",Vector2(377,594),Vector2(435,155))
        _solid("EggplantFenceCollision",Vector2(1006,733),Vector2(270,14))
    # River strip cannot be crossed except by a planned bridge transition.
    _solid("RiverBankCollision",Vector2(1490,693),Vector2(125,430))

func _make_player() -> void:
    player = CharacterBody2D.new()
    player.name = "Player"
    player.set_script(PLAYER_SCRIPT)
    player.collision_layer = 1
    player.collision_mask = 2
    player.position = Vector2(700,617)
    player.z_index = 0 # Participate in world Y-sorting instead of always-over z=10
    _make_contact_shadow()
    var actor := AnimatedSprite2D.new()
    actor.name = "AnimatedSprite2D"
    # Imported 512x778 runner; anchored at feet by stage1_player.gd.
    actor.position = Vector2(0, -70.798)
    actor.scale = Vector2(0.182, 0.182)
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

func _make_contact_shadow() -> void:
    # A soft ground-contact shadow is important with a single painted map:
    # the actor must read as standing ON the path, never pasted into it.
    # Generate a tiny radial texture only once; it is not part of the PNG art.
    var pixels := Image.create(128, 48, false, Image.FORMAT_RGBA8)
    for y in range(48):
        for x in range(128):
            var dx: float = (float(x) - 63.5) / 63.5
            var dy: float = (float(y) - 23.5) / 23.5
            var falloff: float = maxf(0.0, 1.0 - dx * dx - dy * dy)
            var alpha: float = 0.30 * falloff * falloff
            pixels.set_pixel(x, y, Color(0.075, 0.073, 0.055, alpha))
    var contact := Sprite2D.new()
    contact.name = "FootContactShadow"
    contact.texture = ImageTexture.create_from_image(pixels)
    contact.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
    contact.scale = Vector2(0.92, 0.67)
    contact.position = Vector2(0.0, -1.5)
    contact.z_index = -1
    player.add_child(contact)

func _make_hud() -> void:
    var overlay := CanvasLayer.new()
    overlay.name = "GameplayHUDLayer"
    overlay.layer = 15
    add_child(overlay)
    var hud := Control.new()
    hud.set_script(GAMEPLAY_HUD_SCRIPT)
    hud.name = "GameplayHUD"
    overlay.add_child(hud)
    hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    hud.bind_player(player)

func _make_mobile_controls() -> void:
    var touch_layer := CanvasLayer.new()
    touch_layer.name = "MobileControlsLayer"
    touch_layer.layer = 20
    add_child(touch_layer)
    var controls := Control.new()
    controls.name = "TouchControls"
    controls.set_script(MOBILE_CONTROLS_SCRIPT)
    touch_layer.add_child(controls)
    controls.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    controls.move_changed.connect(_on_mobile_move)
    controls.run_changed.connect(_on_mobile_run)
    # No interactive NPC/object in this empty homestead scene yet.
    # The touch joystick and run button stay active; unused AKSI stays hidden.
    print("STAGE1 TOUCH MOVEMENT READY")

func _on_mobile_move(direction: Vector2) -> void:
    if is_instance_valid(player):
        player.set("mobile_direction", direction)

func _on_mobile_run(holding: bool) -> void:
    if is_instance_valid(player):
        player.set("mobile_run_held", holding)
