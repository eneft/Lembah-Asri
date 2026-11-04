extends "res://scripts/terrain_v79_area_streamer.gd"
## Lembah Asri V8.0 - independently instanced visual scenes.
##
## V7.9 hid far nodes but left ALL 3D nodes instantiated.
## V8 keeps authored scene node templates OFF TREE and instantiates cloned
## visuals only for active regions. Live clones are freed on unload.
## Avoid runtime PackedScene.pack(), which leaks GLES resources in Godot 4.3.
## Permanent physics stubs preserve exact static building/trunk collisions,
## player, terrain, river and bridges, including at region boundaries.
##
## Note: original off-tree templates retain mesh/texture data for reuse.
## The number of active GPU draw instances falls, but full GPU texture eviction
## needs external per-region asset bundles (future).
const PRELOAD_M := 47.0
const UNLOAD_M := 65.0
const STREAM_INTERVAL := 0.28

var loaded_area_count := 0
var loaded_house_visual_count := 0
var debug_area := ""
var _debug_all := false
var _house_templates: Dictionary = {}
var _foliage_templates: Dictionary = {}
var _loaded: Dictionary = {}
var _clock := 0.0
var _transition_count := 0

func _capture_house_visuals(house: Node3D) -> bool:
    var holder := Node3D.new()
    holder.name = "V80Visuals"
    house.add_child(holder)
    # The collider remains a direct child of the permanent house stub.
    for child in house.get_children():
        if child == holder or child.name == "BuildingCollision":
            continue
        if child is CollisionObject3D:
            continue
        child.reparent(holder,true)
    # Remove the SOURCE from the SceneTree so it has no active render or
    # physics instance. Node.duplicate() clones it only for loaded regions.
    # The off-tree source is explicitly free()d on exit to avoid GLES leaks.
    house.remove_child(holder)
    _house_templates[str(house.name)] = holder
    return true

func _capture_foliage_visuals(area_id: String, foliage: Node3D) -> bool:
    var holder := Node3D.new()
    holder.name = "V80Foliage"
    foliage.add_child(holder)
    for child in foliage.get_children():
        if child != holder:
            child.reparent(holder,true)
    foliage.remove_child(holder)
    _foliage_templates[area_id] = holder
    return true

func configure(world: Node3D, settlement: Node3D, vegetation: Node3D) -> void:
    super.configure(world,settlement,vegetation)
    if not finished:
        return
    for area_id in AREAS:
        var region := _zones[area_id] as Node3D
        var houses := region.get_node("Houses") as Node3D
        for child in houses.get_children():
            if not _capture_house_visuals(child as Node3D):
                finished = false
                return
        if not _capture_foliage_visuals(area_id,region.get_node("Foliage") as Node3D):
            finished = false
            return
        region.visible = false
    if _house_templates.size() != 17 or _foliage_templates.size() != 5:
        push_error("AREA V8 FAIL: expected 17 detached house visual templates and five foliage scenes")
        finished = false
        return
    _loaded.clear()
    loaded_area_count = 0
    loaded_house_visual_count = 0
    set_meta("v8_real_scene_instancing",true)
    print("AREA V8 TEMPLATE PASS: 17 detached visual templates + five ",
        "regional GPU foliage templates; physics stays in the world")

func _load_area(area_id: String) -> void:
    if _loaded.has(area_id):
        return
    var region := _zones[area_id] as Node3D
    var houses := region.get_node("Houses") as Node3D
    var foliage := region.get_node("Foliage") as Node3D
    var house_count := 0
    for house in houses.get_children():
        var template := _house_templates.get(str(house.name)) as Node3D
        if template == null:
            push_error("AREA V8 FAIL: absent house template "+str(house.name))
            return
        var visuals := template.duplicate() as Node3D
        if visuals == null:
            push_error("AREA V8 FAIL: house instantiation failed "+str(house.name))
            return
        house.add_child(visuals)
        house_count += 1
    var foliage_scene := _foliage_templates.get(area_id) as Node3D
    if foliage_scene == null:
        push_error("AREA V8 FAIL: missing foliage scene "+area_id)
        return
    var foliage_node := foliage_scene.duplicate() as Node3D
    foliage.add_child(foliage_node)
    region.visible = true
    _loaded[area_id] = true
    loaded_house_visual_count += house_count
    _transition_count += 1

func _unload_area(area_id: String) -> void:
    if not _loaded.has(area_id):
        return
    var region := _zones[area_id] as Node3D
    region.visible = false
    var houses := region.get_node("Houses") as Node3D
    for house in houses.get_children():
        var visuals := house.get_node_or_null("V80Visuals") as Node3D
        if visuals != null:
            visuals.free()
            loaded_house_visual_count -= 1
    var foliage := region.get_node("Foliage") as Node3D
    var foliage_node := foliage.get_node_or_null("V80Foliage") as Node3D
    if foliage_node != null:
        foliage_node.free()
    _loaded.erase(area_id)
    _transition_count += 1

func refresh_visibility(point: Vector3, force := false) -> void:
    if not finished:
        return
    var zoom_extra := 0.0
    if is_instance_valid(_camera):
        zoom_extra = clampf((_camera.size-16.0)*0.72,0.0,40.0)
    var threshold_in := PRELOAD_M+zoom_extra
    var threshold_out := UNLOAD_M+zoom_extra
    var near := _nearest_area(point)
    # The nearest region always remains loaded, including when the player
    # is between two disjoint zone rectangles.
    for area_id in AREAS:
        var was_loaded := _loaded.has(area_id)
        var should_load := false
        if _debug_all:
            should_load = true
        elif not debug_area.is_empty():
            should_load = (area_id == debug_area)
        else:
            var distance := _rect_distance(point,_bounds[area_id])
            should_load = (area_id == near or
                distance <= (threshold_out if was_loaded and not force else threshold_in))
        if should_load and not was_loaded:
            _load_area(area_id)
        elif not should_load and was_loaded:
            _unload_area(area_id)
        # Keep the area node visible exactly when its live visuals exist.
        var region := _zones[area_id] as Node3D
        region.visible = _loaded.has(area_id)
    loaded_area_count = _loaded.size()
    active_area_count = loaded_area_count
    set_meta("loaded_area_count",loaded_area_count)
    set_meta("loaded_house_visual_count",loaded_house_visual_count)
    set_meta("area_transition_count",_transition_count)

func set_debug_area(area_id: String) -> bool:
    if not area_id.is_empty() and not AREAS.has(area_id):
        return false
    debug_area = area_id
    _debug_all = false
    if finished and is_instance_valid(_player):
        refresh_visibility(_player.global_position,true)
    return true

func debug_show_all(enabled: bool) -> void:
    _debug_all = enabled
    if enabled:
        debug_area = ""
    if finished and is_instance_valid(_player):
        refresh_visibility(_player.global_position,true)

func get_loaded_area_ids() -> Array:
    var result: Array = []
    for area_id in AREAS:
        if _loaded.has(area_id):
            result.append(area_id)
    return result

func get_area_rect(area_id: String) -> Rect2:
    return _bounds.get(area_id,Rect2())

func _exit_tree() -> void:
    # Off-tree scene source nodes are plain Objects, not RefCounted. They must
    # be explicitly freed BEFORE Godot tears down its GPU resource server.
    for source in _house_templates.values():
        var source_node := source as Node3D
        if is_instance_valid(source_node):
            source_node.free()
    for source in _foliage_templates.values():
        var source_node := source as Node3D
        if is_instance_valid(source_node):
            source_node.free()
    _house_templates.clear()
    _foliage_templates.clear()
    _plants_by_type.clear()
    _loaded.clear()

func _process(delta: float) -> void:
    if not finished or not is_instance_valid(_player):
        return
    if _debug_all or not debug_area.is_empty():
        return
    _clock += delta
    if _clock < STREAM_INTERVAL:
        return
    _clock = 0.0
    refresh_visibility(_player.global_position + _player.velocity*0.55)
