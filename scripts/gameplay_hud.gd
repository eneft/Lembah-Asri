extends Control
## Actual Godot HUD; never baked into the painted village background.
## The minimap marker, day clock, inventory and menu are runtime controls.
const FACE = preload("res://assets/characters/player_base_8dir/down.png")
const SKY := Color(0.97, 0.94, 0.80, 0.98)
const DARK := Color(0.16, 0.21, 0.16, 0.95)
const OLIVE := Color(0.20, 0.37, 0.26, 0.97)
const GOLD := Color(0.98, 0.73, 0.28, 1.0)
const KEYS := ["Kapak", "Siram", "Bibit", "Cangkul", "Pancing", "Tas", "Peta", "Menu"]
var player: CharacterBody2D
var elapsed_minutes: float = 0.0
var selected_slot: int = 0
var open_panel: String = ""
var coin_count: int = 0
var _hint: String = "Rumah masa kecil - halaman belum dirawat"
var _hint_age: float = 0.0

func _ready() -> void:
    name = "GameplayHUD"
    set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    resized.connect(queue_redraw)
    queue_redraw()

func bind_player(actor: CharacterBody2D) -> void:
    player = actor

func _process(delta: float) -> void:
    if open_panel != "Menu":
        elapsed_minutes += delta * 0.5
    if _hint_age > 0.0:
        _hint_age = maxf(0.0, _hint_age - delta)
    queue_redraw()

func _scale_ui() -> float:
    return clampf(minf(size.x / 1280.0, size.y / 720.0), 0.62, 1.13)

func _font() -> Font:
    return ThemeDB.fallback_font

func _label(at: Vector2, t: String, points: int, color: Color = DARK) -> void:
    draw_string(_font(), at, t, HORIZONTAL_ALIGNMENT_LEFT, -1, points, color)

func _chip(rect: Rect2, bg: Color, edge: Color = Color(0.18,0.27,0.19,0.80)) -> void:
    draw_rect(rect, bg, true)
    draw_rect(rect, edge, false, 2.0)

func _layout() -> Dictionary:
    var s: float = _scale_ui()
    var slot_size: float = 52.0 * s
    var spacing: float = 6.0 * s
    var bar_width: float = 8.0 * slot_size + 7.0 * spacing
    var bar_left: float = (size.x - bar_width) * 0.5
    var bar_top: float = size.y - 66.0 * s
    return {"s":s,"slot":slot_size,"gap":spacing,"left":bar_left,"top":bar_top,
        "minimap":Vector2(size.x - 84.0*s, 85.0*s),
        "clock":Rect2(size.x - 360.0*s, 18.0*s, 175.0*s, 93.0*s)}

func _draw() -> void:
    if size.x < 100.0 or size.y < 100.0:
        return
    var ui: Dictionary = _layout()
    var s: float = ui["s"]
    var clock: Rect2 = ui["clock"]
    # Left identity block: sourced from approved 2D character, not a painted HUD.
    var portrait: Vector2 = Vector2(52*s, 54*s)
    draw_circle(portrait, 46*s, SKY)
    draw_texture_rect_region(FACE, Rect2(18*s, 17*s, 68*s, 74*s), Rect2(330, 65, 500, 610))
    draw_arc(portrait, 47*s, 0.0, TAU, 60, Color(0.20,0.27,0.19), 3.0*s, true)
    _chip(Rect2(106*s, 25*s, 168*s, 24*s), DARK, SKY)
    draw_rect(Rect2(111*s, 30*s, 155*s, 14*s), Color(0.18,0.24,0.17))
    draw_rect(Rect2(111*s, 30*s, 125*s, 14*s), Color(0.20,0.76,0.40))
    _label(Vector2(114*s, 76*s), "HARI 1", maxi(13,int(16*s)), SKY)
    for n in range(4):
        var origin := Vector2((125.0+31.0*float(n))*s, 100*s)
        draw_circle(origin, 11*s, Color(0.36, 0.14, 0.14))
        draw_circle(origin, 8*s, Color(0.94,0.31,0.34) if n < 3 else SKY)
    # Top-right: clock runs in-game and coins report actual inventory state.
    _chip(clock, SKY)
    var mins: int = (7*60 + 20 + int(elapsed_minutes)) % 1440
    var day: int = 1 + int(elapsed_minutes / 1440.0)
    _label(clock.position + Vector2(12*s,25*s), "Hari %d  /  Cerah" % day, maxi(12,int(15*s)))
    _label(clock.position + Vector2(12*s,58*s), "%02d:%02d" % [int(mins / 60), mins%60], maxi(22,int(27*s)))
    _label(clock.position + Vector2(12*s,83*s), "Koin: %d" % coin_count, maxi(12,int(14*s)), OLIVE)
    # Real minimap marker updates as the hero walks inside the Godot scene.
    var center: Vector2 = ui["minimap"]
    draw_circle(center, 67*s, DARK)
    draw_circle(center, 63*s, Color(0.38,0.63,0.40))
    for n in range(4):
        var yy: float = (float(n)-1.5)*22*s
        draw_line(center + Vector2(-47*s,yy-6*s),center + Vector2(45*s,yy+8*s),Color(0.79,0.68,0.37),4*s,true)
    draw_line(center+Vector2(23*s,-42*s),center+Vector2(-21*s,52*s),Color(0.26,0.51,0.73),10*s,true)
    if is_instance_valid(player):
        var p: Vector2 = player.global_position
        var px: float = clampf((p.x-200.0)/940.0,0.0,1.0)
        var py: float = clampf((p.y-450.0)/250.0,0.0,1.0)
        var marker := center+Vector2((px-0.5)*92*s,(py-0.5)*88*s)
        draw_circle(marker, 7*s, Color.WHITE)
        draw_circle(marker, 4*s, Color(0.14,0.38,0.94))
    draw_arc(center,67*s,0.0,TAU,64,SKY,3*s,true)
    _label(center+Vector2(-6*s,-75*s), "N", maxi(12,int(14*s)), SKY)
    # Keyboard/touch friendly hotbar, no invented stock quantities or powers.
    for idx in range(8):
        var xx: float = float(ui["left"]) + float(idx)*(float(ui["slot"])+float(ui["gap"]))
        var rect := Rect2(xx,float(ui["top"]),float(ui["slot"]),float(ui["slot"]))
        _chip(rect,Color(1,0.93,0.76,0.98) if idx == selected_slot else Color(0.94,0.91,0.80,0.91), GOLD if idx == selected_slot else OLIVE)
        _label(rect.position+Vector2(5*s,14*s), str(idx+1), maxi(11,int(13*s)))
        _label(rect.position+Vector2(5*s,35*s), KEYS[idx].substr(0,6), maxi(9,int(11*s)),DARK)
    if _hint_age > 0.0:
        var hint_rect := Rect2(size.x*0.30, size.y-107*s, size.x*0.4, 30*s)
        _chip(hint_rect,Color(0.10,0.17,0.12,0.90), SKY)
        _label(hint_rect.position+Vector2(9*s,20*s),_hint,maxi(11,int(13*s)),SKY)
    if open_panel != "":
        _draw_modal(s)

func _draw_modal(s: float) -> void:
    draw_rect(Rect2(Vector2.ZERO, size), Color(0.07,0.12,0.09,0.55), true)
    var rect := Rect2((size.x-420*s)*0.5,(size.y-290*s)*0.5,420*s,290*s)
    _chip(rect, SKY, DARK)
    _label(rect.position+Vector2(22*s,39*s), open_panel, maxi(23,int(27*s)))
    if open_panel == "Inventori":
        _label(rect.position+Vector2(22*s,80*s),"Tas masih kosong.",maxi(15,int(18*s)))
        _label(rect.position+Vector2(22*s,116*s),"Alat dan kebun akan aktif pada tahap berikutnya.",maxi(12,int(14*s)))
    elif open_panel == "Peta":
        _label(rect.position+Vector2(22*s,80*s),"Halaman rumah masa kecil",maxi(15,int(18*s)))
        _label(rect.position+Vector2(22*s,116*s),"Titik biru pada minimap mengikuti posisi pemain.",maxi(12,int(14*s)))
    else:
        _label(rect.position+Vector2(22*s,85*s),"Lembah Asri",maxi(19,int(21*s)))
        _label(rect.position+Vector2(22*s,120*s),"WASD / Panah: bergerak    Shift: lari",maxi(12,int(14*s)))
        _label(rect.position+Vector2(22*s,148*s),"I: Inventori     M: Peta     Esc: tutup",maxi(12,int(14*s)))
    _label(rect.position+Vector2(22*s,266*s),"Klik / ketuk untuk tutup",maxi(12,int(14*s)),OLIVE)

func _flash(t: String) -> void:
    _hint = t
    _hint_age = 2.8
    queue_redraw()

func _toggle_modal(name: String) -> void:
    open_panel = "" if open_panel == name else name
    if is_instance_valid(player):
        player.set_physics_process(open_panel == "")
    queue_redraw()

func _activate(slot: int) -> void:
    selected_slot = slot
    if slot == 5:
        _toggle_modal("Inventori")
    elif slot == 6:
        _toggle_modal("Peta")
    elif slot == 7:
        _toggle_modal("Menu")
    else:
        _flash(KEYS[slot] + " - belum tersedia pada prototipe")
    queue_redraw()

func _input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo:
        var k: int = event.keycode
        if k == KEY_ESCAPE:
            if open_panel == "":
                _toggle_modal("Menu")
            else:
                _toggle_modal(open_panel)
        elif k == KEY_I:
            _toggle_modal("Inventori")
        elif k == KEY_M:
            _toggle_modal("Peta")
        elif k >= KEY_1 and k <= KEY_8:
            _activate(k - KEY_1)
        else:
            return
        get_viewport().set_input_as_handled()
    elif (event is InputEventScreenTouch and event.pressed) or (event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed):
        var point: Vector2 = event.position
        if open_panel != "":
            _toggle_modal(open_panel)
            get_viewport().set_input_as_handled()
            return
        var ui: Dictionary = _layout()
        for idx in range(8):
            var xx: float = float(ui["left"]) + float(idx) * (float(ui["slot"])+float(ui["gap"]))
            var rr := Rect2(xx,float(ui["top"]),float(ui["slot"]),float(ui["slot"]))
            if rr.has_point(point):
                _activate(idx)
                get_viewport().set_input_as_handled()
                return
        var center: Vector2 = ui["minimap"]
        if center.distance_to(point) <= 67.0*float(ui["s"]):
            _toggle_modal("Peta")
            get_viewport().set_input_as_handled()