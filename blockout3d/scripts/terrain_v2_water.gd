extends Node3D
## Terrain V3 water: light ocean, ONE flowing stream ribbon and batched
## illustrated river stones. Visual only; no physics or camera modifications.
const OCEAN_SHADER := preload("res://shaders/terrain_v2_ocean.gdshader")
const RIVER_SHADER := preload("res://shaders/terrain_v3_river.gdshader")
const OCEAN_SIZE_M := 360.0
const OCEAN_Y := 0.45
const RIVER_LAYER := 1 << 7

var ocean_surface: MeshInstance3D
var river_surface: MeshInstance3D
var stones_surface: MultiMeshInstance3D
var stream_segment_count := 0

func configure() -> void:
    _make_ocean()
    _make_river()
    _make_riverbank_stones()

func _make_ocean() -> void:
    ocean_surface = MeshInstance3D.new()
    ocean_surface.name = "OceanSurface"
    var plane := PlaneMesh.new()
    plane.size = Vector2(OCEAN_SIZE_M, OCEAN_SIZE_M)
    ocean_surface.mesh = plane
    ocean_surface.position = Vector3(0.0, OCEAN_Y, 0.0)
    var water_material := ShaderMaterial.new()
    water_material.shader = OCEAN_SHADER
    ocean_surface.material_override = water_material
    ocean_surface.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(ocean_surface)

func _raycast_surface(x: float, z: float) -> Dictionary:
    var ray := PhysicsRayQueryParameters3D.create(
        Vector3(x, 120.0, z), Vector3(x, -40.0, z))
    ray.collision_mask = RIVER_LAYER
    return get_world_3d().direct_space_state.intersect_ray(ray)

func _river_x(z: float) -> float:
    return -5.0 * sin((z + 55.0) * 0.047) + 1.5 * sin((z + 34.0) * 0.13)

func _add_river_vertex(tool: SurfaceTool, point: Vector3, uv: Vector2) -> void:
    tool.set_uv(uv)
    tool.set_normal(Vector3.UP)
    tool.add_vertex(point)

func _make_river() -> void:
    # Contiguous river segments only. Do NOT join nonadjacent ray hits into
    # giant cyan triangles (old code used "continue" without retaining gaps).
    var ribbon := SurfaceTool.new()
    ribbon.begin(Mesh.PRIMITIVE_TRIANGLES)
    var previous := Vector3.ZERO
    var previous_exists := false
    var previous_width := 0.0
    var last_z := -999.0
    stream_segment_count = 0

    for i in range(86):
        var z := -35.0 + float(i)
        var x := _river_x(z)
        var contact := _raycast_surface(x, z)
        if contact.is_empty():
            previous_exists = false
            continue
        var center := Vector3(x, float(contact.position.y) + 0.13, z)
        var width := 0.92 + 0.12 * sin(z * 0.27)
        if previous_exists and z - last_z <= 1.05:
            var delta := center - previous
            var tangent := Vector3(delta.x, 0.0, delta.z).normalized()
            var sideways := Vector3(-tangent.z, 0.0, tangent.x)
            var left_previous := previous - sideways * previous_width
            var right_previous := previous + sideways * previous_width
            var left_current := center - sideways * width
            var right_current := center + sideways * width
            var flow_v := (z + 35.0) * 0.9
            var prev_v := (last_z + 35.0) * 0.9
            _add_river_vertex(ribbon, left_previous, Vector2(0.0, prev_v))
            _add_river_vertex(ribbon, left_current, Vector2(0.0, flow_v))
            _add_river_vertex(ribbon, right_previous, Vector2(1.0, prev_v))
            _add_river_vertex(ribbon, right_previous, Vector2(1.0, prev_v))
            _add_river_vertex(ribbon, left_current, Vector2(0.0, flow_v))
            _add_river_vertex(ribbon, right_current, Vector2(1.0, flow_v))
            stream_segment_count += 1
        previous = center
        previous_width = width
        last_z = z
        previous_exists = true

    if stream_segment_count < 45:
        push_warning("TERRAIN V3 RIVER: fewer water segments than expected")
        return

    river_surface = MeshInstance3D.new()
    river_surface.name = "RiverSurface"
    river_surface.mesh = ribbon.commit()
    var material := ShaderMaterial.new()
    material.shader = RIVER_SHADER
    river_surface.material_override = material
    river_surface.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(river_surface)
    print("TERRAIN V3 RIVER PASS: ", stream_segment_count,
          " continuous animated segments; no skipped-water polygons or physics")

func _make_riverbank_stones() -> void:
    # Forty stones in one instanced draw call. Keep bridge approach clear.
    var transforms: Array[Transform3D] = []
    var source := SphereMesh.new()
    source.radius = 0.5
    source.height = 1.0
    source.radial_segments = 7
    source.rings = 4
    var stone_material := StandardMaterial3D.new()
    stone_material.albedo_color = Color(0.49, 0.47, 0.39)
    stone_material.roughness = 1.0
    source.material = stone_material
    for i in range(68):
        var z := -31.0 + float(i) * 1.08
        # Leave dry, traversable approaches at the wooden bridge.
        if absf(z - 9.0) < 5.5:
            continue
        var side := -1.0 if i % 2 == 0 else 1.0
        var offset := 3.35 + 1.3 * absf(sin(float(i) * 2.71))
        var x := _river_x(z) + side * offset
        var contact := _raycast_surface(x, z)
        if contact.is_empty() or float(contact.position.y) < OCEAN_Y + 0.4:
            continue
        var size := 0.23 + 0.11 * absf(sin(float(i) * 0.78))
        var center := Vector3(x, float(contact.position.y) + 0.03, z)
        var basis := Basis(Vector3.UP, float(i) * 2.399)
        basis = basis.scaled(Vector3(size * 1.3, size * 0.57, size))
        transforms.append(Transform3D(basis, center))
    var batch := MultiMesh.new()
    batch.transform_format = MultiMesh.TRANSFORM_3D
    batch.mesh = source
    batch.instance_count = transforms.size()
    for i in range(transforms.size()):
        batch.set_instance_transform(i, transforms[i])
    stones_surface = MultiMeshInstance3D.new()
    stones_surface.name = "IllustratedRiverbankStones"
    stones_surface.multimesh = batch
    stones_surface.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(stones_surface)
    print("TERRAIN V3 BANK PASS: ", transforms.size(),
          " low-poly stones in one batch, bridge approaches kept clear")
