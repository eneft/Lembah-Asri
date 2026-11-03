extends SceneTree
## V6: validate REAL CharacterBody3D movement across both V5 bridges.
## This deliberately moves the original capsule with move_and_slide, rather
## than relying on a raycast through the decorative bridge visual.
func _initialize() -> void:
    call_deferred("_run")

func _fail(reason: String) -> void:
    push_error("TERRAIN V6 TRAVERSAL FAIL: " + reason)
    quit(1)

func _run() -> void:
    var scene := load("res://scenes/terrain_base_test.tscn") as PackedScene
    if scene == null:
        _fail("terrain test scene unavailable")
        return
    var level := scene.instantiate() as Node3D
    root.add_child(level)
    var ready := false
    for frame in range(420):
        await physics_frame
        if bool(level.get("is_ready")):
            ready = true
            break
    if not ready:
        _fail("terrain not ready")
        return
    var world := level.get_node_or_null("World") as Node3D
    if world == null:
        _fail("world missing")
        return
    var infra := world.get_node_or_null("TerrainV3Infrastructure")
    var player := world.get_node_or_null("Player3D") as CharacterBody3D
    if infra == null or player == null:
        _fail("bridge or original player missing")
        return
    var deck_north := infra.get("bridge_collider") as StaticBody3D
    var deck_south := infra.get("secondary_bridge_collider") as StaticBody3D
    if deck_north == null or deck_south == null or deck_north == deck_south:
        _fail("two independent physical bridge colliders required")
        return

    # Keep the player's actual capsule, collision mask, and move_and_slide.
    # Disable just its input driver so camera controls cannot affect this test.
    player.set_physics_process(false)
    var bridges := [
        {"label":"north-west-to-east", "body":deck_north,
         "cx":float(infra.get("bridge_center_x")),
         "z":float(infra.get("bridge_z")),
         "span":float(infra.get("bridge_half_span")), "direction":1.0},
        {"label":"south-east-to-west", "body":deck_south,
         "cx":float(infra.get("secondary_bridge_center_x")),
         "z":float(infra.get("secondary_bridge_z")),
         "span":float(infra.get("secondary_bridge_half_span")), "direction":-1.0}
    ]
    # Four journeys: test entry and exit at BOTH ends of EACH bridge.
    var reverse_crossings: Array = []
    for crossing in bridges:
        var reverse: Dictionary = crossing.duplicate()
        reverse["direction"] = -float(crossing["direction"])
        reverse["label"] = str(crossing["label"]) + "-reverse"
        reverse_crossings.append(reverse)
    bridges.append_array(reverse_crossings)
    # Ray-test each rendered segment midpoint against its solid physics top.
    for pair in [
        [infra.get("bridge_mesh"),deck_north],
        [infra.get("secondary_bridge_mesh"),deck_south]
    ]:
        var visual := pair[0] as MeshInstance3D
        var body := pair[1] as StaticBody3D
        if visual == null or body.get_child_count() != 32:
            _fail("missing segmented visual/collision deck")
            return
        var arrays := visual.mesh.surface_get_arrays(0)
        var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
        for segment in range(32):
            var expected := (vertices[segment*6]+vertices[segment*6+2])*0.5
            expected.z = (vertices[segment*6].z+vertices[segment*6+1].z)*0.5
            expected = visual.to_global(expected)
            var query := PhysicsRayQueryParameters3D.create(
                expected+Vector3.UP,expected-Vector3.UP)
            query.collision_mask = player.collision_mask
            query.exclude = [player.get_rid()]
            var contact := world.get_world_3d().direct_space_state.intersect_ray(query)
            if contact.is_empty() or contact.collider != body or absf(contact.position.y-expected.y) > 0.015:
                _fail("visual/collision mismatch at deck segment " + str(segment))
                return
    print("TERRAIN V6 DECK MATCH PASS: 64 segment midpoints within 1.5cm of visual surface")
    var crossings_ok := 0
    for bridge in bridges:
        var label: String = str(bridge["label"])
        var cx: float = float(bridge["cx"])
        var z: float = float(bridge["z"])
        var half_span: float = float(bridge["span"])
        var direction: float = float(bridge["direction"])
        var body := bridge["body"] as StaticBody3D
        if half_span < 6.0:
            _fail(label + " does not have a valid deck span")
            return
        # Position the character slightly OUTSIDE the wooden ramp, on real
        # river-bank terrain. Do not spawn in midair on the bridge.
        var start_x := cx - direction * (half_span + 0.22)
        var finish_x := cx + direction * (half_span + 0.22)
        var ground_probe := PhysicsRayQueryParameters3D.create(
            Vector3(start_x,120.0,z), Vector3(start_x,-40.0,z))
        ground_probe.collision_mask = 1 << 7
        var bank := world.get_world_3d().direct_space_state.intersect_ray(ground_probe)
        if bank.is_empty() or float(bank.normal.y) < 0.70:
            _fail(label + " start bank is not safely walkable")
            return
        player.global_position = Vector3(start_x,float(bank.position.y)+0.14,z)
        player.velocity = Vector3.ZERO
        player.reset_camera_follow_interpolation()
        var grounded := 0
        var deck_samples := 0
        var falling := 0
        var reached := false
        for step in range(510):
            # Steady 2.8m/s world-space approach, using the real player body.
            # Downward velocity plus Godot floor snapping holds the board ramps.
            player.velocity = Vector3(direction * 2.8, -1.3, 0.0)
            player.move_and_slide()
            await physics_frame
            if player.global_position.y < -1.0:
                _fail(label + " fell through collision")
                return
            if player.is_on_floor():
                grounded += 1
                falling = 0
            else:
                falling += 1
                if falling > 14:
                    _fail(label + " lost ground contact")
                    return
            var probe := PhysicsRayQueryParameters3D.create(
                player.global_position + Vector3.UP*1.5,
                player.global_position - Vector3.UP*1.2)
            probe.collision_mask = player.collision_mask
            # A ray emitted through the player must exclude its own capsule;
            # otherwise the query can hit the player instead of the deck.
            probe.exclude = [player.get_rid()]
            var floor_hit := world.get_world_3d().direct_space_state.intersect_ray(probe)
            if not floor_hit.is_empty() and floor_hit.collider == body:
                deck_samples += 1
            if direction * (player.global_position.x - finish_x) >= -0.10:
                reached = true
                break
        if not reached:
            _fail(label + " capsule did not reach the opposite shore")
            return
        if grounded < 120 or deck_samples < 45:
            _fail(label + " did not traverse a sustained solid bridge floor")
            return
        crossings_ok += 1
        print("TERRAIN V6 CAPSULE CROSSING PASS: ",label,
              " grounded_ticks=",grounded," deck_ticks=",deck_samples)

    if crossings_ok != 4:
        _fail("not all bridges crossed")
        return
    print("TERRAIN V6 TRAVERSAL PASS: both bridges physically crossed IN BOTH DIRECTIONS by original 55% player capsule")

    # V6.4: test the actual player against both handrail guards from BOTH
    # sides, not merely the deck floor under the middle of the bridge.
    for bridge in bridges.slice(0,2):
        var cx: float = float(bridge["cx"])
        var z: float = float(bridge["z"])
        var deck_y: float = float(infra.get("deck_center_y")) if z < 0.0 else float(infra.get("secondary_deck_y"))
        var rails_name := "BridgeRailGuardCollision" if z < 0.0 else "SouthernBridgeRailGuardCollision"
        var rail_body := infra.get_node_or_null(rails_name) as StaticBody3D
        if rail_body == null or rail_body.get_child_count() != 2:
            _fail("missing both physical side guards: " + rails_name)
            return
        for side in [-1.0,1.0]:
            player.global_position = Vector3(cx,deck_y+0.22,z)
            player.velocity = Vector3.ZERO
            for step in range(38):
                player.velocity = Vector3(0.0,-1.3,side*2.8)
                player.move_and_slide()
                await physics_frame
            if absf(player.global_position.z-z) > 1.42:
                _fail("player escaped bridge handrail: " + rails_name)
                return
    print("TERRAIN V6.4 SIDE GUARD PASS: both bridges prevent sideways player falls from either side")
    quit(0)
