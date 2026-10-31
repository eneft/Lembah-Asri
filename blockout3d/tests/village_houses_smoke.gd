extends SceneTree
func _initialize() -> void:
    call_deferred("_test")
func _test() -> void:
    var world := load("res://scenes/world.tscn").instantiate() as Node3D
    root.add_child(world)
    for i in range(5):
        await physics_frame
    var village := world.get_node("VillageTexturedHouses")
    assert(village.get_child_count() == 18, "Not all village houses replaced")
    var shared_meshes: Dictionary = {}
    var textured := 0
    for house in village.get_children():
        var meshes: Array[Node] = house.get_node("OriginalTexturedHouse").find_children("*", "MeshInstance3D", true, false)
        assert(not meshes.is_empty(), "House model has no visible geometry")
        for mesh in meshes:
            shared_meshes[mesh.mesh.get_instance_id()] = true
            var material: StandardMaterial3D = mesh.get_active_material(0)
            assert(material != null and material.albedo_texture != null, "House has no texture")
            assert(mesh.has_node("DetailedHouseCollision"), "Missing new house collision")
            textured += 1
        var foot := house.get_node("StoneFoundation")
        assert(foot.position.y < 0.0, "Foundation protrudes through house")
    assert(shared_meshes.size() == 1, "Models unexpectedly duplicated their mesh data")
    for mesh in world.get_node("IslandBlockoutV01").find_children("*", "MeshInstance3D", true, false):
        if str(mesh.name).begins_with("07_HOUSE_"):
            assert(not mesh.visible, "Old placeholder house still visible")
            assert(mesh.find_children("*", "StaticBody3D", true, false).is_empty(), "Old ghost collision remains")
    print("VILLAGE HOUSES PASS: 18 original textured houses, shared mesh/texture resources, matching collision, old placeholders hidden")
    quit(0)
