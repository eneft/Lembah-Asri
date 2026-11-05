extends Node3D
## V8.4 Balai Desa only: geometric, zero-bitmap horizon and visual-only ground skirt.
## Never changes the authoritative island mesh, physics or the other four areas.
const HALL := Vector2(55.71429, 39.0)
const EXTENT := 91.0
const CELL := 3.5
const RAY_LAYER := 1 << 7

func _ready() -> void:
    _build_ground_underlay()
    _build_hills()
    _build_tree_line()
    set_meta("balai_backdrop_ready", true)
    print("BALAI V8.4 BACKDROP READY: uncompressed 3D hills, ground underlay, no bitmap or collision")

func _color_material() -> StandardMaterial3D:
    var mat := StandardMaterial3D.new()
    mat.vertex_color_use_as_albedo = true
    mat.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
    mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
    mat.roughness = 1.0
    mat.cull_mode = BaseMaterial3D.CULL_DISABLED
    return mat

func _solid_material(tint: Color) -> StandardMaterial3D:
    var mat := StandardMaterial3D.new()
    mat.albedo_color = tint
    mat.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
    mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
    mat.roughness = 1.0
    return mat

func _emit(st: SurfaceTool, at: Vector3, tint: Color, normal: Vector3 = Vector3.UP) -> void:
    st.set_color(tint)
    st.set_normal(normal)
    st.add_vertex(at)

func _ground_height(x: float, z: float, centre_y: float) -> float:
    # Sample the SAME authoritative terrain physics even when the visual crop
    # was formerly hidden. The skirt sits below real ground: no z-fighting.
    var q := PhysicsRayQueryParameters3D.create(
        Vector3(x,120.0,z),Vector3(x,-60.0,z))
    q.collision_mask = RAY_LAYER
    var hit := get_world_3d().direct_space_state.intersect_ray(q)
    if not hit.is_empty() and hit.position.y > 0.35:
        return float(hit.position.y) - 0.22
    var distance_m := Vector2(x-HALL.x,z-HALL.y).length()
    return maxf(0.30,centre_y - maxf(0.0,distance_m-15.0)*0.042)

func _build_ground_underlay() -> void:
    var q := PhysicsRayQueryParameters3D.create(
        Vector3(HALL.x,120.0,HALL.y),Vector3(HALL.x,-60.0,HALL.y))
    q.collision_mask = RAY_LAYER
    var hit := get_world_3d().direct_space_state.intersect_ray(q)
    var centre_y: float = float(hit.position.y) if not hit.is_empty() else 2.0
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var divisions := int(ceil(EXTENT*2.0/CELL))
    var step_m := EXTENT*2.0/float(divisions)
    # One authoritative terrain ray per shared grid vertex, not four rays
    # per quad; avoid an unnecessary multi-frame hitch on iPhone Safari.
    var vertices: Array[Vector3] = []
    for zi in range(divisions+1):
        for xi in range(divisions+1):
            var x := -EXTENT+float(xi)*step_m
            var z := -EXTENT+float(zi)*step_m
            vertices.append(Vector3(x,_ground_height(HALL.x+x,HALL.y+z,centre_y),z))
    var stride := divisions+1
    for zi in range(divisions):
        for xi in range(divisions):
            var index := zi*stride+xi
            var a := vertices[index]
            var b := vertices[index+1]
            var c := vertices[index+stride]
            var d := vertices[index+stride+1]
            # Restrained painterly tonal variation, rather than a stretched image.
            var variation := 0.5 + 0.5*sin(float(xi)*0.73+float(zi)*1.19)
            var tint := Color("7f9d65").lerp(Color("a9b987"),variation*0.43)
            _emit(st,a,tint)
            _emit(st,c,tint)
            _emit(st,b,tint)
            _emit(st,b,tint)
            _emit(st,c,tint)
            _emit(st,d,tint)
    st.set_material(_color_material())
    var visual := MeshInstance3D.new()
    visual.name = "VisualGroundUnderlay"
    visual.mesh = st.commit()
    visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    visual.position = Vector3(HALL.x,0.0,HALL.y)
    add_child(visual)

func _build_hill(parent: Node3D, id: int, around: float, radial: float, radius: float, high: float) -> void:
    var cx := HALL.x+cos(around)*radial
    var cz := HALL.y+sin(around)*radial
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var segments := 16
    for level in range(2):
        var first_r := radius*(1.0-0.53*float(level))
        var next_r := radius*(0.47 if level==0 else 0.02)
        var first_y := 0.4+high*(0.0 if level==0 else 0.57)
        var next_y := 0.4+high*(0.57 if level==0 else 1.0)
        for j in range(segments):
            var angle_a := TAU*float(j)/float(segments)
            var angle_b := TAU*float(j+1)/float(segments)
            var ridge_a := 0.91 + 0.09*sin(float(j*3+id))
            var ridge_b := 0.91 + 0.09*sin(float((j+1)*3+id))
            var a := Vector3(cx+cos(angle_a)*first_r,first_y*ridge_a,cz+sin(angle_a)*first_r)
            var b := Vector3(cx+cos(angle_b)*first_r,first_y*ridge_b,cz+sin(angle_b)*first_r)
            var c := Vector3(cx+cos(angle_a)*next_r,next_y*ridge_a,cz+sin(angle_a)*next_r)
            var d := Vector3(cx+cos(angle_b)*next_r,next_y*ridge_b,cz+sin(angle_b)*next_r)
            var shade := 0.28+0.20*sin(float(j)*1.6+float(id))
            var tint := Color("607f67").lerp(Color("89a18a"),clampf(shade+float(level)*0.12,0.0,1.0))
            _emit(st,a,tint)
            _emit(st,c,tint)
            _emit(st,b,tint)
            _emit(st,b,tint)
            _emit(st,c,tint)
            _emit(st,d,tint)
    st.set_material(_color_material())
    var hill := MeshInstance3D.new()
    hill.name = "Hill_%02d" % id
    hill.mesh = st.commit()
    hill.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    parent.add_child(hill)

func _build_hills() -> void:
    var ring := Node3D.new()
    ring.name = "DistantHills"
    add_child(ring)
    # Scene-only distant silhouettes, always outside the actual hall forecourt.
    for i in range(9):
        var angle := TAU*(float(i)+0.25)/9.0
        _build_hill(ring,i,angle,112.0+float(i%3)*7.0,41.0+float(i%3)*5.0,15.0+float(i%4)*5.0)

func _build_tree_line() -> void:
    var forest := Node3D.new()
    forest.name = "DistantTreeLine"
    add_child(forest)
    var trunk_mat := _solid_material(Color("6a6250"))
    var leaf_mats := [
        _solid_material(Color("507958")),
        _solid_material(Color("648661")),
        _solid_material(Color("78946d"))
    ]
    for i in range(24):
        var angle := TAU*(float(i)+0.15*sin(float(i)*1.7))/24.0
        var radial := 77.0+8.0*sin(float(i)*2.3)
        var anchor := Vector3(HALL.x+cos(angle)*radial,0.0,HALL.y+sin(angle)*radial)
        var height_m := 5.4+1.8*float(i%4)/3.0
        var trunk := MeshInstance3D.new()
        trunk.name = "FarTrunk_%02d" % i
        var cylinder := CylinderMesh.new()
        cylinder.top_radius = 0.22
        cylinder.bottom_radius = 0.36
        cylinder.height = height_m*0.58
        cylinder.radial_segments = 6
        trunk.mesh = cylinder
        trunk.material_override = trunk_mat
        trunk.position = anchor+Vector3(0.0,height_m*0.29,0.0)
        trunk.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
        forest.add_child(trunk)
        var crown := MeshInstance3D.new()
        crown.name = "FarCrown_%02d" % i
        var ball := SphereMesh.new()
        ball.radius = height_m*0.27
        ball.height = height_m*0.59
        ball.radial_segments = 8
        ball.rings = 4
        crown.mesh = ball
        crown.material_override = leaf_mats[i%3]
        crown.position = anchor+Vector3(0.0,height_m*0.75,0.0)
        crown.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
        forest.add_child(crown)
