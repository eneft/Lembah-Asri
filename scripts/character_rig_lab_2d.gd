extends Node2D
## Isolated Godot 4 cutout bone-rig EXPERIMENT. No changes to gameplay.
## Original character PNG is reused with clipped Polygon2D UVs.
## Hidden anatomy behind the original flattened limbs cannot be recovered.

const SOURCE = preload("res://assets/characters/player_base_8dir/57EA7797-A856-4ABC-BF67-7248363D7DE7.png")
const REF = Vector2(1024.0, 1536.0)
const LEG_KEYS = [-0.29, -0.13, 0.07, 0.29, 0.13, -0.07]
const KNEE_NEAR = [0.04, 0.11, 0.32, 0.03, 0.08, 0.26]
const KNEE_FAR = [0.03, 0.08, 0.26, 0.04, 0.11, 0.32]
const CYCLE_SECONDS = 0.90

var playing := true
var phase := 0.0
var _source_scale: Vector2
var _rig: Node2D
var _body: Bone2D
var _head: Bone2D
var _near_arm: Bone2D
var _far_arm: Bone2D
var _near_leg: Bone2D
var _far_leg: Bone2D
var _near_shin: Bone2D
var _far_shin: Bone2D
var _status: Label

func _ready() -> void:
    _source_scale = SOURCE.get_size() / REF
    _ui()
    _rig_setup()
    _pose(0.0)

func _ui() -> void:
    var title := Label.new()
    title.text = "LEMBAH ASRI — CHARACTER RIG LAB 2D"
    title.position = Vector2(45, 20)
    title.add_theme_font_size_override("font_size", 26)
    add_child(title)
    var instruction := Label.new()
    instruction.text = "SPACE: play/pause   1–6: hold frame   R: restart    |    LEFT: ORIGINAL     RIGHT: RIG"
    instruction.position = Vector2(45, 66)
    add_child(instruction)
    var original_title := Label.new()
    original_title.text = "ORIGINAL / STATIC"
    original_title.position = Vector2(160, 117)
    add_child(original_title)
    _status = Label.new()
    _status.position = Vector2(915, 117)
    add_child(_status)
    var original := Sprite2D.new()
    original.name = "OriginalReference"
    original.texture = SOURCE
    original.centered = false
    original.scale = Vector2(0.36, 0.36) / _source_scale
    original.position = Vector2(110, 665 - 1536 * 0.36)
    add_child(original)

func _xy(v: Vector2) -> Vector2:
    return v * _source_scale

func _bone(parent: Node2D, name: String, at: Vector2, parent_at: Vector2, length_px: float) -> Bone2D:
    var b := Bone2D.new()
    b.name = name
    b.position = _xy(at - parent_at)
    b.length = length_px * _source_scale.y
    # Bone2D.rest defaults to a ZERO transform, which Skeleton2D cannot invert.
    b.set_autocalculate_length_and_angle(false)
    b.rest = b.transform
    parent.add_child(b)
    return b

func _patch(parent: Bone2D, name: String, pts: PackedVector2Array, at: Vector2, depth: int) -> void:
    var polygon := PackedVector2Array()
    var uv := PackedVector2Array()
    for pt in pts:
        polygon.append(_xy(pt - at))
        uv.append(_xy(pt))
    var p := Polygon2D.new()
    p.name = name
    p.polygon = polygon
    p.uv = uv
    p.texture = SOURCE
    p.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
    p.z_index = depth
    parent.add_child(p)

func _rig_setup() -> void:
    _rig = Node2D.new()
    _rig.name = "WalkCycleRig"
    _rig.position = Vector2(800, 665)
    _rig.scale = Vector2.ONE * 0.36
    add_child(_rig)
    var skeleton := Skeleton2D.new()
    skeleton.name = "Skeleton2D"
    skeleton.position = -_xy(Vector2(512, 1536))
    _rig.add_child(skeleton)

    var hip := Vector2(488, 846)
    var spine := Vector2(470, 830)
    var neck := Vector2(488, 393)
    var near_hip := Vector2(516, 860)
    var far_hip := Vector2(412, 848)
    var near_knee := Vector2(530, 1166)
    var far_knee := Vector2(437, 1160)
    var near_shoulder := Vector2(553, 522)
    var far_shoulder := Vector2(392, 670)
    var pelvis := _bone(skeleton, "Pelvis", hip, Vector2.ZERO, 130)
    _body = _bone(pelvis, "Spine", spine, hip, 260)
    _head = _bone(_body, "Head", neck, spine, 110)
    _far_leg = _bone(pelvis, "BackUpperLeg", far_hip, hip, 300)
    _far_shin = _bone(_far_leg, "BackLowerLeg", far_knee, far_hip, 330)
    _near_leg = _bone(pelvis, "FrontUpperLeg", near_hip, hip, 300)
    _near_shin = _bone(_near_leg, "FrontLowerLeg", near_knee, near_hip, 330)
    _far_arm = _bone(_body, "BackArm", far_shoulder, spine, 260)
    _near_arm = _bone(_body, "FrontArm", near_shoulder, spine, 365)

    _patch(_far_leg, "BackThigh", PackedVector2Array([
        Vector2(367,824), Vector2(481,821), Vector2(500,947), Vector2(500,1093),
        Vector2(508,1199), Vector2(420,1241), Vector2(385,1110), Vector2(365,965)
    ]), far_hip, -8)
    _patch(_far_shin, "BackShinBoot", PackedVector2Array([
        Vector2(391,1126), Vector2(510,1137), Vector2(530,1295), Vector2(548,1411),
        Vector2(510,1505), Vector2(325,1496), Vector2(286,1426), Vector2(336,1376),
        Vector2(417,1288)
    ]), far_knee, -7)
    _patch(_near_leg, "FrontThigh", PackedVector2Array([
        Vector2(433,824), Vector2(612,826), Vector2(642,1042), Vector2(657,1190),
        Vector2(557,1250), Vector2(448,1205), Vector2(435,1023)
    ]), near_hip, -2)
    _patch(_near_shin, "FrontShinBoot", PackedVector2Array([
        Vector2(444,1129), Vector2(656,1140), Vector2(667,1295), Vector2(667,1467),
        Vector2(640,1517), Vector2(350,1517), Vector2(340,1432), Vector2(416,1331)
    ]), near_knee, -1)
    _patch(_body, "Backpack", PackedVector2Array([
        Vector2(568,392), Vector2(671,401), Vector2(751,458), Vector2(782,589),
        Vector2(778,771), Vector2(717,836), Vector2(586,830), Vector2(567,632)
    ]), spine, -6)
    _patch(_far_arm, "BackHand", PackedVector2Array([
        Vector2(374,738), Vector2(409,748), Vector2(411,831), Vector2(402,936),
        Vector2(388,967), Vector2(364,953), Vector2(367,850)
    ]), far_shoulder, -5)
    _patch(_body, "HipsWaist", PackedVector2Array([
        Vector2(357,738), Vector2(615,731), Vector2(621,933), Vector2(571,968),
        Vector2(435,962), Vector2(362,930)
    ]), spine, -4)
    _patch(_body, "JacketChest", PackedVector2Array([
        Vector2(354,370), Vector2(574,363), Vector2(614,460), Vector2(575,533),
        Vector2(526,629), Vector2(507,775), Vector2(511,846), Vector2(357,842),
        Vector2(344,800), Vector2(379,573)
    ]), spine, -3)
    _patch(_near_arm, "SleeveHand", PackedVector2Array([
        Vector2(520,461), Vector2(609,478), Vector2(648,601), Vector2(655,674),
        Vector2(611,726), Vector2(603,829), Vector2(597,907), Vector2(578,954),
        Vector2(488,954), Vector2(478,914), Vector2(500,819), Vector2(500,725),
        Vector2(492,652), Vector2(499,561)
    ]), near_shoulder, 1)
    _patch(_head, "FaceHair", PackedVector2Array([
        Vector2(288,1), Vector2(550,0), Vector2(679,70), Vector2(736,151),
        Vector2(727,249), Vector2(669,352), Vector2(556,392), Vector2(535,421),
        Vector2(450,428), Vector2(382,387), Vector2(338,355), Vector2(319,292),
        Vector2(286,223)
    ]), neck, 3)

func _pose(frame_t: float) -> void:
    # Contact, down, passing, opposite contact, down, passing.
    var t := fposmod(frame_t, 6.0)
    var i := int(floor(t))
    var j := (i + 1) % 6
    var weight := smoothstep(0.0, 1.0, t - float(i))
    var swing := lerpf(LEG_KEYS[i], LEG_KEYS[j], weight)
    _near_leg.rotation = swing
    _far_leg.rotation = -swing
    _near_shin.rotation = lerpf(KNEE_NEAR[i], KNEE_NEAR[j], weight)
    _far_shin.rotation = lerpf(KNEE_FAR[i], KNEE_FAR[j], weight)
    _near_arm.rotation = -swing * 0.8
    _far_arm.rotation = swing * 0.8
    _body.rotation = 0.014 * sin(t * TAU / 3.0)
    _head.rotation = -_body.rotation * 0.8
    _rig.position.y = 665 + 2.8 * cos(t * TAU / 3.0)
    _status.text = "FRAME %d / 6  —  %s" % [i + 1, "PLAY" if playing else "PAUSE"]

func _process(delta: float) -> void:
    if playing:
        phase = fposmod(phase + delta * 6.0 / CYCLE_SECONDS, 6.0)
        _pose(phase)

func _unhandled_key_input(event: InputEvent) -> void:
    if not (event is InputEventKey) or not event.pressed or event.echo:
        return
    if event.keycode == KEY_SPACE:
        playing = not playing
    elif event.keycode == KEY_R:
        playing = true
        phase = 0.0
    elif event.keycode >= KEY_1 and event.keycode <= KEY_6:
        playing = false
        phase = float(event.keycode - KEY_1)
    else:
        return
    _pose(phase)

func _draw() -> void:
    draw_rect(Rect2(Vector2.ZERO, Vector2(1280, 720)), Color("#eee7da"), true)
    draw_rect(Rect2(46, 139, 540, 541), Color("#fbf9f5"), true)
    draw_rect(Rect2(610, 139, 626, 541), Color("#fbf9f5"), true)
    draw_line(Vector2(80, 666), Vector2(551, 666), Color("#c2b7a7"), 2.0)
    draw_line(Vector2(649, 666), Vector2(1195, 666), Color("#c2b7a7"), 2.0)
