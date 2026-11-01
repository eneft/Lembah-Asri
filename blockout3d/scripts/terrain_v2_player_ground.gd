extends RefCounted
## Physics-only collision for Terrain V2. Never collide the imported scan mesh:
## original underside/cliff/overlapping triangles can trap the player after
## their vertices were projected onto the redesigned height field.
## The analytic function is kept in sync with tools/terrain_v2_topography.py.
const GRID_STEP_M := 1.5

static func _smooth(a: float, b: float, x: float) -> float:
    var t: float = clampf((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)

static func _mesa(u: float, v: float, cx: float, cz: float, rx: float, rz: float, elevation: float) -> float:
    var radius: float = sqrt(pow((u - cx) / rx, 2.0) + pow((v - cz) / rz, 2.0))
    return elevation * (1.0 - _smooth(0.60, 1.20, radius))

static func _hill(u: float, v: float, cx: float, cz: float, rx: float, rz: float, elevation: float) -> float:
    var radius_sq: float = pow((u - cx) / rx, 2.0) + pow((v - cz) / rz, 2.0)
    return elevation * exp(-2.7 * radius_sq)

static func _river_x(z: float) -> float:
    return -5.0 * sin((z + 55.0) * 0.047) + 1.5 * sin((z + 34.0) * 0.13)

static func height_at(x: float, z: float, half_x: float, half_z: float) -> float:
    var u: float = x / half_x
    var v: float = z / half_z
    var edge: float = maxf(absf(u), absf(v))
    var h: float = 2.65 + 1.40 * (1.0 - _smooth(-0.15, 0.75, v))
    h += _mesa(u, v, -0.57, -0.35, 0.45, 0.39, 2.65)
    h += _mesa(u, v, 0.12, -0.10, 0.53, 0.38, 0.72)
    h += _mesa(u, v, -0.50, 0.33, 0.32, 0.26, 0.32)
    h += _hill(u, v, 0.08, -0.73, 0.19, 0.19, 20.0)
    h += _hill(u, v, 0.64, -0.55, 0.19, 0.17, 7.5)
    h += _hill(u, v, -0.71, -0.68, 0.14, 0.16, 4.0)
    var beach: float = maxf(_smooth(0.30, 0.65, v), _smooth(0.50, 0.80, u))
    var coast: float = _smooth(0.945 - 0.065 * beach, 1.01, edge)
    h = h * (1.0 - coast) + 0.15 * coast
    var downstream: float = clampf((48.0 - z) / 90.0, 0.0, 1.0)
    var river_level: float = 1.40 + 4.60 * downstream
    var river_floor: float = minf(h - 0.46, river_level)
    var river_distance: float = absf(x - _river_x(z)) / 2.90
    var river_weight: float = exp(-2.20 * pow(river_distance, 4.0))
    river_weight *= _smooth(-45.0, -32.0, z)
    river_weight *= 1.0 - _smooth(45.0, 52.0, z)
    return h * (1.0 - river_weight) + river_floor * river_weight

static func build(half_x: float, half_z: float, vertical_offset: float) -> StaticBody3D:
    assert(half_x > 20.0 and half_z > 20.0)
    var count_x: int = ceili(half_x * 2.0 / GRID_STEP_M)
    var count_z: int = ceili(half_z * 2.0 / GRID_STEP_M)
    var vertices := PackedVector3Array()
    for zi in range(count_z):
        var z0: float = -half_z + float(zi) * (half_z * 2.0 / float(count_z))
        var z1: float = -half_z + float(zi + 1) * (half_z * 2.0 / float(count_z))
        for xi in range(count_x):
            var x0: float = -half_x + float(xi) * (half_x * 2.0 / float(count_x))
            var x1: float = -half_x + float(xi + 1) * (half_x * 2.0 / float(count_x))
            var p00 := Vector3(x0, height_at(x0, z0, half_x, half_z), z0)
            var p01 := Vector3(x0, height_at(x0, z1, half_x, half_z), z1)
            var p10 := Vector3(x1, height_at(x1, z0, half_x, half_z), z0)
            var p11 := Vector3(x1, height_at(x1, z1, half_x, half_z), z1)
            # Upward-facing winding: slope is walkable, not an inverted wall.
            vertices.append_array(PackedVector3Array([p00, p01, p10, p10, p01, p11]))
    var arrays: Array = []
    arrays.resize(Mesh.ARRAY_MAX)
    arrays[Mesh.ARRAY_VERTEX] = vertices
    var collider_mesh := ArrayMesh.new()
    collider_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
    var body := StaticBody3D.new()
    body.name = "TerrainV2PlayerGround"
    body.position.y = vertical_offset
    body.collision_layer = 129 # bit 1: player; bit 8: river/spawn raycasts
    body.collision_mask = 0
    var shape_node := CollisionShape3D.new()
    shape_node.name = "CleanHeightfieldCollider"
    shape_node.shape = collider_mesh.create_trimesh_shape()
    body.add_child(shape_node)
    print("TERRAIN V2 CLEAN GROUND: ", count_x, " x ", count_z,
        " grid cells, source scan collision DISABLED")
    return body
