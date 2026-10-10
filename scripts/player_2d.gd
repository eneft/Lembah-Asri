extends CharacterBody2D
## Temporary stylized 2D player. Use approved transparent sprite via assets/art/player.png.
@export var walking_speed: float = 225.0
var sprite_texture: Texture2D
var walking: bool = false

func _ready() -> void:
    z_index = 8
    if ResourceLoader.exists("res://assets/art/player.png"):
        sprite_texture = load("res://assets/art/player.png") as Texture2D
    queue_redraw()

func _physics_process(_delta: float) -> void:
    var direction := Vector2.ZERO
    if Input.is_key_pressed(KEY_A) or Input.is_action_pressed("ui_left"):
        direction.x -= 1.0
    if Input.is_key_pressed(KEY_D) or Input.is_action_pressed("ui_right"):
        direction.x += 1.0
    if Input.is_key_pressed(KEY_W) or Input.is_action_pressed("ui_up"):
        direction.y -= 1.0
    if Input.is_key_pressed(KEY_S) or Input.is_action_pressed("ui_down"):
        direction.y += 1.0
    direction = direction.normalized()
    velocity = direction * walking_speed
    walking = direction.length_squared() > 0.01
    move_and_slide()
    global_position = global_position.clamp(Vector2(25, 200), Vector2(1620, 880))

func _draw() -> void:
    # Foot position is the node origin, feet sort naturally with other sprites.
    if sprite_texture != null:
        var w := 62.0
        var h := w * float(sprite_texture.get_height()) / float(sprite_texture.get_width())
        draw_texture_rect(sprite_texture, Rect2(-w * 0.5, -h + 2.0, w, h), false)
        return
    # 2D placeholder only; final approved character sprite will replace this.
    draw_circle(Vector2(0, -3), 15.0, Color(0.18, 0.22, 0.16, 0.22))
    draw_rect(Rect2(-15, -19, 12, 20), Color("#775b42"))
    draw_rect(Rect2(3, -19, 12, 20), Color("#775b42"))
    draw_rect(Rect2(-18, -48, 36, 32), Color("#5e7e4a"))
    draw_rect(Rect2(-7, -48, 14, 32), Color("#eedfc6"))
    draw_rect(Rect2(16, -44, 11, 23), Color("#8a6b46"))
    draw_circle(Vector2(0, -61), 20.0, Color("#e8b18b"))
    draw_circle(Vector2(-9, -77), 14.0, Color("#68432c"))
    draw_circle(Vector2(7, -80), 13.0, Color("#68432c"))
    draw_circle(Vector2(-8, -62), 2.5, Color("#3a3028"))
    draw_circle(Vector2(8, -62), 2.5, Color("#3a3028"))
