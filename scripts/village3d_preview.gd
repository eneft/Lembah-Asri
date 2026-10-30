extends "res://scripts/main.gd"
## Non-breaking 3D village preview. Does not replace the illustrated 2D main scene.
## All geometry is explicitly temporary; replace each named region with imported 3D assets later.

const LAND_COLOR := Color("83ab68")
const SOIL_COLOR := Color("b99466")
const TILE_COLOR := Color("aa6448")
const WOOD_COLOR := Color("876342")

func _ready() -> void:
    super._ready()
    camera.projection = Camera3D.PROJECTION_ORTHOGONAL
    camera.size = 30.0
    camera.far = 400.0
    player.global_position = Vector3(3.0, 0.2, 13.0)

func _unhandled_input(event: InputEvent) -> void:
    super._unhandled_input(event)
    if event is InputEventMouseButton and event.pressed:
        if event.button_index == MOUSE_BUTTON_WHEEL_UP:
            camera.size = maxf(14.0, camera.size - 2.0)
        elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
            camera.size = minf(52.0, camera.size + 2.0)

func _region(label: String) -> Node3D:
    var region := Node3D.new()
    region.name = label
    add_child(region)
    return region

func _make_floor() -> void:
    var body := StaticBody3D.new()
    body.name = "GroundCollision"
    body.position.y = -0.55
    add_child(body)
    _box(Vector3(128.0, 1.1, 128.0), Vector3.ZERO, LAND_COLOR, body)
    var shape := BoxShape3D.new()
    shape.size = Vector3(128.0, 1.1, 128.0)
    var collision := CollisionShape3D.new()
    collision.shape = shape
    body.add_child(collision)

func _make_village() -> void:
    var home := _region("RumahMasaKecil")
    var garden := _region("KebunKeluarga")
    var village := _region("PermukimanDesa")
    var plaza := _region("LapanganWarga")
    var forest := _region("HutanBambu")
    var hills := _region("Bukit")
    var river := _region("Sungai")
    var shore := _region("Pantai")
    var harbor := _region("PelabuhanNelayan")

    # The family home sits away from the village with space for cultivation.
    _box(Vector3(36.0, 0.12, 34.0), Vector3(-43.0, 0.06, -28.0), Color("759b59"), home)
    _kampung_house(home, Vector3(-46.0, 0.14, -37.0), true)
    _garden(garden)
    _path(Vector3(-37.0, 0.11, -25.0), Vector3(10.0, 0.1, 3.0))
    _path(Vector3(-28.0, 0.11, -24.0), Vector3(22.0, 0.1, 3.0))

    # Small East Javanese houses, simple clay-tile gables, not pagoda roofs.
    var homes := [
        Vector3(-5, 0.0, -19), Vector3(7, 0.0, -19),
        Vector3(19, 0.0, -17), Vector3(-7, 0.0, 26),
        Vector3(19, 0.0, 25), Vector3(24, 0.0, 2)
    ]
    for at in homes:
        _kampung_house(village, at, false)
    _path(Vector3(7, 0.10, -3), Vector3(3.0, 0.1, 56.0))
    _path(Vector3(8, 0.11, 19), Vector3(39.0, 0.1, 2.6))
    _path(Vector3(-6, 0.11, -24), Vector3(24.0, 0.1, 2.6))

    # Plain village commons: benches and shade, no soccer goals or pitch lines.
    _box(Vector3(24.0, 0.12, 15.0), Vector3(4.0, 0.13, 10.0), SOIL_COLOR, plaza)
    _tree(plaza, Vector3(-4.0, 0.2, 7.0), 1.5)
    for at in [Vector3(-1.0, 0.24, 14), Vector3(12, 0.24, 14), Vector3(11, 0.24, 5)]:
        _box(Vector3(2.6, 0.17, 0.72), at + Vector3(0, 0.35, 0), WOOD_COLOR, plaza)
        for dx in [-0.95, 0.95]:
            _box(Vector3(0.18, 0.6, 0.18), at + Vector3(dx, 0.03, 0), WOOD_COLOR, plaza)
    for idx in range(3):
        _make_npc(Vector3(2.0 + float(idx) * 3.0, 0.15, 10.5 + float(idx)), idx)

    # The river divides the isolated homestead from the village; cross at bridges.
    _box(Vector3(5.8, 0.07, 108.0), Vector3(-21.0, 0.06, 0.0), Color("459fbb"), river)
    for crossing in [-24.0, 17.0]:
        _bridge(river, Vector3(-21.0, 0.22, crossing))
    for segment in [[-54.0, -28.0], [-20.0, 13.0], [21.0, 54.0]]:
        var middle: float = (segment[0] + segment[1]) * 0.5
        _water_barrier(Vector3(-21.0, 0.55, middle), Vector3(5.3, 1.1, segment[1] - segment[0]))
    _path(Vector3(-13, 0.11, -24), Vector3(19.0, 0.1, 2.8))
    _path(Vector3(-13, 0.11, 17), Vector3(19.0, 0.1, 2.8))

    # Forest, banana and coconut silhouettes are placeholders for hand-painted assets.
    for x in [-53.0, -44.0, -35.0, -28.0]:
        for z in [20.0, 30.0, 40.0, 49.0]:
            _tree(forest, Vector3(x + float(int(z) % 3), 0.0, z), 1.1 if x == -53.0 else 0.85)
    for at in [Vector3(-53,0,-48),Vector3(-30,0,-45),Vector3(26,0,38),Vector3(36,0,-4)]:
        _palm(forest, at)

    # Hills are sculptural skyline blocks, not yet walkable mountain terrain.
    for i in range(4):
        _box(Vector3(30.0 - i * 4.0, 2.0, 25.0 - i * 3.0),
            Vector3(34.0, 1.0 + i * 1.9, -43.0), Color("6c965e").lightened(i * 0.06), hills)

    # Beach and working fishing harbor on the east edge.
    _box(Vector3(15.0, 0.12, 88.0), Vector3(40.0, 0.11, 5.0), Color("dbc18a"), shore)
    _box(Vector3(16.0, 0.10, 110.0), Vector3(55.0, 0.08, 0.0), Color("4198b8"), shore)
    _water_barrier(Vector3(54.0, 0.6, 0.0), Vector3(14.0, 1.2, 110.0))
    _path(Vector3(30.0, 0.11, 18.0), Vector3(20.0, 0.1, 2.5))
    _box(Vector3(12.0, 0.24, 2.8), Vector3(48, 0.27, 18), WOOD_COLOR, harbor)
    for z in [8.0, 19.0, 29.0]:
        _boat(harbor, Vector3(54.0, 0.27, z))
    for at in [Vector3(35,0,29),Vector3(30,0,-9),Vector3(45,0,-30)]:
        _palm(shore, at)

func _path(at: Vector3, size: Vector3) -> void:
    _box(size, at, Color("c5aa7d"))

func _kampung_house(parent: Node3D, at: Vector3, abandoned: bool) -> void:
    var house := Node3D.new()
    house.name = "RumahTerbengkalai" if abandoned else "RumahKampung"
    house.position = at
    parent.add_child(house)
    _box(Vector3(6.3, 2.8, 5.4), Vector3(0, 1.4, 0), Color("d6c9a8") if abandoned else Color("edddbe"), house)
    # One plain gabled clay tile roof: no stacked tiers or fantasy ornaments.
    var left := _box(Vector3(4.1, 0.27, 7.0), Vector3(-1.55, 3.36, 0), TILE_COLOR, house)
    var right := _box(Vector3(4.1, 0.27, 7.0), Vector3(1.55, 3.36, 0), TILE_COLOR, house)
    left.rotation.z = -0.35
    right.rotation.z = 0.35
    _box(Vector3(7.2, 0.21, 2.0), Vector3(0, 0.12, 3.15), WOOD_COLOR, house)
    for x in [-2.85, 2.85]:
        _box(Vector3(0.22, 2.5, 0.22), Vector3(x, 1.25, 3.8), WOOD_COLOR, house)
    _box(Vector3(1.5, 2.2, 0.12), Vector3(0, 1.12, 2.75), WOOD_COLOR, house)
    for x in [-2.0, 2.0]:
        _box(Vector3(1.1, 1.3, 0.13), Vector3(x, 1.6, 2.76), Color("8d7355"), house)
        _box(Vector3(0.07, 1.3, 0.16), Vector3(x, 1.6, 2.86), Color("5d4a36"), house)
    if abandoned:
        for dx in [-2.2, 0.3, 2.2]:
            _sphere(0.36, Vector3(dx, 3.7, 0.7), Color("679247"), house)
            _sphere(0.42, Vector3(dx, 0.32, 3.9), Color("527844"), house)
    var body := StaticBody3D.new()
    body.name = "HouseCollision"
    body.position.y = 1.4
    house.add_child(body)
    var shape := BoxShape3D.new()
    shape.size = Vector3(6.3, 2.8, 5.4)
    var collision := CollisionShape3D.new()
    collision.shape = shape
    body.add_child(collision)

func _garden(parent: Node3D) -> void:
    _box(Vector3(25.0, 0.10, 13.0), Vector3(-41.0, 0.14, -13.0), Color("9bb873"), parent)
    for row in range(4):
        for col in range(6):
            var x := -51.0 + float(col) * 3.5
            var z := -17.0 + float(row) * 2.5
            _box(Vector3(2.6, 0.12, 1.3), Vector3(x, 0.23, z), Color("704e36"), parent)
            for n in range(3):
                _sphere(0.23, Vector3(x - 0.7 + n * 0.7, 0.48, z), Color("50854a"), parent)

func _tree(parent: Node3D, at: Vector3, scale_factor: float = 1.0) -> void:
    var tree := Node3D.new()
    tree.position = at
    tree.scale = Vector3.ONE * scale_factor
    parent.add_child(tree)
    _box(Vector3(0.6, 3.8, 0.6), Vector3(0, 1.9, 0), Color("896341"), tree)
    for p in [Vector3(-0.8,4.0,0),Vector3(0.9,4.2,0.5),Vector3(0,4.8,-0.5)]:
        _sphere(1.7, p, Color("4f8b4b"), tree)

func _palm(parent: Node3D, at: Vector3) -> void:
    var palm := Node3D.new()
    palm.position = at
    parent.add_child(palm)
    _box(Vector3(0.5, 5.3, 0.5), Vector3(0, 2.65, 0), Color("947149"), palm)
    for offset in [Vector3(-1.2,5.2,0),Vector3(1.2,5.2,0),Vector3(0,5.2,-1.2),Vector3(0,5.2,1.2)]:
        var leaf := _sphere(1.1, offset, Color("5b9d53"), palm)
        leaf.scale = Vector3(1.5, 0.25, 0.65) if absf(offset.x) > 0.0 else Vector3(0.65, 0.25, 1.5)

func _bridge(parent: Node3D, at: Vector3) -> void:
    _box(Vector3(9.0, 0.26, 4.5), at, WOOD_COLOR, parent)
    for x in [-4.1, 4.1]:
        for z in [-1.8, 1.8]:
            _box(Vector3(0.25, 1.1, 0.25), at + Vector3(x, 0.5, z), Color("785737"), parent)

func _water_barrier(at: Vector3, size: Vector3) -> void:
    var body := StaticBody3D.new()
    body.name = "WaterSafetyBarrier"
    body.position = at
    add_child(body)
    var shape := BoxShape3D.new()
    shape.size = size
    var collision := CollisionShape3D.new()
    collision.shape = shape
    body.add_child(collision)

func _boat(parent: Node3D, at: Vector3) -> void:
    var boat := Node3D.new()
    boat.name = "PerahuNelayan"
    boat.position = at
    parent.add_child(boat)
    _box(Vector3(2.2, 0.55, 5.2), Vector3(0, 0.17, 0), Color("8d543c"), boat)
    _box(Vector3(1.4, 1.25, 1.6), Vector3(0, 1.0, -0.7), Color("e3d9b8"), boat)
    _box(Vector3(1.9, 0.12, 2.0), Vector3(0, 1.73, -0.7), Color("a35b46"), boat)
