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
    print("AREA V8 REAL STREAM PASS: five independently cloned area visual scenes, unloaded 3D visuals,",
        " isolated region picker, original Meshy UV, physics, coastal automatic reload")
    quit(0)
