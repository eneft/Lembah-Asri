extends RefCounted
## Shared original textured GLB: every lot gets its own transform and physics.
const HOUSE_PATH := "res://assets/environment/houses/main_house/rumah_utama.glb"
var collision_shapes: Dictionary = {}

func populate(world: Node3D, island: Node3D) -> void:
    var village := Node3D.new()
    village.name = "VillageTexturedHouses"
    world.add_child(village)
    var lots: Array[MeshInstance3D] = []
    for node in island.find_children("*", "MeshInstance3D", true, false):
        if str(node.name).begins_with("07_HOUSE_") and str(node.name).ends_with("_Walls"):
            lots.append(node as MeshInstance3D)
    # Wait for terrain colliders to enter the physics space before sampling foundations.
    await world.get_tree().physics_frame
    var source := load(HOUSE_PATH) as PackedScene
    assert(source != null, "Textured village house asset missing")
    var bounds_tool: RefCounted = load("res://scripts/house_glb_asset.gd").new()
    var foundation_material := StandardMaterial3D.new()
    foundation_material.albedo_color = Color("696759")
    foundation_material.roughness = 1.0
    for lot in lots:
        var bounds := lot.get_aabb()
        var center := lot.to_global(bounds.get_center())
        var bottom := lot.to_global(Vector3(bounds.get_center().x, bounds.get_center().y, bounds.position.z))
        var footprint := clampf(maxf(bounds.size.x, bounds.size.y) * 1.04, 6.3, 8.0)
        var house := Node3D.new()
        house.name = str(lot.name).trim_suffix("_Walls") + "_Textured"
        village.add_child(house)
        house.position = Vector3(center.x, bottom.y, center.z)
        house.rotation.y = atan2(6.0 - center.x, 15.0 - center.z)
        var model := source.instantiate() as Node3D
        model.name = "OriginalTexturedHouse"
        house.add_child(model)
        var mesh_bounds: AABB = bounds_tool._bounds(model)
        var factor := footprint / maxf(mesh_bounds.size.x, mesh_bounds.size.z)
        model.scale = Vector3.ONE * factor
        model.position = Vector3(-mesh_bounds.get_center().x * factor, -mesh_bounds.position.y * factor, -mesh_bounds.get_center().z * factor)
        # Foundation reaches below terrain; top follows the highest ground under the lot.
        var low_ground := bottom.y
        var high_ground := bottom.y
        for sample in [Vector3.ZERO, Vector3(-0.37, 0, -0.37), Vector3(0.37, 0, -0.37), Vector3(-0.37, 0, 0.37), Vector3(0.37, 0, 0.37)]:
            var at: Vector3 = house.to_global(sample * footprint)
            var query := PhysicsRayQueryParameters3D.create(Vector3(at.x, 60, at.z), Vector3(at.x, -6, at.z))
            var hit := world.get_world_3d().direct_space_state.intersect_ray(query)
            if not hit.is_empty():
                low_ground = minf(low_ground, hit.position.y)
                high_ground = maxf(high_ground, hit.position.y)
        house.position.y = high_ground + 0.025
        var foundation_height := maxf(0.18, high_ground - low_ground + 0.20)
        var foundation := MeshInstance3D.new()
        foundation.name = "StoneFoundation"
        var slab := BoxMesh.new()
        slab.size = Vector3(footprint * 0.78, foundation_height, footprint * 0.72)
        foundation.mesh = slab
        foundation.material_override = foundation_material
        foundation.position.y = -foundation_height * 0.5
        house.add_child(foundation)
        foundation.create_trimesh_collision()
        for child in model.find_children("*", "MeshInstance3D", true, false):
            var mesh := child as MeshInstance3D
            var key := mesh.mesh.get_instance_id()
            if not collision_shapes.has(key):
                collision_shapes[key] = mesh.mesh.create_trimesh_shape()
            var body := StaticBody3D.new()
            body.name = "DetailedHouseCollision"
            mesh.add_child(body)
            var collider := CollisionShape3D.new()
            collider.shape = collision_shapes[key]
            body.add_child(collider)
    village.set_meta("textured_house_count", lots.size())
    print("VILLAGE HOUSES READY: ", lots.size(), " textured GLB houses, shared meshes/materials, grounded foundations and matching collision")
