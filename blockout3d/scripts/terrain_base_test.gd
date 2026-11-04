extends Node3D
## Uploaded terrain ONLY: no legacy island, props, houses, paths or old collision.
## Retains original controllable FBX character, camera, lighting and mobile UI.
const WEB_TERRAIN := "res://assets/environment/island/terrain_base_web.glb"
const SOURCE_TERRAIN := "res://assets/environment/island/terrain base.glb"
const WATER_SCRIPT := preload("res://scripts/terrain_v2_water.gd")
const INFRASTRUCTURE_SCRIPT := preload("res://scripts/terrain_v3_infrastructure.gd")
const SETTLEMENT_SCRIPT := preload("res://scripts/terrain_v7_settlement.gd")
const VEGETATION_SCRIPT := preload("res://scripts/terrain_v7_vegetation.gd")
const GROUND_SHADER := preload("res://shaders/terrain_v2_ground.gdshader")
const PAINTED_COLORMAP := "res://assets/environment/island/terrain_v3_painted_colormap.png"
const TERRAIN_RAY_LAYER := 1 << 7
const PLAYER_GROUND_LAYER := 1
const SPAWN_XZ := Vector2(6.0, 15.0)

var new_root: Node3D
var new_mesh: MeshInstance3D
var new_collision: StaticBody3D
var water_root: Node3D
var infrastructure_root: Node3D
var settlement_root: Node3D
var vegetation_root: Node3D
var terrain_scale := 140.0
var vertical_offset := 0.0
var is_ready := false
var status: Label
var beach_button: Button
var village_button: Button
var village_spawn := Vector3.ZERO
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
    panel.position = Vector2(18, 120)
    ui.add_child(panel)
    status = Label.new()
    status.name = "TerrainTestStatus"
    status.text = "TERRAIN BASE V2 | Memuat model..."
    status.add_theme_font_size_override("font_size", 12)
    status.add_theme_color_override("font_color", Color("f8f4dc"))
    panel.add_child(status)
    var style := StyleBoxFlat.new()
    style.bg_color = Color(0.06, 0.14, 0.12, 0.88)
    style.set_content_margin_all(6)
    panel.add_theme_stylebox_override("panel", style)
    # Mobile-friendly landmark preview. No changes to the normal game spawn,
    # camera movement, avatar, or terrain navigation.
    var travel := HBoxContainer.new()
    travel.name = "CoastPreviewControls"
    travel.position = Vector2(18.0, 165.0)
    travel.add_theme_constant_override("separation", 6)
    ui.add_child(travel)
    beach_button = Button.new()
    beach_button.name = "VisitBeach"
    beach_button.text = "Pantai"
    beach_button.custom_minimum_size = Vector2(108.0, 46.0)
    beach_button.disabled = true
    beach_button.pressed.connect(_visit_beach)
    travel.add_child(beach_button)
    village_button = Button.new()
    village_button.name = "ReturnVillage"
    village_button.text = "Kembali Desa"
    village_button.custom_minimum_size = Vector2(134.0, 46.0)
    village_button.visible = false
    village_button.pressed.connect(_return_to_village)
    travel.add_child(village_button)

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
    # The derived Web GLB carries a single freshly baked painterly atlas.
    # Use Godot's lightweight built-in PBR shading, not a costly shader with
    # 5 texture samples per pixel. Preserve the UV seams and grass/path colors.
    if new_mesh.mesh.get_surface_count() == 0:
        push_error("TERRAIN BASE FAIL: no material surfaces")
        return
    var original := new_mesh.mesh.surface_get_material(0) as StandardMaterial3D
    if original == null or original.albedo_texture == null:
        push_error("TERRAIN BASE FAIL: baked retexture albedo missing")
        return
    # V3 imports only the CLEAN terrain plus a 1K painterly grass/earth/sand/rock
    # atlas. Feed the imported texture to the material; otherwise a 4K source
    # atlas would be baked but the screen would still show flat procedural color.
    var ground_material := ShaderMaterial.new()
    ground_material.shader = GROUND_SHADER
    ground_material.set_shader_parameter("biome_atlas", original.albedo_texture)
    # This image is baked in CI by terrain_v3_painted_map.py using EXACT
    # source heightfield UVs; the atlas is only a 12% close-up detail layer.
    if not ResourceLoader.exists(PAINTED_COLORMAP):
        push_error("PAINTED TERRAIN FAIL: full-island illustration missing")
        return
    var painted_tex := load(PAINTED_COLORMAP) as Texture2D
    if painted_tex == null or painted_tex.get_width() < 1024:
        push_error("PAINTED TERRAIN FAIL: illustration image not imported or too small")
        return
    ground_material.set_shader_parameter("painted_colormap", painted_tex)
    new_mesh.material_override = ground_material
    print("PAINTED TERRAIN V1 BOUND: ",painted_tex.get_size(),
          " real non-tiled world color; original atlas retained as 12% detail")
    # Center the supplied mesh in the world. No old model is loaded for alignment.
    var bounds := _bounds_global(new_mesh)
    new_root.global_position.x -= bounds.get_center().x
    new_root.global_position.z -= bounds.get_center().z
    vertical_offset = -bounds.position.y
    new_root.global_position.y += vertical_offset
    # New V3 mesh has a consistent grid, no scan undersides, and a deliberate
    # coastline mask. Physics MUST use precisely these visible triangles, not
    # a rectangular independent heightmap that allows walking on open water.
    new_mesh.create_trimesh_collision()
    for body in new_mesh.find_children("*", "StaticBody3D", true, false):
        new_collision = body as StaticBody3D
        break
    if new_collision == null:
        push_error("TERRAIN V3 FAIL: clean surface collision was not generated")
        return
    new_collision.collision_layer = TERRAIN_RAY_LAYER | PLAYER_GROUND_LAYER
    new_collision.collision_mask = 0
    await get_tree().physics_frame

    # Blueprint V2: a lightweight ocean around the entire island and
    # visible north-to-south river surface. Neither has physics and neither
    # interferes with the authoritative uploaded terrain's collision.
    water_root = Node3D.new()
    water_root.name = "TerrainV2Water"
    water_root.set_script(WATER_SCRIPT)
    world.add_child(water_root)
    water_root.call("configure")

    # Infrastructure must live directly in the world in METRES. The source
    # imported GLB uses a 140x transform; parenting a bridge to that mesh
    # can silently transform its collision geometry away from visual terrain.
    infrastructure_root = Node3D.new()
    infrastructure_root.name = "TerrainV3Infrastructure"
    infrastructure_root.set_script(INFRASTRUCTURE_SCRIPT)
    world.add_child(infrastructure_root)
    infrastructure_root.call("configure")
    # A separate V7 building layer over the exact V6.8 terrain mesh.
    # Build after the authoritative ground collider has synchronized.
    await get_tree().physics_frame
    settlement_root = Node3D.new()
    settlement_root.name = "VillageBuildingsV7"
    settlement_root.set_script(SETTLEMENT_SCRIPT)
    world.add_child(settlement_root)
    settlement_root.call("configure", world)
    if not bool(settlement_root.get("finished")):
        push_error("V7 SETTLEMENT FAIL: buildings failed to initialize")
        return
    # Phase 1 V7.3 lives in a separate layer. Plant only after terrain and
    # buildings exist: all shrubs/grass and trunks are matched to real ground.
    vegetation_root = Node3D.new()
    vegetation_root.name = "VillageVegetationV73"
    vegetation_root.set_script(VEGETATION_SCRIPT)
    world.add_child(vegetation_root)
    vegetation_root.call("configure", world)
    if not bool(vegetation_root.get("finished")):
        push_error("V7.3 VEGETATION FAIL: no safe grounded foliage scene")
        return
    # StaticBody3D collision shapes created during an idle callback become
    # queryable AFTER the next physics server sync. The old smoke test ran a
    # ray in the same tick and wrongly concluded that the bridge was absent.
    await get_tree().physics_frame
    await get_tree().physics_frame

    # Terrain has coast / holes; choose a real walkable triangle instead of
    # relying on the old village coordinates.
    # A ray hit near the jagged coast is NOT a playable spawn. V3 scans for
    # dry, mostly flat land with at least 5m clearance in every direction.
    # In the prior build (6,15) spawned at Y=0.548 beside the 0.45m sea,
    # trapping character travel immediately at a shoreline triangle.
    var sample_points: Array[Vector2] = [
        Vector2.ZERO, Vector2(-12,0), Vector2(12,0), Vector2(-24,-8),
        Vector2(24,-8), Vector2(0,-16), Vector2(0,16),
        Vector2(-20,16), Vector2(20,16), Vector2(-36,0),
        Vector2(36,0), Vector2(-15,-24), Vector2(15,-24)
    ]
    for radius in [18.0, 27.0, 36.0, 45.0]:
        for xsign in [-1.0, -0.5, 0.0, 0.5, 1.0]:
            for zsign in [-1.0, -0.5, 0.0, 0.5, 1.0]:
                sample_points.append(Vector2(xsign * radius, zsign * radius))
    var probe_offsets: Array[Vector2] = [
        Vector2(0,-5), Vector2(0,5), Vector2(-5,0), Vector2(5,0),
        Vector2(-3.5,-3.5), Vector2(3.5,-3.5), Vector2(-3.5,3.5), Vector2(3.5,3.5)
    ]
    var hit: Dictionary = {}
    var spawn_xz := Vector2.ZERO
    for point in sample_points:
        var query := PhysicsRayQueryParameters3D.create(
            Vector3(point.x, 120.0, point.y), Vector3(point.x, -60.0, point.y))
        query.collision_mask = TERRAIN_RAY_LAYER
        var candidate := world.get_world_3d().direct_space_state.intersect_ray(query)
        if candidate.is_empty():
            continue
        if candidate.position.y <= 2.2 or candidate.normal.y < 0.91:
            continue
        var has_clearance := true
        for delta in probe_offsets:
            var around := PhysicsRayQueryParameters3D.create(
                Vector3(point.x + delta.x, 120.0, point.y + delta.y),
                Vector3(point.x + delta.x, -60.0, point.y + delta.y))
            around.collision_mask = TERRAIN_RAY_LAYER
            var neighbor := world.get_world_3d().direct_space_state.intersect_ray(around)
            if neighbor.is_empty() or neighbor.normal.y < 0.78:
                has_clearance = false
                break
            if neighbor.position.y < 1.8 or absf(neighbor.position.y - candidate.position.y) > 1.25:
                has_clearance = false
                break
        if has_clearance:
            hit = candidate
            spawn_xz = point
            break
    if hit.is_empty():
        push_error("TERRAIN V3 FAIL: no safe dry 5m-radius walkable spawn in clean island")
        return
    var player := world.get_node_or_null("Player3D") as CharacterBody3D
    if player == null:
        push_error("TERRAIN BASE FAIL: original controllable character missing")
        return
    # The capsule bottom is ~0.05 m below its origin: spawn a few
    # centimeters above the actual ground, NOT 2.1 m in mid-air.
    player.global_position = hit.position + Vector3(0.0, 0.13, 0.0)
    player.velocity = Vector3.ZERO
    world.set("terrain_spawn_position", player.global_position)
    village_spawn = player.global_position
    player.reset_camera_follow_interpolation()
    player.set_physics_process(true)
    player.reset_physics_interpolation()
    # Starting perspective must already be at the actual spawn location.
    # Otherwise the camera lerps across the whole map on the first few frames.
    world.call("_place_camera_immediately")
    # Imported FBX / original childhood GLB can contain Camera3D nodes.
    # Never assume the viewport kept our approved follow camera as current
    # after the full village is instantiated. Without an active world camera,
    # Godot draws only the clear sky while all CanvasLayer HUD controls work.
    var follow_camera: Camera3D = world.get("cam") as Camera3D
    if follow_camera == null:
        push_error("TERRAIN WEB CAMERA FAIL: approved 3/4 follow camera missing")
        return
    follow_camera.make_current()
    var current_camera: Camera3D = get_viewport().get_camera_3d()
    if current_camera != follow_camera:
        push_error("TERRAIN WEB CAMERA FAIL: viewport draws another imported camera")
        return
    var view_forward: Vector3 = -follow_camera.global_transform.basis.z.normalized()
    var target_direction: Vector3 = (player.global_position + Vector3.UP -
        follow_camera.global_position).normalized()
    if view_forward.dot(target_direction) < 0.75:
        push_error("TERRAIN WEB CAMERA FAIL: actual active camera looks away from the avatar")
        return
    print("TERRAIN WEB CAMERA PASS: viewport current=",current_camera.get_path(),
        " position=",current_camera.global_position,
        " target=",player.global_position,
        " direction dot=",snappedf(view_forward.dot(target_direction),0.001))
    is_ready = true
    # Signal browser only after terrain, houses, foliage, character and camera are ready.
    if OS.has_feature("web"):
        # V7.8: exported browser smoke can render the full world while the
        # standalone HTML loading panel stays visible. A DOM-ready poll alone
        # was insufficient in Chromium. Signal and dismiss together from the
        # authoritative Godot world-ready event, never on a blank canvas.
        JavaScriptBridge.eval(
            "window.__lembahTerrainReadyV78 = true;" +
            "var boot = document.getElementById('la-boot-v78');" +
            "if (boot) { boot.hidden = true; boot.style.display = 'none'; }")
    beach_button.disabled = false
    _refresh_text()
    var regular_meshes := world.find_children("*","MeshInstance3D",true,false).size()
    var gpu_batches := world.find_children("*","MultiMeshInstance3D",true,false).size()
    print("V7.8 WEB RENDER BUDGET: ",regular_meshes," MeshInstance3D + ",
        gpu_batches," MultiMeshInstance3D (total ",regular_meshes+gpu_batches,
        "), original tree visuals GPU-instanced; ground, buildings and bridges unchanged")
    print("TERRAIN V3 PLAYABLE PASS: clean mesh and matched coastline collision, painterly atlas, island river/ocean")
    print("TERRAIN BASE TEST PASS: V2 derived GLB terrain, collider_layer=%d, player_mask=%d, size=%s, spawn_xz=%s, spawn_height=%.3f" % [
        new_collision.collision_layer, player.collision_mask, str(_bounds_global(new_mesh).size), str(spawn_xz), hit.position.y])

func _refresh_text() -> void:
    if status != null:
        status.text = "LEMBAH ASRI V7.3 | VEGETASI DESA • P: PANTAI • H: DESA"

func _move_to_ground(where: Vector3, yaw: float) -> void:
    var actor := world.get_node_or_null("Player3D") as CharacterBody3D
    if actor == null:
        return
    actor.global_position = where
    actor.velocity = Vector3.ZERO
    actor.reset_camera_follow_interpolation()
    actor.reset_physics_interpolation()
    # The beach is SOUTH (+Z). Place the camera on the inland/north
    # side of the player so the sea is in the picture, not behind the viewer.
    world.set("camera_yaw", yaw)
    world.call("_place_camera_immediately")

func _visit_beach() -> void:
    if not is_ready:
        return
    # Real terrain/cove shape determines the target; never teleport the
    # player onto a guess, water, or an invisible fake coastal floor.
    for x_candidate in [72.0, 65.0, 78.0, 58.0, 84.0, 49.0]:
        for z_candidate in [78.0, 76.0, 74.0, 72.0, 69.0]:
            var x := float(x_candidate)
            var z := float(z_candidate)
            var land_query := PhysicsRayQueryParameters3D.create(
                Vector3(x, 120.0, z), Vector3(x, -40.0, z))
            land_query.collision_mask = TERRAIN_RAY_LAYER
            var bank := world.get_world_3d().direct_space_state.intersect_ray(land_query)
            if bank.is_empty() or float(bank.position.y) < 0.85 or float(bank.normal.y) < 0.82:
                continue
            var water_query := PhysicsRayQueryParameters3D.create(
                Vector3(x, 120.0, z + 14.0), Vector3(x, -40.0, z + 14.0))
            water_query.collision_mask = TERRAIN_RAY_LAYER
            var offshore := world.get_world_3d().direct_space_state.intersect_ray(water_query)
            if not offshore.is_empty():
                continue
            _move_to_ground(bank.position + Vector3(0.0, 0.13, 0.0), PI)
            village_button.visible = true
            beach_button.visible = false
            if status != null:
                status.text = "PANTAI SELATAN | Laut di depan kamera • H: kembali"
            print("TERRAIN V6.8 BEACH PREVIEW PASS: dry land=",bank.position,
                " offshore=("+str(x)+","+str(z+14.0)+")")
            return
    push_error("TERRAIN V6.8 BEACH FAIL: no dry accessible south-coast view")

func _return_to_village() -> void:
    if not is_ready:
        return
    _move_to_ground(village_spawn, 0.0)
    village_button.visible = false
    beach_button.visible = true
    _refresh_text()

func _unhandled_input(event: InputEvent) -> void:
    if not is_ready or not (event is InputEventKey):
        return
    if not event.pressed or event.echo:
        return
    if event.keycode == KEY_P or event.physical_keycode == KEY_P:
        _visit_beach()
        return
    if event.keycode == KEY_H or event.physical_keycode == KEY_H:
        _return_to_village()
        return
    if event.keycode == KEY_EQUAL or event.keycode == KEY_KP_ADD:
        vertical_offset += 0.5
        new_root.position.y += 0.5
        _refresh_text()
    elif event.keycode == KEY_MINUS or event.keycode == KEY_KP_SUBTRACT:
        vertical_offset -= 0.5
        new_root.position.y -= 0.5
        _refresh_text()
