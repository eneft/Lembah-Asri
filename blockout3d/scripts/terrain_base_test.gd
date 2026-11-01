extends Node3D
## Uploaded terrain ONLY: no legacy island, props, houses, paths or old collision.
## Retains original controllable FBX character, camera, lighting and mobile UI.
const WEB_TERRAIN := "res://assets/environment/island/terrain_base_web.glb"
const SOURCE_TERRAIN := "res://assets/environment/island/terrain base.glb"
const TERRAIN_LAYER := 1 << 7
const SPAWN_XZ := Vector2(6.0, 15.0)

var new_root: Node3D
var new_mesh: MeshInstance3D
var new_collision: StaticBody3D
var terrain_scale := 140.0
var vertical_offset := 0.0
var is_ready := false
var status: Label
var world: Node3D

func _ready() -> void:
    world = $World
    _make_hud()
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
    status.text = "TERRAIN BASE V2 | Memuat model..."
    status.add_theme_font_size_override("font_size", 16)
    status.add_theme_color_override("font_color", Color("f8f4dc"))
    panel.add_child(status)
    var style := StyleBoxFlat.new()
    style.bg_color = Color(0.06, 0.14, 0.12, 0.88)
    style.set_content_margin_all(10)
    panel.add_theme_stylebox_override("panel", style)

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
    for n in root.find_children("*", "MeshInstance3D", true, false):
        return n as MeshInstance3D
    return null

func _install_terrain() -> void:
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
    if new_mesh == null or new_mesh.mesh == null:
        push_error("TERRAIN BASE FAIL: mesh absent in imported file")
        return
    # Terrain/dirt is nonmetallic, unlike source PBR metallicFactor=1.
    if new_mesh.mesh.get_surface_count() > 0:
        var material := new_mesh.mesh.surface_get_material(0)
        if material is StandardMaterial3D:
            var matte := (material as StandardMaterial3D).duplicate(true) as StandardMaterial3D
            matte.metallic = 0.0
            matte.roughness = 0.96
            matte.metallic_texture = null
            new_mesh.material_override = matte
    # Center the supplied mesh in the world. No old model is loaded for alignment.
    var bounds := _bounds_global(new_mesh)
    new_root.global_position.x -= bounds.get_center().x
    new_root.global_position.z -= bounds.get_center().z
    vertical_offset = -bounds.position.y
    new_root.global_position.y += vertical_offset
    # Static triangle collision follows the actual uploaded GLB surface.
    new_mesh.create_trimesh_collision()
    for body in new_mesh.find_children("*", "StaticBody3D", true, false):
        new_collision = body as StaticBody3D
        break
    if new_collision == null:
        push_error("TERRAIN BASE FAIL: terrain trimesh collision not created")
        return
    new_collision.collision_layer = TERRAIN_LAYER
    new_collision.collision_mask = 0
    await get_tree().physics_frame
    # Terrain has coast / holes; choose a real walkable triangle instead of
    # relying on the old village coordinates.
    var sample_points: Array[Vector2] = [
        SPAWN_XZ, Vector2.ZERO, Vector2(12, 0), Vector2(-12, 0),
        Vector2(0, 12), Vector2(0, -12), Vector2(12, 12),
        Vector2(-12, -12), Vector2(-12, 12), Vector2(12, -12)
    ]
    for radius in [24.0, 36.0, 48.0]:
        for xsign in [-1.0, 0.0, 1.0]:
            for zsign in [-1.0, 0.0, 1.0]:
                sample_points.append(Vector2(xsign * radius, zsign * radius))
    var hit: Dictionary = {}
    var spawn_xz := Vector2.ZERO
    for point in sample_points:
        var query := PhysicsRayQueryParameters3D.create(
            Vector3(point.x, 120.0, point.y),
            Vector3(point.x, -60.0, point.y))
        query.collision_mask = TERRAIN_LAYER
        var candidate := world.get_world_3d().direct_space_state.intersect_ray(query)
        if not candidate.is_empty():
            hit = candidate
            spawn_xz = point
            break
    if hit.is_empty():
        push_error("TERRAIN BASE FAIL: no walkable terrain collision anywhere in scanned map")
        return
    var player := world.get_node_or_null("Player3D") as CharacterBody3D
    if player == null:
        push_error("TERRAIN BASE FAIL: original controllable character missing")
        return
    player.global_position = hit.position + Vector3(0.0, 2.1, 0.0)
    player.velocity = Vector3.ZERO
    world.set("terrain_spawn_position", player.global_position)
    is_ready = true
    _refresh_text()
    print("TERRAIN BASE TEST PASS: clean uploaded GLB terrain, collider, character and camera; size=%s, spawn_xz=%s, spawn_height=%.3f" % [
        str(_bounds_global(new_mesh).size), str(spawn_xz), hit.position.y])

func _refresh_text() -> void:
    if status != null:
        status.text = "TERRAIN BASE V2 | KARAKTER SAJA\nWASD jalan | Shift lari | Space salto\nC kamera | Q/E putar | + / - tinggi terrain\nSkala: %.0f× | Offset: %.2f m\nTanpa objek dan collision lama" % [
            terrain_scale, vertical_offset]

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
