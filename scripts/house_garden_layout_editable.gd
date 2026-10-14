extends Node2D
## Editable layout for Lembah Asri.
## Art, depth pivots, colliders, character and camera are serialized in
## scenes/house_garden_stage1.tscn, NOT spawned here. This permits drag/drop.
##
## Keeps the original run8 / idle player and runtime HUD/touch behaviour.

@onready var player: CharacterBody2D = $Player
@onready var gameplay_hud: Control = $GameplayHUDLayer/GameplayHUD
@onready var touch_controls: Control = $MobileControlsLayer/TouchControls
@onready var rain_weather: Node2D = $RainWeather
var previous_player_foot: Vector2 = Vector2.ZERO

func _ready() -> void:
    gameplay_hud.call("bind_player", player)
    touch_controls.connect("move_changed", Callable(self, "_on_mobile_move"))
    touch_controls.connect("run_changed", Callable(self, "_on_mobile_run"))
    _make_contact_shadow()
    previous_player_foot = player.global_position
    print("LEMBAH ASRI: editable stage1 scene loaded; original RUN8/IDLE, Y-sort, river, HUD and touch retained")

func _on_mobile_move(direction: Vector2) -> void:
    if is_instance_valid(player):
        player.set("mobile_direction", direction)

func _on_mobile_run(holding: bool) -> void:
    if is_instance_valid(player):
        player.set("mobile_run_held", holding)

func _make_contact_shadow() -> void:
    # Equivalent to the previous runtime shadow generation.
    # The sprite's image is only generated at runtime; it does not interfere
    # with the visual layout editor or with user-selected artwork.
    if player.has_node("FootContactShadow"):
        return
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

func _unhandled_key_input(event: InputEvent) -> void:
    # Desktop test of weather in the editable main scene; controls intact.
    if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_R:
        if has_node("RainWeather"):
            $RainWeather.call("toggle_rain")
            get_viewport().set_input_as_handled()

func _process(_delta: float) -> void:
    # Read the actual moved foot pivot; no additional physics or collision.
    var current_foot: Vector2 = player.global_position
    var moved: bool = current_foot.distance_to(previous_player_foot) > 0.75
    rain_weather.call("register_footstep", current_foot, moved)
    previous_player_foot = current_foot
