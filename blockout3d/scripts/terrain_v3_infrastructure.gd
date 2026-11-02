extends Node3D
## Terrain V3 bridge and village trail details, deliberately isolated from
## visual terrain mesh and the character/camera code. Terrain raycast layer
## is 128, player collision layer is 1.
const TERRAIN_RAY_LAYER := 1 << 7
const BRIDGE_Z := -9.0
const BRIDGE_HALF_WIDTH := 1.36
const DECK_SEGMENTS := 32
const PLANK_THICKNESS := 0.18

var bridge_mesh: MeshInstance3D
var bridge_collider: StaticBody3D
var bridge_center_x := 0.0
var bridge_z := BRIDGE_Z
var bridge_half_span := 6.0
var deck_center_y := 0.0
var trail_detail_count := 0
var secondary_bridge_collider: StaticBody3D
var secondary_bridge_center_x := 0.0
var secondary_bridge_z := 0.0
var secondary_deck_y := 0.0
var secondary_bridge_half_span := 0.0

func configure() -> void:
    name = "TerrainV3Infrastructure"
    _make_main_bridge()
    _make_secondary_bridge()
    _make_trail_edges()

func _river_x(z: float) -> float:
    # Must match terrain_v2_topography.river_center_x in physical metres.
    # Older bridge locations (z=-9 and z=47) are exactly preserved.
    var original := -9.0 * sin((z + 99.0) * 0.0261) + 2.7 * sin((z + 61.0) * 0.0722)
    var t := clampf((z + 90.0) / 48.0, 0.0, 1.0)
    var eased := t * t * (3.0 - 2.0 * t)
    return original + 56.0 * (1.0 - eased)

func _terrain_at(x: float,z: float) -> Dictionary:
    var q := PhysicsRayQueryParameters3D.create(
        Vector3(x,120.0,z),Vector3(x,-40.0,z))
    q.collision_mask = TERRAIN_RAY_LAYER
    return get_world_3d().direct_space_state.intersect_ray(q)

func _deck_height(t: float,left_height: float,right_height: float,raised: float) -> float:
    # Two tapered approaches join the existing land smoothly without a
    # vertical step that would trap a 55%-scale player capsule.
    if t < 0.20:
        var u := smoothstep(0.0,0.20,t)
        return lerpf(left_height,raised,u)
    if t > 0.80:
        var u := smoothstep(0.80,1.0,t)
        return lerpf(raised,right_height,u)
    return raised

func _add_triangle(tool: SurfaceTool,a: Vector3,b: Vector3,c: Vector3,col: Color) -> void:
    tool.set_normal(Vector3.UP)
    tool.set_color(col)
    tool.add_vertex(a)
    tool.set_normal(Vector3.UP)
    tool.set_color(col)
    tool.add_vertex(b)
    tool.set_normal(Vector3.UP)
    tool.set_color(col)
    tool.add_vertex(c)

func _make_solid_planks(x0: float,x1: float,left_y: float,right_y: float) -> void:
    # One drawcall: solid six-faced BoxMesh planks, not transparent flat polygons.
    var wood := BoxMesh.new()
    wood.size = Vector3(1.0,PLANK_THICKNESS,BRIDGE_HALF_WIDTH*2.0)
    var mat := StandardMaterial3D.new()
    mat.vertex_color_use_as_albedo = true
    mat.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
    mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
    mat.transparency = BaseMaterial3D.TRANSPARENCY_DISABLED
    mat.roughness = 1.0
    wood.material = mat
    var batch := MultiMesh.new()
    batch.transform_format = MultiMesh.TRANSFORM_3D
    batch.use_colors = true
    batch.mesh = wood
    batch.instance_count = DECK_SEGMENTS
    var dyes := [Color(0.58,0.40,0.26),Color(0.64,0.47,0.30),
        Color(0.53,0.37,0.24),Color(0.60,0.43,0.27)]
    for i in range(DECK_SEGMENTS):
        var t0 := float(i)/float(DECK_SEGMENTS)
        var t1 := float(i+1)/float(DECK_SEGMENTS)
        var xa := lerpf(x0,x1,t0)
        var xb := lerpf(x0,x1,t1)
        var ya := _deck_height(t0,left_y,right_y,deck_center_y)
        var yb := _deck_height(t1,left_y,right_y,deck_center_y)
        var angle := atan2(yb-ya,xb-xa)
        var scale_basis := Basis(Vector3.BACK,angle).scaled(
            Vector3((xb-xa)-0.024,1.0,1.0))
        var center := Vector3((xa+xb)*0.5,(ya+yb)*0.5-PLANK_THICKNESS*0.5,bridge_z)
        batch.set_instance_transform(i,Transform3D(scale_basis,center))
        batch.set_instance_color(i,dyes[(i*3+(i/5))%dyes.size()])
    var planks := MultiMeshInstance3D.new()
    planks.name = "SolidOpaqueTimberPlanks"
    planks.multimesh = batch
    planks.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    add_child(planks)


func _make_main_bridge(candidates: Array[float] = [-9.0,-8.0,-10.0,-7.0,
        -11.0,-5.0,-12.0,-4.0,0.0,9.0]) -> void:
    # Source scan's island silhouette contains a few low coastal gaps.
    # Choose BOTH bridge landings on dry, comparable-height terrain. The
    # earlier fixed +/-7.5m bridge had a 3.5m cliff at its western endpoint!
    var left_hit: Dictionary = {}
    var right_hit: Dictionary = {}
    var candidate_z: Array[float] = candidates
    var candidate_spans: Array[float] = [6.6,7.5,8.2,9.0]
    var suitable := false
    for crossing_z in candidate_z:
        var center_x := _river_x(crossing_z)
        for half_span in candidate_spans:
            var l := _terrain_at(center_x-half_span,crossing_z)
            var r := _terrain_at(center_x+half_span,crossing_z)
            if l.is_empty() or r.is_empty():
                continue
            var height_l: float = l.position.y
            var height_r: float = r.position.y
            if minf(height_l,height_r) < 1.80:
                continue
            if absf(height_l-height_r) > 0.80:
                continue
            if float(l.normal.y) < 0.78 or float(r.normal.y) < 0.78:
                continue
            bridge_center_x = center_x
            bridge_z = crossing_z
            bridge_half_span = half_span
            left_hit = l
            right_hit = r
            suitable = true
            break
        if suitable:
            break
    if not suitable:
        push_error("TERRAIN V3 BRIDGE: no safe two-bank crossing with walkable slopes")
        return
    var x0 := bridge_center_x-bridge_half_span
    var x1 := bridge_center_x+bridge_half_span
    var left_y := float(left_hit.position.y)+0.045
    var right_y := float(right_hit.position.y)+0.045
    deck_center_y = maxf(left_y,right_y)+0.19

    var surface := SurfaceTool.new()
    surface.begin(Mesh.PRIMITIVE_TRIANGLES)
    var wood_colors := [
        Color(0.57,0.39,0.24),Color(0.63,0.44,0.29),
        Color(0.53,0.37,0.23),Color(0.60,0.42,0.27)
    ]
    for i in range(DECK_SEGMENTS):
        var t0 := float(i)/float(DECK_SEGMENTS)
        var t1 := float(i+1)/float(DECK_SEGMENTS)
        var xa := lerpf(x0,x1,t0)
        var xb := lerpf(x0,x1,t1)
        var ya := _deck_height(t0,left_y,right_y,deck_center_y)
        var yb := _deck_height(t1,left_y,right_y,deck_center_y)
        var v0 := Vector3(xa,ya,bridge_z-BRIDGE_HALF_WIDTH)
        var v1 := Vector3(xa,ya,bridge_z+BRIDGE_HALF_WIDTH)
        var v2 := Vector3(xb,yb,bridge_z-BRIDGE_HALF_WIDTH)
        var v3 := Vector3(xb,yb,bridge_z+BRIDGE_HALF_WIDTH)
        var shade: Color = wood_colors[i%wood_colors.size()]
        _add_triangle(surface,v0,v1,v2,shade)
        _add_triangle(surface,v2,v1,v3,shade)

    bridge_mesh = MeshInstance3D.new()
    bridge_mesh.name = "WalkableBridgeDeck"
    bridge_mesh.mesh = surface.commit()
    var material := StandardMaterial3D.new()
    material.vertex_color_use_as_albedo = true
    material.roughness = 0.95
    bridge_mesh.material_override = material
    # Keep the original preview mesh for collision/debug compatibility, but
    # render real thick, shaded boards in a single batched draw call instead.
    bridge_mesh.visible = false
    bridge_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(bridge_mesh)
    _make_solid_planks(x0,x1,left_y,right_y)
    # Use three simple explicit box colliders instead of concave triangles.
    # In Godot 4.3, the generated deck triangles passed mesh import but never
    # produced an active raycast collision; box shapes are stable on mobile.
    bridge_collider = StaticBody3D.new()
    bridge_collider.name = "WalkableBridgePhysical"
    bridge_collider.collision_layer = 1
    bridge_collider.collision_mask = 0
    add_child(bridge_collider)

    var total_span := x1-x0
    var center_shape := BoxShape3D.new()
    center_shape.size = Vector3(total_span*0.60+0.14,0.16,BRIDGE_HALF_WIDTH*2.0)
    var center_collision := CollisionShape3D.new()
    center_collision.name = "CenterDeckCollision"
    center_collision.shape = center_shape
    center_collision.position = Vector3(bridge_center_x,deck_center_y-0.08,bridge_z)
    bridge_collider.add_child(center_collision)
    for side in [-1,1]:
        var t0 := 0.0 if side == -1 else 0.80
        var t1 := 0.20 if side == -1 else 1.0
        var sx := lerpf(x0,x1,t0)
        var ex := lerpf(x0,x1,t1)
        var sy := _deck_height(t0,left_y,right_y,deck_center_y)
        var ey := _deck_height(t1,left_y,right_y,deck_center_y)
        var ramp := CollisionShape3D.new()
        ramp.name = "LeftRampCollision" if side == -1 else "RightRampCollision"
        var ramp_shape := BoxShape3D.new()
        ramp_shape.size = Vector3((ex-sx)+0.16,0.16,BRIDGE_HALF_WIDTH*2.0)
        ramp.shape = ramp_shape
        ramp.position = Vector3((sx+ex)*0.5,(sy+ey)*0.5-0.08,bridge_z)
        ramp.rotation.z = atan2(ey-sy,ex-sx)
        bridge_collider.add_child(ramp)

    # Narrow wooden guard rails are visual only: no invisible trapping
    # collision boxes, and only a few simple batched primitive meshes.
    for side in [-1.0,1.0]:
        for i in range(6):
            var t := 0.11+float(i)*0.155
            var px := lerpf(x0,x1,t)
            var yy := _deck_height(t,left_y,right_y,deck_center_y)
            _wood_box("RailPost",Vector3(px,yy+0.34,
                      bridge_z+side*(BRIDGE_HALF_WIDTH+0.03)),
                      Vector3(0.14,0.70,0.16),Color(0.45,0.31,0.20))
        # Rails float above deck across middle, not block entry ramps.
        _wood_box("BridgeHandrail",
                 Vector3(bridge_center_x,deck_center_y+0.61,
                         bridge_z+side*(BRIDGE_HALF_WIDTH+0.03)),
                 Vector3(bridge_half_span*1.53,0.12,0.15),
                 Color(0.56,0.37,0.22))
    print("TERRAIN V3 SOLID BRIDGE PASS: ",DECK_SEGMENTS," opaque 18cm solid planks, cast shadow ON")
    print("TERRAIN V3 BRIDGE PASS: 1 walkable bridge at z=",bridge_z," span=",bridge_half_span*2.0,
          " left=",left_y," right=",right_y," deck=",deck_center_y)

func _make_secondary_bridge() -> void:
    # Reuse the exact same mesh, proper deck/ramp collision, timber materials
    # and handrails as the north crossing. Names and main smoke-test refs
    # are preserved; the second independent bridge crosses near z=47m.
    var old_mesh := bridge_mesh
    var old_body := bridge_collider
    var old_x := bridge_center_x
    var old_z := bridge_z
    var old_span := bridge_half_span
    var old_height := deck_center_y
    var first_new := get_child_count()
    bridge_collider = null
    _make_main_bridge([47.0,46.0,48.0,45.0,49.0,43.0,51.0,40.0,54.0])
    if bridge_collider != null and get_child_count() > first_new:
        secondary_bridge_collider = bridge_collider
        secondary_bridge_center_x = bridge_center_x
        secondary_bridge_z = bridge_z
        secondary_deck_y = deck_center_y
        secondary_bridge_half_span = bridge_half_span
        for index in range(first_new,get_child_count()):
            var piece := get_child(index)
            piece.name = "Southern" + piece.name
        print("TERRAIN V5 SECOND BRIDGE PASS: x=",secondary_bridge_center_x,
              " z=",secondary_bridge_z, " deck=",secondary_deck_y)
    else:
        push_error("TERRAIN V5 SECOND BRIDGE FAIL: missing safe southern river crossing")
    bridge_mesh = old_mesh
    bridge_collider = old_body
    bridge_center_x = old_x
    bridge_z = old_z
    bridge_half_span = old_span
    deck_center_y = old_height

func _wood_box(label: String, position_m: Vector3, dimensions: Vector3, tint: Color) -> void:
    var n := MeshInstance3D.new()
    n.name = label
    var m := BoxMesh.new()
    m.size = dimensions
    n.mesh = m
    var material := StandardMaterial3D.new()
    material.albedo_color = tint
    material.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
    material.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
    material.roughness = 0.78
    n.material_override = material
    n.position = position_m
    n.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    add_child(n)

func _make_trail_edges() -> void:
    # Sparse road-edge markers where a village pathway bends. Avoid
    # house plots and the river: one MultiMesh for the whole collection.
    var locations: Array[Vector2] = [
        Vector2(11,-29),Vector2(26,-28),Vector2(36,-14),
        Vector2(37,1),Vector2(37,15),Vector2(36,29),
        Vector2(18,-7),Vector2(48,-9),Vector2(14,12),
        Vector2(45,12),Vector2(-48,-25),Vector2(-39,-13),
        Vector2(-33,0),Vector2(-32,15),Vector2(-43,27),
        Vector2(25,35),Vector2(44,42)
    ]
    var objects: Array[Transform3D] = []
    # Most pre-existing sign coordinates belong to the former 140m map.
    # Relocate them to scaled village routes, with extra markers at the new
    # childhood house and coastal footbridge.
    locations.append_array([
        Vector2(-90,-42),Vector2(-74,-57),Vector2(-39,33),
        Vector2(-19,44),Vector2(24,50),Vector2(43,62)])
    for i in range(locations.size()):
        var p: Vector2 = locations[i] if i >= 17 else locations[i]*(260.0/140.0)
        if absf(p.x-_river_x(p.y)) < 6.0:
            continue
        var contact := _terrain_at(p.x,p.y)
        if contact.is_empty() or float(contact.position.y) < 1.6:
            continue
        if float(contact.normal.y) < 0.86:
            continue
        var h := 0.34+0.11*absf(sin(float(i)*1.72))
        var scale_basis := Basis().scaled(Vector3(0.14,h,0.14))
        var pos := Vector3(p.x,float(contact.position.y)+h*0.50,p.y)
        objects.append(Transform3D(scale_basis,pos))

    var marker_mesh := CylinderMesh.new()
    marker_mesh.top_radius = 0.40
    marker_mesh.bottom_radius = 0.50
    marker_mesh.height = 1.0
    marker_mesh.radial_segments = 6
    var wood := StandardMaterial3D.new()
    wood.albedo_color = Color(0.52,0.38,0.24)
    wood.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
    wood.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
    wood.roughness = 0.78
    marker_mesh.material = wood
    var multi := MultiMesh.new()
    multi.transform_format = MultiMesh.TRANSFORM_3D
    multi.mesh = marker_mesh
    multi.instance_count = objects.size()
    for i in range(objects.size()):
        multi.set_instance_transform(i,objects[i])
    var batch := MultiMeshInstance3D.new()
    batch.name = "VillageTrailEdgeMarkers"
    batch.multimesh = multi
    batch.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(batch)
    trail_detail_count = objects.size()
    print("TERRAIN V3 PATHS PASS: ",trail_detail_count,
          " roadside markers in a single instanced batch")
