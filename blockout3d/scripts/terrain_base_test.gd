extends Node3D
## Independent terrain audit scene: preserves the existing Lembah Asri island,
## houses, roads, river, pier, player, camera and 2D project.
## T toggles between uploaded terrain and the original island topography.
const WEB_TERRAIN := "res://assets/environment/island/terrain_base_web.glb"
const SOURCE_TERRAIN := "res://assets/environment/island/terrain base.glb"
const LAND_NODE := "01_TERRAIN_Topography_Editable_1m_Grid"
const TERRAIN_LAYER := 1 << 7
const VILLAGE_SAMPLE := Vector2(6.0, 15.0)
const ORIGINAL_SAMPLE_HEIGHT := 5.5

var old_mesh: MeshInstance3D
var new_root: Node3D
var new_mesh: MeshInstance3D
var new_collision: StaticBody3D
var old_collision: Array[CollisionObject3D] = []
var terrain_scale := 140.0
var terrain_active := true
var vertical_offset := 0.0
var is_ready := false
var status: Label
var world: Node3D

func _ready() -> void:
    world = $World
    _make_hud()
    # This scene is terrain + character ONLY. Remove legacy scenery and its
    # colliders (houses, river, vegetation, paths, props) before terrain setup.
    _install_terrain.call_deferred()

func _make_hud() -> void:
    var ui := CanvasLayer.new()
    ui.name = "TerrainTestHUD"
    ui.layer = 3
    add_child(ui)
    var panel := PanelContainer.new()
    panel.position = Vector2(18, 171)
    ui.add_child(panel)
    status = Label.new()
    status.name = "TerrainTestStatus"
    status.text = "TERRAIN BASE | Mempersiapkan model..."
    status.add_theme_font_size_override("font_size", 16)
    status.add_theme_color_override("font_color", Color("f8f4dc"))
    panel.add_child(status)
    var style := StyleBoxFlat.new()
    style.bg_color = Color(0.06, 0.14, 0.12, 0.88)
    style.set_content_margin_all(10)
    panel.add_theme_stylebox_override("panel",style)

func _bounds_global(mesh: MeshInstance3D) -> AABB:
    var aabb := mesh.get_aabb()
    var lo := Vector3(INF, INF, INF)
    var hi := Vector3(-INF, -INF, -INF)
    for i in range(8):
        var corner := aabb.position + Vector3(
            aabb.size.x if (i & 1) != 0 else 0.0,
            aabb.size.y if (i & 2) != 0 else 0.0,
            aabb.size.z if (i & 4) != 0 else 0.0)
        var at := mesh.to_global(corner)
        lo = lo.min(at)
        hi = hi.max(at)
    return AABB(lo, hi - lo)

func _get_imported_mesh(root: Node3D) -> MeshInstance3D:
    if root is MeshInstance3D:
        return root as MeshInstance3D
    for n in root.find_children("*","MeshInstance3D",true,false):
        return n as MeshInstance3D
    return null

func _disable_old_terrain() -> void:
    if old_mesh == null:
        return
    old_mesh.visible = not terrain_active
    for collider in old_collision:
        if is_instance_valid(collider):
            collider.collision_layer = 0 if terrain_active else 1

func _install_terrain() -> void:
    var island := world.get_node_or_null("IslandBlockoutV01") as Node3D
    if island == null:
        push_error("TERRAIN BASE FAIL: original island not loaded")
        return
    for candidate in island.find_children("*","MeshInstance3D",true,false):
        if candidate.name == LAND_NODE:
            old_mesh = candidate as MeshInstance3D
            break
    if old_mesh == null:
        push_error("TERRAIN BASE FAIL: original terrain mesh not found")
        return
    for body in old_mesh.find_children("*", "CollisionObject3D", true, false):
        if body is CollisionObject3D:
            old_collision.append(body as CollisionObject3D)
    var input_path := WEB_TERRAIN if ResourceLoader.exists(WEB_TERRAIN) else SOURCE_TERRAIN
    var packed := load(input_path) as PackedScene
    if packed == null:
        push_error("TERRAIN BASE FAIL: uploaded GLB could not be loaded")
        return
    new_root = packed.instantiate() as Node3D
    if new_root == null:
        push_error("TERRAIN BASE FAIL: imported GLB is not Node3D")
        return
    new_root.name = "TerrainBaseUploadedV2"
    world.add_child(new_root)
    new_root.scale = Vector3.ONE * terrain_scale
    new_mesh = _get_imported_mesh(new_root)
    if new_mesh == null:
        push_error("TERRAIN BASE FAIL: mesh absent in imported file")
        return
    # Uploaded terrain's GLB defaults to metallicFactor=1.0; soil is matte.
    if new_mesh.mesh.get_surface_count() > 0:
        var original := new_mesh.mesh.surface_get_material(0)
        if original is StandardMaterial3D:
            var fixed := (original as StandardMaterial3D).duplicate(true) as StandardMaterial3D
            fixed.metallic = 0.0
            fixed.roughness = 0.96
            fixed.metallic_texture = null
            new_mesh.material_override = fixed
    # Keep the original model geometry; fit only its horizontal footprint.
    var old_box := _bounds_global(old_mesh)
    var new_box := _bounds_global(new_mesh)
    new_root.global_position.x += old_box.get_center().x - new_box.get_center().x
    new_root.global_position.z += old_box.get_center().z - new_box.get_center().z
    # Single static terrain collider, no per-triangle rigid bodies.
    new_mesh.create_trimesh_collision()
    for body in new_mesh.find_children("*", "StaticBody3D", true, false):
        new_collision = body as StaticBody3D
        break
    if new_collision == null:
        push_error("TERRAIN BASE FAIL: terrain trimesh collision not created")
        return
    new_collision.collision_layer = TERRAIN_LAYER
    new_collision.collision_mask = 0
    # Set origin height so existing roads/plaza and terrain can be compared
    # at the same landmark. Do NOT stretch/reflow the actual terrain.
    await get_tree().physics_frame
    var query := PhysicsRayQueryParameters3D.create(
        Vector3(VILLAGE_SAMPLE.x, 90.0, VILLAGE_SAMPLE.y),
        Vector3(VILLAGE_SAMPLE.x, -90.0, VILLAGE_SAMPLE.y))
    query.collision_mask = TERRAIN_LAYER
    var hit := world.get_world_3d().direct_space_state.intersect_ray(query)
    if hit.is_empty():
        push_warning("TERRAIN BASE: plaza sample missed new surface; origin height unchanged")
    else:
        vertical_offset = ORIGINAL_SAMPLE_HEIGHT - float(hit.position.y)
        new_root.global_position.y += vertical_offset
    # Stop old world from recreating village props on the next deferred frame.
    # Preserve the world camera follow and player respawn logic.
    # Keep the original island node only as a transform reference until setup.
    # Then delete ALL old scenery and collision, not merely the old ground.
    var old_island := world.get_node_or_null("IslandBlockoutV01")
    if old_island != null:
        old_island.queue_free()
    var old_house := world.get_node_or_null("RumahNelayanPesisir")
    if old_house != null:
        old_house.queue_free()
    for node in world.get_children():
        if node == new_root or node is CharacterBody3D or node is Camera3D or node is DirectionalLight3D or node is WorldEnvironment or node is CanvasLayer:
            continue
        if node.name == "Player3D":
            continue
        # All legacy village generated geometry and old prop/collision nodes.
        node.queue_free()
    is_ready = true
    _refresh_text()
    var new_dimensions := _bounds_global(new_mesh).size
    print("TERRAIN BASE TEST PASS: uploaded GLB active, old scenery removed; scaled=%.1f, global_dimensions=%s, y_offset=%.3f, collider=%s" % [
        terrain_scale, str(new_dimensions), vertical_offset, str(new_collision != null)])
    # Reposition character safely near the village comparison sample.
    var player := world.get_node_or_null("Player3D") as CharacterBody3D
    if player != null:
        player.global_position = Vector3(VILLAGE_SAMPLE.x, ORIGINAL_SAMPLE_HEIGHT + 2.5, VILLAGE_SAMPLE.y)
        player.velocity = Vector3.ZERO

func _refresh_text() -> void:
    if status == null:
        return
    var active_name := "TERRAIN BASE V2 | KARAKTER SAJA"
    status.text = "%s\nWASD jalan | Space salto | + / - tinggi terrain\nSkala: %.0f× | Offset: %.2f m\nSemua objek dan collision lama dihapus" % [
        active_name,terrain_scale, vertical_offset]

func _unhandled_input(event: InputEvent) -> void:
    if not is_ready or not (event is InputEventKey):
        return
    if not event.pressed or event.echo:
        return
    if event.keycode == KEY_EQUAL or event.keycode == KEY_KP_ADD:
        vertical_offset += 0.5
        new_root.position.y += 0.5
        _refresh_text()
    elif event.keycode == KEY_MINUS or event.keycode == KEY_KP_SUBTRACT:
        vertical_offset -= 0.5
        new_root.position.y -= 0.5
        _refresh_text()
