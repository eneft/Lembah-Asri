extends Node3D
## Balai Desa reference-matched modular kit V0.2 — aged painted texture, 4-slope hip roof.
## 1 Godot unit = 1 metre. No scene or collision is replaced.
## Modules: plinth, split walls with REAL openings, door, window,
## authentic limasan roof (4 planes), raised stone plinth, stairs, flag and sign.
## Game-friendly low-poly, UV metres, seven pre-authored texture maps; no runtime painting.
const WIDTH := 9.20
const DEPTH := 7.50
const PLINTH_H := 0.63
const WALL_H := 3.05
const WALL_T := 0.18
const RIDGE_Y := 5.28
const EAVE_Y := 3.74

var _materials: Dictionary = {}
var _built := false

func build_balai() -> void:
    if _built:
        return
    _built = true
    _prepare_materials()
    _box(self,"Fondasi",Vector3(0.0,PLINTH_H*0.5,0.0),
        Vector3(WIDTH,PLINTH_H,DEPTH),"stone",0.8,"foundation")
    _box(self,"Lantai",Vector3(0.0,PLINTH_H+0.045,0.0),
        Vector3(WIDTH-0.30,0.09,DEPTH-0.30),"plaster",0.95,"floor")

    var wall_y := PLINTH_H
    # Front points toward +Z, consistent with the current Balai layout.
    var front := _group("DindingDepan")
    _wall(front,WIDTH,DEPTH*0.5-WALL_T*0.5,false,[
        {"center":0.0,"width":1.86,"sill":0.0,"height":2.38},
        {"center":-2.85,"width":1.48,"sill":1.08,"height":1.26},
        {"center":2.85,"width":1.48,"sill":1.08,"height":1.26}
    ],wall_y)
    _door(Vector3(0.0,wall_y,DEPTH*0.5+0.03),1.86,2.38)
    _window(Vector3(-2.85,wall_y+1.08,DEPTH*0.5+0.02),1.48,1.26,false,"DepanKiri")
    _window(Vector3(2.85,wall_y+1.08,DEPTH*0.5+0.02),1.48,1.26,false,"DepanKanan")

    var back := _group("DindingBelakang")
    _wall(back,WIDTH,-DEPTH*0.5+WALL_T*0.5,false,[
        {"center":-2.35,"width":1.40,"sill":1.10,"height":1.20},
        {"center":2.35,"width":1.40,"sill":1.10,"height":1.20}
    ],wall_y)
    _window(Vector3(-2.35,wall_y+1.10,-DEPTH*0.5-0.02),1.40,1.20,false,"BelakangKiri")
    _window(Vector3(2.35,wall_y+1.10,-DEPTH*0.5-0.02),1.40,1.20,false,"BelakangKanan")

    for side in [-1,1]:
        var panel := _group("DindingKiri" if side < 0 else "DindingKanan")
        _wall(panel,DEPTH,float(side)*(WIDTH*0.5-WALL_T*0.5),true,[
            {"center":0.2,"width":1.45,"sill":1.10,"height":1.23}
        ],wall_y)
        _window(Vector3(float(side)*(WIDTH*0.5+0.02),wall_y+1.10,0.2),
            1.45,1.23,true,"SampingKiri" if side < 0 else "SampingKanan")

    _roof()
    _entry_posts()
    _stairs_and_foundation()
    _ground_sign()
    _flag()
    _small_details()
    set_meta("kit_version","balai_modular_v0_3")
    set_meta("footprint_m",Vector2(WIDTH,DEPTH))
    set_meta("height_m",RIDGE_Y)
    set_meta("authoritative_collision",false)
    print("BALAI MODULAR KIT V0.3: hand-painted 512px SVG materials, shared UV wall unwrap, limasan, six windows and stairs; source model preserved")

func _group(name: String) -> Node3D:
    var group := Node3D.new()
    group.name = name
    add_child(group)
    return group

func _prepare_materials() -> void:
    var tiles := {
        # Editable HAND-PAINTED SVG albedo, rasterized at 512px on Godot import.
        # Detailed cracks, moss, carved wood grain and roof clay are actual
        # artwork instead of algorithmically varying material colors.
        "plaster":"plaster_painted.svg",
        "stone":"stone_painted.svg",
        "wood":"wood_painted.svg",
        "roof":"roof_painted.svg",
        "glass":"glass_teal.png",
        "white":"white_painted.svg",
        "black":"white_painted.svg",
        "earth":"earth_path.png"
    }
    for key in tiles.keys():
        var path: String = "res://assets/environment/village/balai_modular/"+str(tiles[key])
        var tex := load(path) as Texture2D
        if tex == null:
            push_error("BALAI V0.2 FAIL: painted texture asset missing: "+path)
            continue
        var mat := StandardMaterial3D.new()
        mat.albedo_texture = tex
        mat.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
        mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
        mat.roughness = 0.94 if key != "glass" else 0.47
        mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
        mat.texture_repeat = true
        mat.cull_mode = BaseMaterial3D.CULL_DISABLED
        if key == "roof" or key == "stone":
            var normal_path := "res://assets/environment/village/balai_modular/"+str(key)+"_normal.png"
            var normal_tex := load(normal_path) as Texture2D
            if normal_tex != null:
                mat.normal_enabled = true
                mat.normal_texture = normal_tex
                mat.normal_scale = 0.52 if key == "roof" else 0.35
        if key == "black":
            mat.albedo_color = Color("373330")
        _materials[key] = mat
    var flats := {
        "brass":Color("c2a057"),
        "flag_red":Color("d82927"),
        "flag_white":Color("f6f2e7"),
        "metal":Color("b1b4ab"),
        "moss":Color("64804f"),
        "wood_dark":Color("785436")
    }
    for id in flats.keys():
        var matte := StandardMaterial3D.new()
        matte.albedo_color = flats[id]
        matte.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
        matte.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
        matte.roughness = 0.89
        matte.cull_mode = BaseMaterial3D.CULL_DISABLED
        _materials[id] = matte


func _painted_texture(_kind: String, _base: Color) -> ImageTexture:
    # Retained as an explicit legacy extension hook. V0.2 uses authored PNGs,
    # generated once at asset-pipeline time and mipmapped by the Godot importer.
    return null


func _put(st: SurfaceTool, where: Vector3, normal: Vector3, uv: Vector2) -> void:
    st.set_normal(normal)
    st.set_uv(uv)
    st.add_vertex(where)

func _quad(st: SurfaceTool, a: Vector3,b: Vector3,c: Vector3,d: Vector3,
        normal: Vector3, u: float, v: float,
        uv_origin: Vector2 = Vector2.ZERO) -> void:
    # Authored UV origin is available for globally aligned modular wall panels.
    # A cutout does not reset painting at the border of another panel.
    _put(st,a,normal,uv_origin)
    _put(st,b,normal,uv_origin+Vector2(u,0.0))
    _put(st,c,normal,uv_origin+Vector2(u,v))
    _put(st,a,normal,uv_origin)
    _put(st,c,normal,uv_origin+Vector2(u,v))
    _put(st,d,normal,uv_origin+Vector2(0.0,v))

func _textured_box_mesh(dims: Vector3, texture_metres: float,
        origin: Vector3 = Vector3.ZERO, world_aligned_uv: bool = false) -> ArrayMesh:
    var x := dims.x*0.5
    var y := dims.y*0.5
    var z := dims.z*0.5
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var o := origin if world_aligned_uv else Vector3.ZERO
    var uv_y := (o.y-y)/texture_metres
    # Side walls project (Z,Y), front/back project (X,Y). UV origins are
    # calculated from the building coordinate, not from each isolated brick.
    _quad(st,Vector3(-x,-y,-z),Vector3(-x,-y,z),
        Vector3(-x,y,z),Vector3(-x,y,-z),Vector3.LEFT,
        dims.z/texture_metres,dims.y/texture_metres,
        Vector2((o.z-z)/texture_metres,uv_y))
    _quad(st,Vector3(x,-y,z),Vector3(x,-y,-z),
        Vector3(x,y,-z),Vector3(x,y,z),Vector3.RIGHT,
        dims.z/texture_metres,dims.y/texture_metres,
        Vector2((-o.z-z)/texture_metres,uv_y))
    _quad(st,Vector3(-x,y,z),Vector3(x,y,z),
        Vector3(x,y,-z),Vector3(-x,y,-z),Vector3.UP,
        dims.x/texture_metres,dims.z/texture_metres,
        Vector2((o.x-x)/texture_metres,(-o.z-z)/texture_metres))
    _quad(st,Vector3(-x,-y,-z),Vector3(x,-y,-z),
        Vector3(x,-y,z),Vector3(-x,-y,z),Vector3.DOWN,
        dims.x/texture_metres,dims.z/texture_metres,
        Vector2((o.x-x)/texture_metres,(o.z-z)/texture_metres))
    _quad(st,Vector3(x,-y,z),Vector3(-x,-y,z),
        Vector3(-x,y,z),Vector3(x,y,z),Vector3.BACK,
        dims.x/texture_metres,dims.y/texture_metres,
        Vector2((-o.x-x)/texture_metres,uv_y))
    _quad(st,Vector3(-x,-y,-z),Vector3(x,-y,-z),
        Vector3(x,y,-z),Vector3(-x,y,-z),Vector3.FORWARD,
        dims.x/texture_metres,dims.y/texture_metres,
        Vector2((o.x-x)/texture_metres,uv_y))
    return st.commit()
func _box(root: Node3D,name: String,position_m: Vector3,dims: Vector3,
        mat_id: String,tile: float,module_type: String) -> MeshInstance3D:
    var panel := MeshInstance3D.new()
    panel.name = name
    # Walls share the same UV origin regardless of how openings partition the
    # mesh. Roof tiles and trim remain independent authored UV islands.
    var shared_wall_uv := module_type == "wall"
    var real_tile: float = 2.4 if shared_wall_uv else tile
    panel.mesh = _textured_box_mesh(dims,real_tile,position_m,shared_wall_uv)
    panel.material_override = _materials[mat_id] as Material
    panel.set_meta("shared_uv",shared_wall_uv)
    panel.set_meta("uv_tile_metres",real_tile)
    panel.position = position_m
    panel.set_meta("module_type",module_type)
    panel.set_meta("dimensions_m",dims)
    root.add_child(panel)
    return panel

func _wall(root: Node3D,span: float,at: float,sideways: bool,
        openings: Array,base: float) -> void:
    # 2D grid partition creates TRUE voids; no doors painted onto solid walls.
    var xs: Array[float] = [-span*0.5,span*0.5]
    var ys: Array[float] = [0.0,WALL_H]
    for hole in openings:
        xs.append(float(hole["center"])-float(hole["width"])*0.5)
        xs.append(float(hole["center"])+float(hole["width"])*0.5)
        ys.append(float(hole["sill"]))
        ys.append(float(hole["sill"])+float(hole["height"]))
    xs.sort()
    ys.sort()
    var count := 0
    for ix in range(xs.size()-1):
        for iy in range(ys.size()-1):
            var u0: float = xs[ix]
            var u1: float = xs[ix+1]
            var v0: float = ys[iy]
            var v1: float = ys[iy+1]
            if u1-u0 < 0.001 or v1-v0 < 0.001:
                continue
            var u: float = (u0+u1)*0.5
            var v: float = (v0+v1)*0.5
            var hole_here := false
            for hole in openings:
                if absf(u-float(hole["center"])) < float(hole["width"])*0.5 and (
                    v > float(hole["sill"]) and v < float(hole["sill"])+float(hole["height"])):
                    hole_here = true
                    break
            if hole_here:
                continue
            var mid := Vector3((u0+u1)*0.5,base+v,(0.0)) if not sideways else (
                Vector3(at,base+v,(u0+u1)*0.5))
            if not sideways:
                mid.z = at
            # dimensions are assembled as metre-based wall bricks.
            var dims := Vector3(u1-u0,v1-v0,WALL_T) if not sideways else (
                Vector3(WALL_T,v1-v0,u1-u0))
            _box(root,"Panel_%02d" % count,mid,dims,"plaster",1.0,"wall")
            count += 1

func _door(anchor: Vector3,width: float,height: float) -> void:
    var door := _group("PintuDepan")
    door.position = anchor
    door.set_meta("module_type","double_glazed_door")
    door.set_meta("opening_m",Vector2(width,height))
    var leaf_width := (width-0.14)*0.5
    for side in [-1,1]:
        var x := float(side)*(leaf_width*0.5+0.012)
        var leafname := "DaunPintu" if side < 0 else "DaunPintuKanan"
        _box(door,leafname,Vector3(x,height*0.5,0.0),
            Vector3(leaf_width,height-0.10,0.078),"wood",1.2,"door_leaf")
        # Painted glass windows are actual separate surfaces in top half.
        _box(door,"KacaAtas_%d" % side,Vector3(x,height*0.72,0.052),
            Vector3(leaf_width-0.19,height*0.41,0.022),"glass",0.96,"door_glass")
        for mullion in [-1,1]:
            _box(door,"ListPintu_%d_%d" % [side,mullion],
                Vector3(x+float(mullion)*(leaf_width*0.5-0.07),height*0.72,0.075),
                Vector3(0.095,height*0.43,0.09),"wood",0.91,"door_frame")
        _box(door,"PalangKaca_%d" % side,Vector3(x,height*0.73,0.08),
            Vector3(leaf_width-0.10,0.062,0.08),"wood",1.0,"door_muntin")
        _box(door,"AmbangKaca_%d" % side,Vector3(x,height*0.49,0.081),
            Vector3(leaf_width-0.08,0.11,0.083),"wood",0.8,"door_frame")
        _box(door,"PapanBawah_%d" % side,Vector3(x,height*0.23,0.063),
            Vector3(leaf_width-0.18,0.47,0.018),"wood",0.65,"lower_door")
        var handle_x := -0.12 if side < 0 else 0.12
        _box(door,"Gagang_%d" % side,
            Vector3(handle_x,height*0.48,0.128),
            Vector3(0.032,0.27,0.065),"brass",0.35,"door_handle")
    for side in [-1,1]:
        _box(door,"Kusen_%d" % side,Vector3(float(side)*(width*0.5-0.04),height*0.5,0.045),
            Vector3(0.11,height,0.14),"wood",0.9,"door_frame")
    _box(door,"KusenAtas",Vector3(0.0,height-0.045,0.043),
        Vector3(width,0.11,0.14),"wood",0.9,"door_frame")


func _window(anchor: Vector3,width: float,height: float,
        sideways: bool,suffix: String) -> void:
    var group := _group("Jendela"+suffix)
    group.position = anchor
    if sideways:
        group.rotation.y = PI*0.5
    group.set_meta("module_type","window")
    group.set_meta("opening_m",Vector2(width,height))
    _box(group,"Kaca",Vector3(0.0,height*0.5,0.0),
        Vector3(width-0.16,height-0.15,0.045),"glass",1.25,"pane")
    for side in [-1,1]:
        _box(group,"KusenSisi_%d" % side,
            Vector3(float(side)*(width*0.5-0.065),height*0.5,0.047),
            Vector3(0.13,height,0.16),"wood",0.9,"window_frame")
    for side in [0,1]:
        _box(group,"KusenDatar_%d" % side,
            Vector3(0.0,height*float(side),0.045),
            Vector3(width,0.13,0.15),"wood",1.0,"window_frame")
    _box(group,"PembagiTengah",Vector3(0.0,height*0.5,0.08),
        Vector3(0.084,height-0.09,0.08),"wood",0.9,"muntin")
    _box(group,"PembagiHorizontal",Vector3(0.0,height*0.52,0.08),
        Vector3(width-0.16,0.073,0.08),"wood",0.9,"muntin")
    _box(group,"AmbangJendela",Vector3(0.0,-0.06,0.13),
        Vector3(width+0.22,0.135,0.27),"wood",0.88,"window_sill")


func _roof() -> void:
    # The reference is a Javanese LIMASAN (hip roof), not two intersecting
    # pitched planes. Exactly 4 UV faces create the volume, not thousands of
    # geometry tiles: their curved clay profile is painted into a repeat map.
    var roof := _group("AtapGenteng")
    roof.set_meta("module_type","limasan_four_plane")
    var half_x := WIDTH*0.5+0.56
    var half_z := DEPTH*0.5+0.56
    var ridge_x := 2.72
    var a := Vector3(-half_x,EAVE_Y,half_z)
    var b := Vector3(half_x,EAVE_Y,half_z)
    var c := Vector3(half_x,EAVE_Y,-half_z)
    var d := Vector3(-half_x,EAVE_Y,-half_z)
    var r0 := Vector3(-ridge_x,RIDGE_Y,0.0)
    var r1 := Vector3(ridge_x,RIDGE_Y,0.0)
    _roof_quad(roof,"GentengDepan",a,b,r1,r0)
    _roof_quad(roof,"GentengBelakang",c,d,r0,r1)
    _roof_tri(roof,"GentengKanan",b,c,r1)
    _roof_tri(roof,"GentengKiri",d,a,r0)
    # Small ridge caps reinforce the silhouette: still only a few hundred
    # low-poly triangles, while actual tile/chipped texture remains flat UV art.
    _roof_cap(roof,"NokAtas",r0,r1,0.115)
    _roof_cap(roof,"NokKananDepan",r1,b,0.11)
    _roof_cap(roof,"NokKananBelakang",r1,c,0.11)
    _roof_cap(roof,"NokKiriDepan",r0,a,0.11)
    _roof_cap(roof,"NokKiriBelakang",r0,d,0.11)
    _box(roof,"LisplangDepan",Vector3(0.0,EAVE_Y-0.12,half_z),
        Vector3(half_x*2.0,0.16,0.11),"wood",1.1,"roof_trim")
    _box(roof,"LisplangBelakang",Vector3(0.0,EAVE_Y-0.12,-half_z),
        Vector3(half_x*2.0,0.16,0.11),"wood",1.1,"roof_trim")
    for side in [-1,1]:
        _box(roof,"LisplangSamping_%d" % side,
            Vector3(float(side)*half_x,EAVE_Y-0.12,0.0),
            Vector3(0.1,0.16,half_z*2.0),"wood",1.1,"roof_trim")
    # Eaves cast a narrow shadow, adding architectural legibility.
    _box(roof,"BalokBawahDepan",Vector3(0.0,EAVE_Y-0.23,DEPTH*0.5),
        Vector3(WIDTH+0.18,0.16,0.20),"wood",1.1,"roof_beam")

func _roof_quad(parent: Node3D,name: String,a: Vector3,b: Vector3,
        c: Vector3,d: Vector3) -> void:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var norm := (b-a).cross(c-a).normalized()
    var span_u := a.distance_to(b)/2.85
    var span_v := a.distance_to(d)/2.9
    _put(st,a,norm,Vector2(0.0,0.0))
    _put(st,b,norm,Vector2(span_u,0.0))
    _put(st,c,norm,Vector2(span_u*0.80,span_v))
    _put(st,a,norm,Vector2(0.0,0.0))
    _put(st,c,norm,Vector2(span_u*0.80,span_v))
    _put(st,d,norm,Vector2(span_u*0.20,span_v))
    var plane := MeshInstance3D.new()
    plane.name = name
    plane.mesh = st.commit()
    plane.material_override = _materials["roof"] as Material
    plane.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    plane.set_meta("module_type","roof_plane")
    parent.add_child(plane)

func _roof_tri(parent: Node3D,name: String,a: Vector3,b: Vector3,c: Vector3) -> void:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var norm := (b-a).cross(c-a).normalized()
    _put(st,a,norm,Vector2(0.0,0.0))
    _put(st,b,norm,Vector2(a.distance_to(b)/2.80,0.0))
    _put(st,c,norm,Vector2(a.distance_to(b)/5.60,a.distance_to(c)/2.90))
    var plane := MeshInstance3D.new()
    plane.name = name
    plane.mesh = st.commit()
    plane.material_override = _materials["roof"] as Material
    plane.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    plane.set_meta("module_type","roof_plane")
    parent.add_child(plane)

func _roof_cap(parent: Node3D,name: String,a: Vector3,b: Vector3,radius: float) -> void:
    var cap := MeshInstance3D.new()
    cap.name = name
    var cylinder := CylinderMesh.new()
    cylinder.top_radius = radius
    cylinder.bottom_radius = radius
    cylinder.height = a.distance_to(b)
    cylinder.radial_segments = 8
    cap.mesh = cylinder
    cap.material_override = _materials["roof"] as Material
    cap.position = (a+b)*0.5 + Vector3(0.0,0.045,0.0)
    cap.quaternion = Quaternion(Vector3.UP,(b-a).normalized())
    cap.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    cap.set_meta("module_type","ridge_cap")
    parent.add_child(cap)


func _entry_posts() -> void:
    var porch := _group("TiangTeras")
    for index in range(4):
        var x: float = float([-4.18,-1.80,1.80,4.18][index])
        var wall_front := DEPTH*0.5+0.16
        _box(porch,"PilarPlester_%d" % index,Vector3(x,PLINTH_H+1.47,wall_front),
            Vector3(0.30,2.94,0.34),"plaster",0.95,"plastered_column")
        _box(porch,"KakiPilar_%d" % index,Vector3(x,PLINTH_H+0.25,wall_front),
            Vector3(0.46,0.50,0.45),"stone",0.74,"column_base")
        _box(porch,"KepalaPilar_%d" % index,Vector3(x,PLINTH_H+2.95,wall_front),
            Vector3(0.48,0.27,0.46),"plaster",0.82,"column_cap")
    _box(porch,"BalokLintelDepan",Vector3(0.0,EAVE_Y-0.18,DEPTH*0.5+0.10),
        Vector3(WIDTH-0.25,0.14,0.28),"wood",0.92,"porch_beam")


func _ground_sign() -> void:
    var sign := _group("PapanNamaTanah")
    sign.position = Vector3(5.05,0.0,6.06)
    sign.set_meta("module_type","ground_sign")
    for side in [-1,1]:
        var x := float(side)*1.10
        _box(sign,"TiangPapan_%d" % side,Vector3(x,1.13,0.0),
            Vector3(0.17,2.22,0.17),"white",0.95,"sign_post")
        _box(sign,"PondasiPapan_%d" % side,Vector3(x,0.21,0.0),
            Vector3(0.41,0.42,0.44),"stone",0.68,"sign_post_base")
    _box(sign,"PapanPutih",Vector3(0.0,1.55,0.05),
        Vector3(2.43,0.98,0.12),"white",0.94,"sign_board")
    var writing := Label3D.new()
    writing.name = "Tulisan"
    writing.text = "KANTOR DESA\nLEMBAH ASRI"
    writing.font_size = 60
    writing.pixel_size = 0.004
    writing.modulate = Color("292522")
    writing.outline_size = 0
    writing.position = Vector3(0.0,1.57,0.135)
    writing.no_depth_test = false
    sign.add_child(writing)
    # Independent miniature tiled hip canopy; not on the main building roof.
    var canopy := _group("AtapPapanNama")
    canopy.position = sign.position + Vector3(0.0,2.28,0.0)
    var ax := 1.46
    var az := 0.54
    var eave := 0.12
    var ridge_y := 0.49
    var ridge_x := 0.78
    var ca := Vector3(-ax,eave,az)
    var cb := Vector3(ax,eave,az)
    var cc := Vector3(ax,eave,-az)
    var cd := Vector3(-ax,eave,-az)
    var cr0 := Vector3(-ridge_x,ridge_y,0.0)
    var cr1 := Vector3(ridge_x,ridge_y,0.0)
    _roof_quad(canopy,"GentengPapanDepan",ca,cb,cr1,cr0)
    _roof_quad(canopy,"GentengPapanBelakang",cc,cd,cr0,cr1)
    _roof_tri(canopy,"GentengPapanKanan",cb,cc,cr1)
    _roof_tri(canopy,"GentengPapanKiri",cd,ca,cr0)
    _roof_cap(canopy,"NokMini",cr0,cr1,0.06)
    _box(canopy,"LisplangMini",Vector3(0.0,eave-0.06,az),
        Vector3(2.95,0.095,0.075),"wood",0.9,"sign_roof_trim")

func _stairs_and_foundation() -> void:
    var base := _group("TanggaBatu")
    _box(base,"TerasBatu",Vector3(0.0,PLINTH_H*0.5,4.16),
        Vector3(WIDTH+0.14,PLINTH_H,1.10),"stone",0.80,"raised_veranda")
    for i in range(3):
        var rise := PLINTH_H - float(i)*0.21
        _box(base,"AnakTangga_%d" % i,Vector3(0.0,rise*0.5,4.75+float(i)*0.46),
            Vector3(2.73,rise,0.52),"stone",0.74,"stone_step")
    _box(base,"BatuAmbang",Vector3(0.0,PLINTH_H+0.025,4.13),
        Vector3(2.95,0.06,1.15),"stone",0.88,"veranda_landing")
    for side in [-1,1]:
        _box(base,"TepiTangga_%d" % side,
            Vector3(float(side)*1.40,0.24,5.20),
            Vector3(0.24,0.44,1.42),"stone",0.70,"stair_cheek")
    base.set_meta("module_type","stone_staircase")

func _flag() -> void:
    var site := _group("BenderaMerahPutih")
    site.position = Vector3(6.55,0.0,5.18)
    site.set_meta("module_type","indonesian_flag")
    _box(site,"DudukanTiang",Vector3(0.0,0.23,0.0),
        Vector3(0.37,0.46,0.37),"stone",0.65,"flag_base")
    var pole := MeshInstance3D.new()
    pole.name = "TiangLogam"
    var mesh := CylinderMesh.new()
    mesh.top_radius = 0.048
    mesh.bottom_radius = 0.074
    mesh.height = 6.64
    mesh.radial_segments = 8
    pole.mesh = mesh
    pole.position.y = 3.32
    pole.material_override = _materials["metal"] as Material
    site.add_child(pole)
    var gold := MeshInstance3D.new()
    gold.name = "PuncakEmas"
    var sphere := SphereMesh.new()
    sphere.radius = 0.15
    sphere.height = 0.30
    sphere.radial_segments = 10
    sphere.rings = 6
    gold.mesh = sphere
    gold.material_override = _materials["brass"] as Material
    gold.position.y = 6.72
    site.add_child(gold)
    for band in range(2):
        var st := SurfaceTool.new()
        st.begin(Mesh.PRIMITIVE_TRIANGLES)
        var top_y := 6.44-float(band)*0.42
        for ix in range(9):
            var dx0 := float(ix)*0.23
            var dx1 := float(ix+1)*0.23
            var a := Vector3(dx0,top_y,0.13*sin(dx0*2.7))
            var b := Vector3(dx1,top_y-0.07*sin(dx1*1.35),0.13*sin(dx1*2.7))
            var c := Vector3(dx1,top_y-0.42-0.07*sin(dx1*1.35),0.13*sin(dx1*2.7+0.8))
            var d := Vector3(dx0,top_y-0.42,0.13*sin(dx0*2.7+0.8))
            _quad(st,a,b,c,d,Vector3.BACK,1.0,1.0)
        var cloth := MeshInstance3D.new()
        cloth.name = "KainMerah" if band==0 else "KainPutih"
        cloth.mesh = st.commit()
        cloth.material_override = _materials["flag_red" if band==0 else "flag_white"] as Material
        cloth.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
        cloth.set_meta("module_type","flag_cloth_plane")
        site.add_child(cloth)

func _small_details() -> void:
    var aged := _group("DetailHalaman")
    # Secondary details borrow shared texture maps and do not introduce
    # heavy high-poly furniture or separate draw-call-heavy materials.
    var stool := _group("KursiKayuDepan")
    stool.position = Vector3(-3.63,PLINTH_H,4.21)
    _box(stool,"Dudukan",Vector3(0.0,0.48,0.0),
        Vector3(0.51,0.09,0.47),"wood",0.65,"stool_seat")
    for side in [-1,1]:
        for depth_sign in [-1,1]:
            _box(stool,"Kaki_%d_%d" % [side,depth_sign],
                Vector3(float(side)*0.17,0.25,float(depth_sign)*0.14),
                Vector3(0.067,0.49,0.07),"wood",0.65,"stool_leg")
    for i in range(7):
        var x := -4.21+float(i)*1.30
        if absf(x)<1.2:
            continue
        _box(aged,"LumutKaki_%d" % i,Vector3(x,PLINTH_H+0.035,DEPTH*0.5+0.20),
            Vector3(0.49,0.075,0.16),"moss",1.0,"moss_patch")
    aged.set_meta("module_type","courtyard_details")
