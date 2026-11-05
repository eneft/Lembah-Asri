extends Node3D
## Standalone modular starter kit for Balai Desa. V0.1.
## 1 Godot unit = 1 metre. No scene or collision is replaced.
## Modules: plinth, split walls with REAL openings, door, window,
## 2-sided pitched roof, veranda and freestanding ground sign.
## All modules share five repeatable 256px painted material templates.
const WIDTH := 9.20
const DEPTH := 7.50
const PLINTH_H := 0.24
const WALL_H := 3.20
const WALL_T := 0.18
const RIDGE_Y := 5.28
const EAVE_Y := 3.54

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
        {"center":0.0,"width":1.48,"sill":0.0,"height":2.32},
        {"center":-2.85,"width":1.48,"sill":1.08,"height":1.26},
        {"center":2.85,"width":1.48,"sill":1.08,"height":1.26}
    ],wall_y)
    _door(Vector3(0.0,wall_y,DEPTH*0.5+0.03),1.48,2.32)
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
    _ground_sign()
    set_meta("kit_version","balai_modular_v0_1")
    set_meta("footprint_m",Vector2(WIDTH,DEPTH))
    set_meta("height_m",RIDGE_Y)
    set_meta("authoritative_collision",false)
    print("BALAI MODULAR KIT V0.1: generated foundation, 4 modular walls, 6 real window openings, front door, pitched roof and ground sign")

func _group(name: String) -> Node3D:
    var group := Node3D.new()
    group.name = name
    add_child(group)
    return group

func _prepare_materials() -> void:
    var palettes := {
        "plaster":Color("e7dfcc"),
        "stone":Color("918e83"),
        "wood":Color("927354"),
        "roof":Color("a7604e"),
        "glass":Color("b4cbc1"),
        "white":Color("f5f3e8"),
        "black":Color("353635")
    }
    for key in palettes.keys():
        var mat := StandardMaterial3D.new()
        mat.albedo_texture = _painted_texture(str(key),palettes[key])
        mat.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
        mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
        mat.roughness = 0.92 if str(key) != "glass" else 0.42
        mat.metallic = 0.0
        mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
        mat.texture_repeat = BaseMaterial3D.TEXTURE_REPEAT_ENABLED
        mat.cull_mode = BaseMaterial3D.CULL_DISABLED
        _materials[key] = mat

func _painted_texture(kind: String, base: Color) -> ImageTexture:
    # Replaceable art slots, not fake photo detail in mesh geometry.
    # All surfaces receive metre-based tiling UVs from _textured_box_mesh.
    var pic := Image.create(256,256,false,Image.FORMAT_RGBA8)
    for y in range(256):
        for x in range(256):
            var wave := sin(float(x)*0.19+sin(float(y)*0.027)*3.1)
            var sweep := sin(float(y)*0.087+float(x)*0.017)
            var irregular := sin(float(x)*0.51+float(y)*0.37)
            var value := 0.035*wave+0.023*sweep+0.014*irregular
            if kind == "wood":
                value += 0.045*sin(float(x)*0.12+sin(float(y)*0.04)*1.7)
            elif kind == "roof":
                var row := int(y/35)
                var seam := (x+(row%2)*17)%34
                if y%35 < 2 or seam < 2:
                    value -= 0.16
                elif seam >= 18 and seam < 22:
                    value += 0.035
            elif kind == "stone":
                value += 0.03*sin(float(x)*0.40-float(y)*0.33)
            elif kind == "glass":
                value += 0.04*sin(float(x+y)*0.012)
            var c := Color(clampf(base.r+value,0.0,1.0),
                clampf(base.g+value*0.93,0.0,1.0),
                clampf(base.b+value*0.76,0.0,1.0),1.0)
            pic.set_pixel(x,y,c)
    pic.generate_mipmaps()
    return ImageTexture.create_from_image(pic)

func _put(st: SurfaceTool, where: Vector3, normal: Vector3, uv: Vector2) -> void:
    st.set_normal(normal)
    st.set_uv(uv)
    st.add_vertex(where)

func _quad(st: SurfaceTool, a: Vector3,b: Vector3,c: Vector3,d: Vector3,
        normal: Vector3, u: float, v: float) -> void:
    # Two triangles, fully normalized surface normal. Vectors are in local m.
    _put(st,a,normal,Vector2(0.0,0.0))
    _put(st,b,normal,Vector2(u,0.0))
    _put(st,c,normal,Vector2(u,v))
    _put(st,a,normal,Vector2(0.0,0.0))
    _put(st,c,normal,Vector2(u,v))
    _put(st,d,normal,Vector2(0.0,v))

func _textured_box_mesh(dims: Vector3, texture_metres: float) -> ArrayMesh:
    var x := dims.x*0.5
    var y := dims.y*0.5
    var z := dims.z*0.5
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    _quad(st,Vector3(-x,-y,-z),Vector3(-x,-y,z),
        Vector3(-x,y,z),Vector3(-x,y,-z),Vector3.LEFT,
        dims.z/texture_metres,dims.y/texture_metres)
    _quad(st,Vector3(x,-y,z),Vector3(x,-y,-z),
        Vector3(x,y,-z),Vector3(x,y,z),Vector3.RIGHT,
        dims.z/texture_metres,dims.y/texture_metres)
    _quad(st,Vector3(-x,y,z),Vector3(x,y,z),
        Vector3(x,y,-z),Vector3(-x,y,-z),Vector3.UP,
        dims.x/texture_metres,dims.z/texture_metres)
    _quad(st,Vector3(-x,-y,-z),Vector3(x,-y,-z),
        Vector3(x,-y,z),Vector3(-x,-y,z),Vector3.DOWN,
        dims.x/texture_metres,dims.z/texture_metres)
    _quad(st,Vector3(x,-y,z),Vector3(-x,-y,z),
        Vector3(-x,y,z),Vector3(x,y,z),Vector3.BACK,
        dims.x/texture_metres,dims.y/texture_metres)
    _quad(st,Vector3(-x,-y,-z),Vector3(x,-y,-z),
        Vector3(x,y,-z),Vector3(-x,y,-z),Vector3.FORWARD,
        dims.x/texture_metres,dims.y/texture_metres)
    return st.commit()

func _box(root: Node3D,name: String,position_m: Vector3,dims: Vector3,
        mat_id: String,tile: float,module_type: String) -> MeshInstance3D:
    var panel := MeshInstance3D.new()
    panel.name = name
    panel.mesh = _textured_box_mesh(dims,tile)
    panel.material_override = _materials[mat_id] as Material
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
    door.set_meta("module_type","door")
    _box(door,"DaunPintu",Vector3(0.0,height*0.5,0.0),
        Vector3(width-0.12,height-0.08,0.075),"wood",1.2,"door_leaf")
    _box(door,"KusenKiri",Vector3(-width*0.5+0.04,height*0.5,0.03),
        Vector3(0.09,height,0.14),"wood",1.2,"frame")
    _box(door,"KusenKanan",Vector3(width*0.5-0.04,height*0.5,0.03),
        Vector3(0.09,height,0.14),"wood",1.2,"frame")
    _box(door,"KusenAtas",Vector3(0.0,height-0.045,0.03),
        Vector3(width,0.09,0.14),"wood",1.2,"frame")
    _box(door,"Gagang",Vector3(width*0.36,height*0.48,0.065),
        Vector3(0.035,0.14,0.05),"stone",0.35,"handle")

func _window(anchor: Vector3,width: float,height: float,
        sideways: bool,suffix: String) -> void:
    var group := _group("Jendela"+suffix)
    group.position = anchor
    if sideways:
        group.rotation.y = PI*0.5
    group.set_meta("module_type","window")
    group.set_meta("opening_m",Vector2(width,height))
    _box(group,"Kaca",Vector3(0.0,height*0.5,0.0),
        Vector3(width-0.13,height-0.14,0.045),"glass",1.1,"pane")
    for sign in [-1,1]:
        _box(group,"KusenSisi_%d" % sign,Vector3(float(sign)*(width*0.5-0.045),height*0.5,0.025),
            Vector3(0.09,height,0.12),"wood",1.1,"frame")
    for sign in [0,1]:
        _box(group,"KusenDatar_%d" % sign,Vector3(0.0,height*float(sign),0.025),
            Vector3(width,0.09,0.12),"wood",1.1,"frame")
    _box(group,"PembagiTengah",Vector3(0.0,height*0.5,0.05),
        Vector3(0.065,height-0.12,0.07),"wood",1.1,"frame")

func _roof() -> void:
    var roof := _group("AtapGenteng")
    roof.set_meta("module_type","roof")
    var radius := WIDTH*0.5+0.52
    var z := DEPTH*0.5+0.54
    for side in [-1,1]:
        var material := _materials["roof"] as Material
        var st := SurfaceTool.new()
        st.begin(Mesh.PRIMITIVE_TRIANGLES)
        var eave := Vector3(float(side)*radius,EAVE_Y,0.0)
        var peak := Vector3(0.0,RIDGE_Y,0.0)
        var a := Vector3(eave.x,eave.y,z)
        var b := Vector3(eave.x,eave.y,-z)
        var c := Vector3(peak.x,peak.y,-z)
        var d := Vector3(peak.x,peak.y,z)
        var normal := (b-a).cross(c-a).normalized()
        _quad(st,a,b,c,d,normal,(z*2.0)/1.2,(peak-eave).length()/1.2)
        var plane := MeshInstance3D.new()
        plane.name = "GentengKiri" if side < 0 else "GentengKanan"
        plane.mesh = st.commit()
        plane.material_override = material
        plane.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
        plane.set_meta("module_type","roof_plane")
        roof.add_child(plane)
    for side in [-1,1]:
        _box(roof,"Listplank_%d" % side,
            Vector3(float(side)*radius,EAVE_Y-0.045,0.0),
            Vector3(0.095,0.14,z*2.0),"wood",1.1,"roof_trim")

func _entry_posts() -> void:
    var porch := _group("TiangTeras")
    for side in [-1,1]:
        _box(porch,"Tiang_%d" % side,
            Vector3(float(side)*3.99,1.87,DEPTH*0.5+0.23),
            Vector3(0.14,3.26,0.14),"wood",1.1,"porch_post")

func _ground_sign() -> void:
    # Ground-mounted (NOT roof-mounted), plain white with black lettering.
    var sign := _group("PapanNamaTanah")
    sign.position = Vector3(3.70,0.0,6.20)
    sign.set_meta("module_type","ground_sign")
    for x in [-1.12,1.12]:
        _box(sign,"TiangPapan",Vector3(x,0.75,0.0),
            Vector3(0.105,1.50,0.105),"white",0.9,"sign_post")
    _box(sign,"PapanPutih",Vector3(0.0,1.53,0.0),
        Vector3(2.48,0.47,0.12),"white",0.85,"sign_board")
    var writing := Label3D.new()
    writing.name = "Tulisan"
    writing.text = "KANTOR DESA\nLEMBAH ASRI"
    writing.font_size = 52
    writing.pixel_size = 0.0038
    writing.modulate = Color("252a28")
    writing.position = Vector3(0.0,1.53,0.082)
    writing.no_depth_test = false
    sign.add_child(writing)
