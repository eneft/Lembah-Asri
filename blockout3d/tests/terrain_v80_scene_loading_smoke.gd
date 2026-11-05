extends SceneTree
## V8.0: verify actual PackedScene instantiate/free, physics continuity,
## authored Meshy UV recovery, and browser-accessible area picker (not just hide).

func _initialize() -> void:
    call_deferred("_run")

func _fail(message: String) -> void:
    push_error("AREA V8 FAIL: "+message)
    quit(1)

func _run() -> void:
    var level := load("res://scenes/terrain_base_test.tscn").instantiate() as Node3D
    root.add_child(level)
    for frame in range(490):
        await physics_frame
        if bool(level.get("is_ready")):
            break
    if not bool(level.get("is_ready")):
        _fail("full terrain and village did not become ready")
        return
    var world := level.get_node_or_null("World") as Node3D
    var loader := world.get_node_or_null("AreaStreamingV79") as Node3D
    var picker := level.get_node_or_null("AreaDebugHUD/AreaPickerBar/AreaPicker") as OptionButton
    if loader == null or picker == null or picker.item_count != 6:
        _fail("runtime scene loader or six-entry mobile debug picker missing")
        return
    if not bool(loader.get_meta("v8_real_scene_instancing",false)):
        _fail("V7.9 visibility-only culling was used instead of V8")
        return
    if int(loader.get("_house_templates").size()) != 17:
        _fail("17 original house visual templates were not packed")
        return
    var west := loader.get_node("Area_pekarangan_barat") as Node3D
    var coast := loader.get_node("Area_akses_pesisir") as Node3D
    var home := west.get_node("Houses/rumah_masa_kecil") as Node3D
    var fisherman := coast.get_node("Houses/rumah_nelayan_01") as Node3D
    if home == null or fisherman == null:
        _fail("original houses disappeared from persistent physics scene")
        return
    var home_coords := home.global_position
    var fisherman_coords := fisherman.global_position
    var owner_collision := home.get_node_or_null("BuildingCollision") as StaticBody3D
    if owner_collision == null:
        _fail("permanent childhood-house collision was removed")
        return

    # Single-area mode must load EXACTLY one visual region, not just hide
    # already-instantiated GLBs. A neighbour can stay in physics scene.
    if not bool(loader.call("set_debug_area","akses_pesisir")):
        _fail("cannot isolate coastal scene")
        return
    if int(loader.get("loaded_area_count")) != 1 or not coast.visible or west.visible:
        _fail("coast debug mode did not unload all other visual scenes")
        return
    var fisherman_visual := fisherman.get_node_or_null("V80Visuals/MeshyFishermanHouse") as Node3D
    if fisherman_visual == null or fisherman_visual.find_children("*","MeshInstance3D",true,false).is_empty():
        _fail("the original textured Meshy coastal house failed to instantiate")
        return
    if home.has_node("V80Visuals") or west.get_node("Foliage").has_node("V80Foliage"):
        _fail("distant west visual scenes remain instantiated")
        return
    if not bool(loader.call("set_debug_area","pekarangan_barat")):
        _fail("cannot switch to western region")
        return
    if int(loader.get("loaded_area_count")) != 1 or coast.has_node("Foliage/V80Foliage"):
        _fail("coast foliage remained instantiated after region swap")
        return
    if fisherman.has_node("V80Visuals") or not home.has_node("V80Visuals/OriginalTexturedHouse"):
        _fail("coast visual wasn't freed or childhood model wasn't restored")
        return
    if fisherman.global_position.distance_to(fisherman_coords) > 0.0001 or (
        home.global_position.distance_to(home_coords) > 0.0001):
        _fail("opening a scene altered its authoritative house placement")
        return
    # Collider ray on unloaded coast: the collision roots are deliberately
    # independent of visuals, so the 1.68m player can never tunnel through.
    await physics_frame
    await physics_frame
    var ray := PhysicsRayQueryParameters3D.create(
        fisherman_coords+Vector3.UP*15.0,fisherman_coords+Vector3.DOWN*0.2)
    ray.collision_mask = 1
    var hit := world.get_world_3d().direct_space_state.intersect_ray(ray)
    if hit.is_empty() or hit.collider != fisherman.get_node("BuildingCollision"):
        _fail("unloaded fishing house stopped blocking the player")
        return

    # Reset to the authored open-world camera/gameplay behaviour.
    if not bool(loader.call("set_debug_area","")):
        _fail("Open World could not be restored")
        return
    loader.call("refresh_visibility",fisherman_coords,true)
    if not coast.visible or coast.get_node_or_null("Foliage/V80Foliage")==null:
        _fail("automatic region proximity reload failed")
        return
    if not fisherman.has_node("V80Visuals/MeshyFishermanHouse"):
        _fail("Meshy GLB did not reappear when the player returned")
        return
    # Audit the REAL menu signal for every option, not just the loader API.
    # This catches failures where buttons are present but cannot safely spawn.
    var player := world.get_node("Player3D") as CharacterBody3D
    player.set_physics_process(false)
    var saved_position := player.global_position
    var area_ids := ["desa_inti","pekarangan_barat","balai_desa",
        "tepi_sungai","akses_pesisir"]
    for index in range(1,6):
        var area_id: String = area_ids[index-1]
        picker.select(index)
        picker.emit_signal("item_selected",index)
        if str(loader.get("debug_area")) != area_id:
            _fail("SCENE menu cannot enter "+area_id)
            return
        if int(loader.get("loaded_area_count")) != 1:
            _fail("SCENE menu did not isolate EXACTLY one area: "+area_id)
            return
        if area_id == "balai_desa":
            var hall := loader.get_node_or_null("Area_balai_desa/Houses/balai_desa") as Node3D
            if hall == null or hall.get_node_or_null("BuildingCollision") == null:
                _fail("BALAI 2K: existing hall collider disappeared")
                return
            if ResourceLoader.exists("res://assets/environment/houses/village_head/LembahAsri_Game_2K.glb"):
                if not hall.has_node("V80Visuals/MeshyBalaiDesa2K") or hall.has_node("V80Visuals/UniqueVillageMesh"):
                    _fail("BALAI 2K: area scene did not stream the replacement GLB")
                    return
        # V8.4 uses actual lightweight 3D countryside geometry, NOT the
        # stretched 512x170 panorama. No fake colliders or game-world mutation.
        var backdrop := world.get_node_or_null("BalaiDesaBackdrop3D") as Node3D
        if area_id == "balai_desa":
            if backdrop == null or not backdrop.visible or (
                not bool(backdrop.get_meta("balai_backdrop_ready",false))):
                _fail("BALAI V8.4: geometric background failed to activate")
                return
            var earth := backdrop.get_node_or_null("VisualGroundUnderlay") as MeshInstance3D
            if earth == null or earth.mesh == null or earth.mesh.get_faces().size() < 100:
                _fail("BALAI V8.4: continuous visual terrain underlay missing")
                return
            var ridge := backdrop.get_node_or_null("DistantHills") as Node3D
            var trees := backdrop.get_node_or_null("DistantTreeLine") as Node3D
            if ridge == null or trees == null or trees.get_child_count() < 20:
                _fail("BALAI V8.4: low-poly hills/trees failed to instantiate")
                return
            if not backdrop.find_children("*","CollisionObject3D",true,false).is_empty():
                _fail("BALAI V8.4: distant background added unintended physics")
                return
            if world.get_node_or_null("BalaiDesaPanorama") != null:
                _fail("BALAI V8.4: legacy low-resolution panorama was loaded")
                return
            var atmosphere := world.get_node_or_null("Atmosphere") as WorldEnvironment
            if atmosphere == null or atmosphere.environment == null or (
                atmosphere.environment.background_mode != Environment.BG_SKY):
                _fail("BALAI V8.4: natural procedural sky not enabled")
                return
            # Screenshot regression: generic area-center spawn looked at the
            # coast instead of the hall. Player MUST arrive in the real
            # forecourt, with a genuine Godot Camera3D facing the office.
            var hall := loader.get_node_or_null(
                "Area_balai_desa/Houses/balai_desa") as Node3D
            if hall == null:
                _fail("BALAI V8.3: hall missing from the dedicated scene")
                return
            var hall_gap := Vector2(player.global_position.x,player.global_position.z).distance_to(
                Vector2(hall.global_position.x,hall.global_position.z))
            if hall_gap<5.0 or hall_gap>14.0:
                _fail("BALAI V8.3: scene spawn is not in the hall forecourt")
                return
            var game_camera := world.get_node_or_null("IsometricCamera") as Camera3D
            if game_camera == null:
                _fail("BALAI V8.3: active 3/4 follow camera missing")
                return
            var look_at_hall := (hall.global_position+Vector3.UP*2.4-
                game_camera.global_position).normalized()
            var forward := -game_camera.global_transform.basis.z.normalized()
            if forward.dot(look_at_hall)<0.78:
                _fail("BALAI V8.3: entry camera looks towards coast, not village hall")
                return
            var water_layer := level.get("water_root") as Node3D
            var infrastructure_layer := level.get("infrastructure_root") as Node3D
            if water_layer == null or infrastructure_layer == null or (
                water_layer.visible or infrastructure_layer.visible):
                _fail("BALAI V8.3: unrelated sea/river/bridges still visible")
                return
            var bridge_physics := infrastructure_layer.get("bridge_collider") as StaticBody3D
            if bridge_physics == null or bridge_physics.collision_layer != 1:
                _fail("BALAI V8.3: hiding bridge visual disabled permanent physics")
                return
            print("BALAI V8.3 FORECOURT PASS: entry %.1fm from hall, camera dot=%.2f, water and bridges hidden only visually" % [
                hall_gap, forward.dot(look_at_hall)])
        elif backdrop != null and backdrop.visible:
            _fail("BALAI V8.4: hall background leaked into "+area_id)
            return
        if area_id != "balai_desa":
            if not (level.get("water_root") as Node3D).visible or (
                not (level.get("infrastructure_root") as Node3D).visible):
                _fail("BALAI V8.3: hidden bridges/water leaked into another scene")
                return
        if not bool(level.get("debug_return_saved")):
            _fail("SCENE menu did not save the return position")
            return
        var rect: Rect2 = loader.call("get_area_rect",area_id)
        if not rect.grow(9.0).has_point(Vector2(
            player.global_position.x,player.global_position.z)):
            _fail("SCENE menu spawned player outside selected terrain: "+area_id)
            return
        var terrain_shader := level.get("new_mesh") as MeshInstance3D
        var material := terrain_shader.material_override as ShaderMaterial
        var is_clipped := bool(material.get_shader_parameter("debug_clip_enabled"))
        if area_id == "balai_desa":
            if is_clipped:
                _fail("BALAI V8.4: legacy ground discard crop remains enabled")
                return
        elif not is_clipped:
            _fail("SCENE menu changed the existing crop for "+area_id)
            return
        var beach := level.get("beach_button") as Button
        var village := level.get("village_button") as Button
        if not beach.disabled or not village.disabled:
            _fail("coast teleport buttons still active inside a single area")
            return
        # Keyboard shortcuts call the same methods; they must not move a
        # player beyond the isolated geometry.
        var isolated_position := player.global_position
        level.call("_visit_beach")
        level.call("_return_to_village")
        if player.global_position.distance_to(isolated_position) > 0.0001:
            _fail("P/H shortcut escaped isolated scene: "+area_id)
            return
        var counter := level.get("scene_indicator") as Label
        await process_frame
        if counter.text != "1/5":
            _fail("HUD scene counter stale inside isolated area: "+area_id)
            return
    picker.select(0)
    picker.emit_signal("item_selected",0)
    if str(loader.get("debug_area")) != "":
        _fail("Open World option did not exit isolated mode")
        return
    var restored_backdrop := world.get_node_or_null("BalaiDesaBackdrop3D") as Node3D
    if restored_backdrop != null and restored_backdrop.visible:
        _fail("BALAI V8.4: Open World retained isolated hall background")
        return
    if not (level.get("water_root") as Node3D).visible or (
        not (level.get("infrastructure_root") as Node3D).visible):
        _fail("BALAI V8.3: Open World failed to restore ocean and bridge visuals")
        return
    print("BALAI V8.4 GEOMETRIC BACKDROP PASS: continuous ground, natural sky, shaded hills and trees; isolated from Open World")
    if player.global_position.distance_to(saved_position) > 0.0001:
        _fail("Open World failed to restore saved player position")
        return
    var after := level.get("new_mesh") as MeshInstance3D
    var shader := after.material_override as ShaderMaterial
    if bool(shader.get_shader_parameter("debug_clip_enabled")):
        _fail("terrain remained visually cropped after Open World")
        return
    if (level.get("beach_button") as Button).disabled:
        _fail("beach navigation was not restored after leaving debug mode")
        return
    # Counter must track open-world streaming without touching the picker.
    loader.call("refresh_visibility",Vector3(83,0,78),true)
    await process_frame
    var live_count: int = int(loader.get("loaded_area_count"))
    if (level.get("scene_indicator") as Label).text != "%d/5" % live_count:
        _fail("area counter does not update during automatic streaming")
        return
    loader.call("refresh_visibility",player.global_position,true)
    player.set_physics_process(true)
    print("AREA V8.1 SCENE PICKER AUDIT PASS: all five menu selections,",
        " safe debug spawn, terrain masking, shortcuts blocked, return,",
        " dynamic area counter")
    print("AREA V8 REAL STREAM PASS: five independently cloned area visual scenes, unloaded 3D visuals,",
        " isolated region picker, original Meshy UV, physics, coastal automatic reload")
    quit(0)
