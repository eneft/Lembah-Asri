extends Node3D
## Lightweight water for Terrain V2 concept. Two draw calls: one shader ocean
## plane and one thin opaque river ribbon. No ocean physics or costly particles.
##
## The derived GLB remains the authoritative collision surface. This node
## adds only visual water; it never replaces mesh, collisions, player or camera.
const OCEAN_SHADER := preload("res://shaders/terrain_v2_ocean.gdshader")
const OCEAN_SIZE_M := 360.0
const OCEAN_Y := 0.45
const RIVER_LAYER := 1 << 7

var ocean_surface: MeshInstance3D
var river_surface: MeshInstance3D

func configure() -> void:
    _make_ocean()
    _make_river()

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
        Vector3(x, 120.0, z),
        Vector3(x, -40.0, z))
    ray.collision_mask = RIVER_LAYER
    return get_world_3d().direct_space_state.intersect_ray(ray)

func _river_x(z: float) -> float:
    # Must agree with tools/terrain_v2_topography.py river_center_x()
    return -5.0 * sin((z + 55.0) * 0.047) + 1.5 * sin((z + 34.0) * 0.13)

func _make_river() -> void:
    # A small stream starting at the northern mountain foothills, reaching
    # the southern shore. Riverbed is sculpted in Python and collision-tested
    # independently of this decorative water ribbon.
    var ribbon := SurfaceTool.new()
    ribbon.begin(Mesh.PRIMITIVE_TRIANGLES)
    var points: Array[Vector3] = []
    for i in range(86):
        var z := -35.0 + float(i)
        var x := _river_x(z)
        var contact := _raycast_surface(x, z)
        if contact.is_empty():
            continue
        points.append(Vector3(x, float(contact.position.y) + 0.075, z))

    if points.size() < 45:
        push_warning("TERRAIN V2 WATER: stream surface shorter than expected")
        return

    var width := 1.4
    for i in range(points.size() - 1):
        var previous: Vector3 = points[i]
        var following: Vector3 = points[i + 1]
        var tangent := (following - previous).normalized()
        var sideways := Vector3(-tangent.z, 0.0, tangent.x).normalized() * width
        var p0 := previous - sideways
        var p1 := previous + sideways
        var p2 := following - sideways
        var p3 := following + sideways
        for vtx in [p0, p2, p1, p1, p2, p3]:
            ribbon.set_normal(Vector3.UP)
            ribbon.add_vertex(vtx)

    river_surface = MeshInstance3D.new()
    river_surface.name = "RiverSurface"
    river_surface.mesh = ribbon.commit()
    var river_material := StandardMaterial3D.new()
    river_material.albedo_color = Color(0.12, 0.66, 0.82, 1.0)
    river_material.roughness = 0.38
    river_material.metallic = 0.0
    river_material.cull_mode = BaseMaterial3D.CULL_DISABLED
    river_surface.material_override = river_material
    river_surface.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(river_surface)
    print("TERRAIN V2 RIVER PASS: ", points.size(),
          " water positions; water uses no physics or shader detail passes")
