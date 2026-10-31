extends RefCounted
## Import the user's ORIGINAL textured Meshy GLB as the childhood house.
## The binary must be uploaded separately into the repository's asset folder;
## no procedural model is substituted when the source is present.
const HOUSE_PATH := "res://assets/environment/houses/main_house/rumah_utama.glb"
const TARGET_FOOTPRINT := 7.8
const HOUSE_YAW_DEGREES := 0.0
const MIN_SCALE := 0.1
const MAX_SCALE := 100.0

func is_asset_available() -> bool:
    return ResourceLoader.exists(HOUSE_PATH)

func _bounds(root: Node3D) -> AABB:
    var nodes: Array[Node] = []
    if root is MeshInstance3D:
        nodes.append(root)
    nodes.append_array(root.find_children("*", "MeshInstance3D", true, false))
    var minimum := Vector3(INF, INF, INF)
    var maximum := Vector3(-INF, -INF, -INF)
    for node in nodes:
        var mesh: MeshInstance3D = node as MeshInstance3D
        if mesh == null or mesh.mesh == null:
            continue
        var aabb := mesh.get_aabb()
        for i in range(8):
            var corner := aabb.position + Vector3(
                aabb.size.x if (i & 1) != 0 else 0.0,
                aabb.size.y if (i & 2) != 0 else 0.0,
                aabb.size.z if (i & 4) != 0 else 0.0)
            var local := root.to_local(mesh.to_global(corner))
            minimum = minimum.min(local)
            maximum = maximum.max(local)
    if minimum.x == INF:
        return AABB()
    return AABB(minimum, maximum - minimum)

func build_childhood_house(parent: Node3D, at: Vector3) -> bool:
    if not is_asset_available():
        return false
    var resource: Resource = load(HOUSE_PATH)
    if not (resource is PackedScene):
        push_warning("HOUSE GLB: original asset exists but failed to import as PackedScene")
        return false
    var imported: Node = (resource as PackedScene).instantiate()
    if not (imported is Node3D):
        imported.free()
        push_warning("HOUSE GLB: imported root is not a Node3D")
        return false

    # Add to scene before reading transforms, but never keep an invalid mesh.
    var house := Node3D.new()
    house.name = "RumahMasaKecilTerbengkalai"
    house.position = at
    parent.add_child(house)
    var model: Node3D = imported as Node3D
    model.name = "ModelGLBAsli"
    house.add_child(model)
    var bounds := _bounds(model)
    var longest := maxf(bounds.size.x, bounds.size.z)
    if longest < 0.01 or bounds.size.y < 0.01:
        house.queue_free()
        push_warning("HOUSE GLB: invalid source mesh dimensions")
        return false

    # Meshy exports unit-scale centered models. Scale one time, preserving
    # original UV/materials/textures; translate the source bottom onto ground.
    var factor := clampf(TARGET_FOOTPRINT / longest, MIN_SCALE, MAX_SCALE)
    model.scale = Vector3.ONE * factor
    model.rotation.y = deg_to_rad(HOUSE_YAW_DEGREES)
    model.position = Vector3(
        -(bounds.position.x + bounds.size.x * 0.5) * factor,
        -bounds.position.y * factor,
        -(bounds.position.z + bounds.size.z * 0.5) * factor
    )

    # Preserve collision of the old home while removing its old visible mesh.
    # The solid wall footprint is smaller than the roof's eaves/porch.
    var solid := StaticBody3D.new()
    solid.name = "DindingCollision"
    solid.position = Vector3(0, 1.4, 0)
    house.add_child(solid)
    var shape := CollisionShape3D.new()
    shape.name = "BangunanSolid"
    var dimensions := BoxShape3D.new()
    dimensions.size = Vector3(6.3, 2.8, 5.5)
    shape.shape = dimensions
    solid.add_child(shape)

    print("LEMBAH HOUSE GLB ACTIVE: original textured Meshy house at ", house.position,
        " source bounds=", bounds.size, " scale=", factor)
    return true
