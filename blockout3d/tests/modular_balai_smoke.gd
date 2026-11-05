extends SceneTree
## Independent release gate: modular prototype must never change main 3D world.
func _initialize() -> void:
    call_deferred("_run")

func _fail(detail: String) -> void:
    push_error("BALAI MODULAR V0.1 FAIL: "+detail)
    quit(1)

func _run() -> void:
    var packed := load("res://scenes/modular_balai_preview.tscn") as PackedScene
    if packed == null:
        _fail("scene does not load")
        return
    var level := packed.instantiate() as Node3D
    root.add_child(level)
    await process_frame
    var kit := level.get_node_or_null("BalaiDesaModular") as Node3D
    if kit == null or str(kit.get_meta("kit_version","")) != "balai_modular_v0_1":
        _fail("modular builder did not initialize")
        return
    if kit.get_meta("footprint_m",Vector2.ZERO) != Vector2(9.2,7.5):
        _fail("modular footprint is not the agreed 9.2 x 7.5 metres")
        return
    if absf(float(kit.get_meta("height_m",0.0))-5.28)>0.01:
        _fail("roof ridge height does not match agreed public hall scale")
        return
    var front := kit.get_node_or_null("DindingDepan") as Node3D
    var back := kit.get_node_or_null("DindingBelakang") as Node3D
    var left := kit.get_node_or_null("DindingKiri") as Node3D
    var right := kit.get_node_or_null("DindingKanan") as Node3D
    if front == null or back == null or left == null or right == null:
        _fail("one of four physically partitioned walls is missing")
        return
    var wall_count := 0
    for group in [front,back,left,right]:
        wall_count += group.get_child_count()
        if group.get_child_count()<6:
            _fail("modular wall segments were not generated")
            return
    var window_count := 0
    for part in kit.get_children():
        if str(part.name).begins_with("Jendela"):
            window_count += 1
            if not part.has_meta("opening_m") or part.get_node_or_null("Kaca")==null:
                _fail("a window lacks template measurements or actual glass panel")
                return
    if window_count != 6:
        _fail("six reusable window modules expected, got "+str(window_count))
        return
    var door := kit.get_node_or_null("PintuDepan") as Node3D
    if door == null or door.get_node_or_null("DaunPintu")==null:
        _fail("front door is not a separate reusable module")
        return
    var roof := kit.get_node_or_null("AtapGenteng") as Node3D
    if roof==null or roof.get_node_or_null("GentengKiri")==null or (
        roof.get_node_or_null("GentengKanan")==null):
        _fail("two actual 3D UV-textured plane roof slopes missing")
        return
    var roof_faces := 0
    for piece in roof.get_children():
        if piece is MeshInstance3D:
            var mesh := (piece as MeshInstance3D).mesh
            if mesh != null:
                for n in range(mesh.get_surface_count()):
                    roof_faces += mesh.surface_get_arrays(n)[Mesh.ARRAY_VERTEX].size()/3
    if roof_faces > 100:
        _fail("the texture-based roof uses too many triangles")
        return
    if kit.get_node_or_null("PapanNamaTanah/Tulisan") == null:
        _fail("ground-mounted village-office sign missing")
        return
    var material_map: Dictionary = kit.get("_materials")
    for key in ["plaster","stone","wood","roof","glass","white","black"]:
        var material := material_map.get(key) as StandardMaterial3D
        if material==null or material.albedo_texture==null:
            _fail("painted texture slot missing: "+key)
            return
        if material.albedo_texture.get_width()!=256:
            _fail("modular material tile is not 256 px: "+key)
            return
    # The open doorway is really empty: no front wall section overlaps it.
    for slab in front.get_children():
        var panel := slab as MeshInstance3D
        if panel==null:
            continue
        var dimensions: Vector3 = panel.get_meta("dimensions_m",Vector3.ZERO)
        var left_x := panel.position.x-dimensions.x*0.5
        var right_x := panel.position.x+dimensions.x*0.5
        var bottom_y := panel.position.y-dimensions.y*0.5
        var top_y := panel.position.y+dimensions.y*0.5
        var overlaps_door := right_x > -0.70 and left_x < 0.70 and (
            top_y > 0.27 and bottom_y < 2.53)
        if overlaps_door:
            _fail("front wall blocks the door's real opening")
            return
    if not kit.find_children("*","CollisionObject3D",true,false).is_empty():
        _fail("prototype unexpectedly introduces persistent building physics")
        return
    var camera := level.get_node_or_null("ModularPreviewCamera") as Camera3D
    if camera == null or not camera.current:
        _fail("standalone rotating preview is missing its live camera")
        return
    print("BALAI MODULAR V0.1 PASS: 9.20x7.50m, ridge 5.28m, "+
        str(wall_count)+" real wall segments, six windows, one door, "+
        str(roof_faces)+" roof triangles, seven 256px painterly material tiles, zero physics changes")
    quit(0)
