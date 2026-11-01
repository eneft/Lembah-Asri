extends Node3D
## CLEAN terrain test. Only the uploaded GLB + original controllable
## FBX character, lighting, mobile input and camera are instanced.
## No island, roads, vegetation, buildings, bridges, pier or old colliders.
const WEB_TERRAIN := "res://assets/environment/island/terrain_base_web.glb"
const SOURCE_TERRAIN := "res://assets/environment/island/terrain base.glb"
const TERRAIN_SCALE := 140.0
const SPAWN_XZ := Vector2(6.0, 15.0)

var new_root: Node3D
var new_mesh: MeshInstance3D
var new_collision: StaticBody3D
var is_ready := false
var world: Node3D
var status: Label
var ground_y := 0.0

func _ready() -> void:
    world = $World
    _make_hud()
    _install_terrain.call_deferred()

func _make_hud() -> void:
    var ui := CanvasLayer.new()
    ui.name = "TerrainOnlyHUD"
    ui.layer = 3
    add_child(ui)
    var panel := PanelContainer.new()
    panel.position = Vector2(18, 16)
    ui.add_child(panel)
    status = Label.new()
    status.name = "TerrainOnlyStatus"
    status.text = "LEMBAH ASRI | Memuat terrain GLB..."
    status.add_theme_font_size_override("font_size", 16)
    status.add_theme_color_override("font_color", Color("f8f4dc"))
    panel.add_child(status)
    var style := StyleBoxFlat.new()
    style.bg_color = Color(0.06, 0.14, 0.12, 0.85)
    style.set_content_margin_all(10)
    panel.add_theme_stylebox_override("panel", style)

func _bounds_global(mesh: MeshInstance3D) -> AABB:
    var bb := mesh.get_aabb()
    var low := Vector3(INF, INF, INF)
    var high := Vector3(-INF, -INF, -INF)
    for i in range(8):
        var p := bb.position + Vector3(
            bb.size.x if i & 1 else 0.0,
            bb.size.y if i & 2 else 0.0,
            bb.size.z if i & 4 else 0.0)
        var gp := mesh.to_global(p)
        low = low.min(gp)
        high = high.max(gp)
    return AABB(low, high - low)

func _get_imported_mesh(root: Node3D) -> MeshInstance3D:
    if root is MeshInstance3D:
        return root as MeshInstance3D
    for n in root.find_children("*", "MeshInstance3D", true, false):
        return n as MeshInstance3D
    return null

func _install_terrain() -> void:
    if not bool(world.get("terrain_only_mode")):
        push_error("TERRAIN ONLY FAIL: the player world must not load legacy objects")
        return
    if world.has_node("IslandBlockoutV01") or world.has_node("VillageTexturedHouses") or world.has_node("RumahNelayanPesisir"):
        push_error("TERRAIN ONLY FAIL: old objects were instantiated")
        return
    var input_path := WEB_TERRAIN if ResourceLoader.exists(WEB_TERRAIN) else SOURCE_TERRAIN
    var packed := load(input_path) as PackedScene
    if packed == null:
        push_error("TERRAIN ONLY FAIL: optimized terrain GLB missing")
        return
    new_root = packed.instantiate() as Node3D
    if new_root == null:
        push_error("TERRAIN ONLY FAIL: imported terrain GLB root invalid")
        return
    new_root.name = "TerrainBaseUploadedV2"
    world.add_child(new_root)
    new_root.scale = Vector3.ONE * TERRAIN_SCALE
    new_mesh = _get_imported_mesh(new_root)
    if new_mesh == null or new_mesh.mesh == null:
        push_error("TERRAIN ONLY FAIL: imported GLB contains no mesh")
        return
    # GLB is ~1 unit across; enlarge to island-scale, center geometry at world origin.
    var bounds := _bounds_global(new_mesh)
    new_root.global_position.x -= bounds.get_center().x
    new_root.global_position.z -= bounds.get_center().z
    if new_mesh.mesh.get_surface_count() > 0:
        var material := new_mesh.mesh.surface_get_material(0)
        if material is StandardMaterial3D:
            var matte := (material as StandardMaterial3D).duplicate(true) as StandardMaterial3D
            matte.metallic = 0.0
            matte.metallic_texture = null
            matte.roughness = 0.96
            new_mesh.material_override = matte

    # IMPORTANT: CharacterBody3D's default collision mask includes layer 1.
    # Old prototype put terrain on layer 8 and accidentally relied on old island
    # collision. Real terrain collider MUST be on layer 1.
    new_mesh.create_trimesh_collision()
    for body in new_mesh.find_children("*", "StaticBody3D", true, false):
        new_collision = body as StaticBody3D
        break
    if new_collision == null:
        push_error("TERRAIN ONLY FAIL: terrain collider could not be generated")
        return
    new_collision.collision_layer = 1
    new_collision.collision_mask = 0

    # Align the actual terrain surface to y=0 at spawn, then place the player
    # above it. Nothing else is kept as a hidden collider or secondary mesh.
    await get_tree().physics_frame
    var ray := PhysicsRayQueryParameters3D.create(
        Vector3(SPAWN_XZ.x, 90.0, SPAWN_XZ.y),
        Vector3(SPAWN_XZ.x, -90.0, SPAWN_XZ.y))
    ray.collision_mask = 1
    var hit := world.get_world_3d().direct_space_state.intersect_ray(ray)
    if hit.is_empty():
        push_error("TERRAIN ONLY FAIL: no terrain surface below character spawn")
        return
    new_root.global_position.y -= float(hit.position.y)
    await get_tree().physics_frame
    hit = world.get_world_3d().direct_space_state.intersect_ray(ray)
    if hit.is_empty():
        push_error("TERRAIN ONLY FAIL: real terrain collider disappeared after alignment")
        return
    ground_y = float(hit.position.y)
    var player := world.get_node_or_null("Player3D") as CharacterBody3D
    if player == null:
        push_error("TERRAIN ONLY FAIL: player missing")
        return
    player.global_position = Vector3(SPAWN_XZ.x, ground_y + 2.0, SPAWN_XZ.y)
    player.velocity = Vector3.ZERO
    world.set("terrain_test_spawn", player.global_position)
    is_ready = true
    status.text = "LEMBAH ASRI | TERRAIN BARU SAJA\nWASD: Jalan  |  Shift: Lari  |  Space: Salto\nC: Kamera  |  Q/E: Putar  |  Scroll: Zoom\nTidak ada rumah, jalan, laut, atau objek lama"
    var global_bounds := _bounds_global(new_mesh)
    print("TERRAIN ONLY READY: original terrain GLB, one actual collider, original character, no old island; size=%s spawn_ground=%.3f" % [
        str(global_bounds.size), ground_y])
