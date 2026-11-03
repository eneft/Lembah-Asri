extends RefCounted
## V7.2 authored village architecture kit. Reuses the existing painterly
## village_art.gd mesh/UV/normal-map materials, but every village address
## receives a DIFFERENT physical mesh silhouette (not one GLB recolored).
## The user-supplied childhood-house Meshy GLB stays exclusive to its plot.
const ART_KIT := preload("res://scripts/village_art.gd")

# Roof, width ratio, depth ratio, wall height, front porch, annex, stilts,
# front windows. Each design has unique silhouette, proportions AND facade.
const DESIGNS := {
    "rumah_barat_01": ["limasan", 0.76, 0.66, 2.40, "left", "grain", 0.0, 2],
    "rumah_barat_02": ["pelana", 0.72, 0.72, 2.82, "right", "none", 0.0, 1],
    "rumah_barat_03": ["joglo", 0.78, 0.62, 2.48, "full", "side", 0.0, 2],
    "gudang_kebun": ["shed", 0.72, 0.71, 2.62, "none", "grain", 0.0, 0],
    "rumah_desa_01": ["pelana", 0.79, 0.65, 2.45, "full", "side", 0.0, 2],
    "rumah_desa_02": ["joglo", 0.75, 0.76, 2.65, "full", "none", 0.0, 3],
    "rumah_desa_03": ["limasan", 0.70, 0.69, 2.89, "left", "side", 0.0, 1],
    "rumah_desa_04": ["asymmetric", 0.77, 0.73, 2.40, "right", "none", 0.0, 2],
    "rumah_desa_05": ["limasan", 0.81, 0.66, 2.72, "full", "grain", 0.0, 2],
    "rumah_desa_06": ["joglo", 0.69, 0.77, 2.50, "left", "side", 0.0, 1],
    "rumah_desa_07": ["pelana", 0.74, 0.71, 2.98, "right", "grain", 0.0, 3],
    "balai_desa": ["joglo", 0.79, 0.73, 3.16, "public", "none", 0.0, 3],
    "rumah_nelayan_01": ["tin_gable", 0.76, 0.69, 2.37, "jetty", "net", 0.57, 1],
    "rumah_nelayan_02": ["tin_shed", 0.71, 0.75, 2.55, "jetty", "net", 0.79, 2],
    "warung_pesisir": ["warung", 0.82, 0.66, 2.15, "counter", "net", 0.09, 0]
}

var _art: RefCounted
var _materials: Dictionary = {}

func _init() -> void:
    _art = ART_KIT.new()

func _material(kind: String) -> StandardMaterial3D:
    if _materials.has(kind):
        return _materials[kind] as StandardMaterial3D
    var lookup := kind
    if kind == "tin":
        lookup = "stone"
    elif kind == "fishing_wall":
        lookup = "wood"
    elif kind == "fishing_roof":
        lookup = "roof"
    elif kind == "stucco":
        lookup = "plaster"
    var base := _art.call("_material", lookup) as StandardMaterial3D
    var m := base.duplicate() as StandardMaterial3D
    m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
    m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
    m.roughness = 0.94
    m.metallic = 0.0
    if kind == "tin":
        m.albedo_color = Color("ced6d4")
    elif kind == "fishing_wall":
        m.albedo_color = Color("c4d2bd")
    elif kind == "fishing_roof":
        m.albedo_color = Color("c8b7ac")
    elif kind == "stucco":
        m.albedo_color = Color("f5ece0")
    _materials[kind] = m
    return m

func _box(parent: Node3D, name: String, center: Vector3,
          size: Vector3, mat_name: String) -> MeshInstance3D:
    var item := MeshInstance3D.new()
    item.name = name
    var mesh := BoxMesh.new()
    mesh.size = size
    item.mesh = mesh
    item.position = center
    item.material_override = _material(mat_name)
    parent.add_child(item)
    return item

func _panel(parent: Node3D, name: String, points: Array[Vector3],
            mat_name: String) -> void:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var order := [0, 1, 2, 0, 2, 3] if points.size() == 4 else [0, 1, 2]
    var coords := [Vector2.ZERO,Vector2(0,2.0),Vector2(2.0,2.0),Vector2(2.0,0)]
    for idx in order:
        st.set_uv(coords[idx])
        st.add_vertex(points[idx])
    st.generate_normals()
    st.generate_tangents()
    var item := MeshInstance3D.new()
    item.name = name
    item.mesh = st.commit()
    item.material_override = _material(mat_name)
    parent.add_child(item)

func _gable(parent: Node3D, width: float, depth: float,
            eave_y: float, rise: float, mat: String, shift: float = 0.0) -> void:
    var w := width * 0.5 + 0.32
    var d := depth * 0.5 + 0.36
    var peak := shift
    _panel(parent,"GentengPelanaKiri",[
        Vector3(-w,eave_y,-d), Vector3(-w,eave_y,d),
        Vector3(peak,eave_y+rise,d), Vector3(peak,eave_y+rise,-d)],mat)
    _panel(parent,"GentengPelanaKanan",[
        Vector3(peak,eave_y+rise,-d), Vector3(peak,eave_y+rise,d),
        Vector3(w,eave_y,d), Vector3(w,eave_y,-d)],mat)
    for side in [-1.0,1.0]:
        _panel(parent,"GununganSegitiga",[
            Vector3(-w+0.25,eave_y,side*(d-0.15)),
            Vector3(w-0.25,eave_y,side*(d-0.15)),
            Vector3(peak,eave_y+rise-0.1,side*(d-0.15))],"stucco")
    _box(parent,"BubunganGenteng",Vector3(peak,eave_y+rise,-0.0),
        Vector3(0.13,0.12,depth+0.85),mat)

func _hip(parent: Node3D, width: float, depth: float,
          eave_y: float, rise: float, mat: String, ridge: float = 0.30) -> void:
    var w := width*0.5+0.38
    var d := depth*0.5+0.42
    var rw := width*ridge
    var upper := eave_y+rise
    _panel(parent,"LimasanDepan",[
        Vector3(-w,eave_y,d),Vector3(w,eave_y,d),
        Vector3(rw,upper,0.0),Vector3(-rw,upper,0.0)],mat)
    _panel(parent,"LimasanBelakang",[
        Vector3(w,eave_y,-d),Vector3(-w,eave_y,-d),
        Vector3(-rw,upper,0.0),Vector3(rw,upper,0.0)],mat)
    _panel(parent,"LimasanKiri",[
        Vector3(-w,eave_y,-d),Vector3(-w,eave_y,d),
        Vector3(-rw,upper,0.0)],mat)
    _panel(parent,"LimasanKanan",[
        Vector3(w,eave_y,d),Vector3(w,eave_y,-d),
        Vector3(rw,upper,0.0)],mat)
    _box(parent,"BubunganLimasan",Vector3(0.0,upper,0.0),
        Vector3(rw*2.0+0.1,0.10,0.15),mat)

func _shed(parent: Node3D, width: float, depth: float,
           y: float, mat: String, backwards: bool = false) -> void:
    var w := width*0.5+0.38
    var d := depth*0.5+0.44
    var first := y + (0.48 if backwards else 0.05)
    var last := y + (0.05 if backwards else 0.48)
    _panel(parent,"AtapMiringSatuBidang",[
        Vector3(-w,first,-d),Vector3(-w,last,d),
        Vector3(w,last,d),Vector3(w,first,-d)],mat)
    for i in range(4):
        var x := lerpf(-w+0.17,w-0.17,float(i)/3.0)
        _box(parent,"RengAtapMiring",Vector3(x,y+0.24,0.0),
            Vector3(0.075,0.09,depth+0.85),"wood_dark")

func _roof(parent: Node3D, style: String, w: float, d: float,
           top: float, kind: String) -> void:
    var roof_mat := "fishing_roof" if kind == "fishing" else "roof"
    if style == "pelana":
        _gable(parent,w,d,top+0.08,1.05,roof_mat)
    elif style == "asymmetric":
        _gable(parent,w,d,top+0.06,0.84,roof_mat,w*0.18)
    elif style == "limasan":
        _hip(parent,w,d,top+0.13,1.15,roof_mat,0.23)
    elif style == "joglo":
        _hip(parent,w,d,top-0.08,0.83,roof_mat,0.24)
        # Distinctive small upper tier characteristic of Javanese joglo.
        _hip(parent,w*0.56,d*0.58,top+0.58,0.86,roof_mat,0.19)
        for x in [-w*0.36,w*0.36]:
            for z in [-d*0.37,d*0.37]:
                _box(parent,"SakaGuruJoglo",Vector3(x,top*0.54,z),
                    Vector3(0.16,top*0.91,0.16),"wood")
    elif style == "shed":
        _shed(parent,w,d,top+0.17,"tin",true)
    elif style == "tin_shed":
        _shed(parent,w,d,top+0.17,"tin")
    elif style == "tin_gable":
        _gable(parent,w,d,top+0.08,0.67,"tin")
    elif style == "warung":
        _shed(parent,w*1.13,d*1.15,top+0.37,"tin",true)

func _windows(parent: Node3D, width: float, depth: float,
              height: float, lift: float, count: int, index: int) -> void:
    var z := depth*0.5+0.044
    for i in range(count):
        var x := (float(i)-float(count-1)*0.5)*width/maxf(2.8,float(count)+0.8)
        if absf(x) < 0.95 and count > 1:
            x += 0.35 if i%2==0 else -0.35
        _box(parent,"Jendela_"+str(i),
            Vector3(x,lift+height*0.57,z),
            Vector3(0.77,0.85,0.08),"wood_dark")
        _box(parent,"KacaJendela_"+str(i),
            Vector3(x,lift+height*0.57,z+0.052),
            Vector3(0.60,0.68,0.06),"leaf_dark")
        if index%3==1:
            _box(parent,"KisiJendela_"+str(i),
                Vector3(x,lift+height*0.57,z+0.09),
                Vector3(0.075,0.68,0.08),"wood")
    for side in [-1.0,1.0]:
        var side_z := depth*(0.07 if index%2==0 else -0.07)
        _box(parent,"JendelaSamping",Vector3(side*width*0.5+side*0.045,
            lift+height*0.62,side_z),Vector3(0.075,0.78,0.86),"wood_dark")
        _box(parent,"KacaSamping",Vector3(side*width*0.5+side*0.09,
            lift+height*0.62,side_z),Vector3(0.06,0.61,0.69),"leaf_dark")

func _porch(parent: Node3D, kind: String, porch: String,
            width: float, depth: float, wall: float, lift: float) -> void:
    if porch == "none":
        return
    var pw := width*(0.95 if porch in ["full","public"] else 0.54)
    var px := 0.0
    if porch == "left":
        px = -width*0.19
    elif porch == "right":
        px = width*0.19
    elif porch == "jetty":
        pw = width*0.82
    elif porch == "counter":
        pw = width*0.94
    var front := depth*0.5+0.57
    var length := 1.2 if porch in ["full","public","jetty"] else 0.9
    _box(parent,"LantaiTeras",Vector3(px,lift+0.09,front),
        Vector3(pw,0.18,length),"wood" if kind=="fishing" else "stone")
    var roof_h := lift+wall*0.88
    _panel(parent,"KanopiTeras",[
        Vector3(px-pw*0.54,roof_h+0.17,depth*0.5-0.1),
        Vector3(px-pw*0.54,roof_h-0.23,depth*0.5+length+0.15),
        Vector3(px+pw*0.54,roof_h-0.23,depth*0.5+length+0.15),
        Vector3(px+pw*0.54,roof_h+0.17,depth*0.5-0.1)],
        "tin" if kind=="fishing" else "roof")
    for side in [-1.0,1.0]:
        _box(parent,"TiangTeras",Vector3(px+side*pw*0.45,
            lift+roof_h*0.45,depth*0.5+length+0.02),
            Vector3(0.13,maxf(1.05,roof_h-lift-0.18),0.13),"wood")
    if porch=="public":
        _box(parent,"PapanBalai",Vector3(0.0,lift+wall*0.75,
            depth*0.5+length+0.07),Vector3(2.70,0.43,0.09),"old_plaster")
    if porch=="counter":
        _box(parent,"MejaWarung",Vector3(px,lift+0.92,depth*0.5+length),
            Vector3(pw*0.86,0.19,0.69),"wood_dark")

func _annex(parent: Node3D, annex: String, width: float,
            depth: float, lift: float, top: float, kind: String) -> void:
    if annex=="none":
        return
    if annex in ["grain","side"]:
        var wing := Node3D.new()
        wing.name = "PaviliunSamping"
        wing.position = Vector3(width*0.56,0.0,depth*-0.12)
        parent.add_child(wing)
        var d := depth*0.52
        var h := top*0.61
        _box(wing,"DindingSayap",Vector3(0.0,lift+h*0.5,0.0),
            Vector3(1.3,h,d),"wood" if annex=="grain" else "stucco")
        _shed(wing,1.3,d,lift+h+0.11,
            "tin" if annex=="grain" else "roof",annex=="grain")
    elif annex=="net":
        for i in range(6):
            var x := width*0.46
            _box(parent,"RakJaringNelayan",Vector3(x,lift+0.6,
                -depth*0.26+i*0.17),Vector3(0.08,1.20,0.07),"wood")
        _box(parent,"RakJaringAtas",Vector3(width*0.46,lift+1.22,
            -depth*0.26+0.42),Vector3(0.11,0.10,1.2),"wood_dark")

func build_unique(parent: Node3D, label: String, kind: String,
                  foot: Vector2) -> Dictionary:
    if not DESIGNS.has(label):
        push_error("V7.2 ARCHITECTURE FAIL: no distinct authored mesh for "+label)
        return {}
    var spec: Array = DESIGNS[label]
    var roof_style := str(spec[0])
    var width := foot.x*float(spec[1])
    var depth := foot.y*float(spec[2])
    var wall := float(spec[3])
    var porch := str(spec[4])
    var annex := str(spec[5])
    var lift := float(spec[6])
    var windows := int(spec[7])
    var index := DESIGNS.keys().find(label)
    var mesh_root := Node3D.new()
    mesh_root.name = "UniqueVillageMesh"
    parent.add_child(mesh_root)
    var wall_material := "fishing_wall" if kind=="fishing" else ("old_plaster" if kind=="farm" else "stucco")
    _box(mesh_root,"PondasiBatu",Vector3(0,0.07,0),
        Vector3(width+0.25,0.16,depth+0.20),"stone")
    if lift > 0.32:
        for x in [-width*0.43,width*0.43]:
            for z in [-depth*0.42,depth*0.42]:
                _box(mesh_root,"UmpakPanggung",Vector3(x,lift*0.5,z),
                    Vector3(0.28,lift+0.03,0.28),"wood_dark")
        _box(mesh_root,"LantaiPanggung",Vector3(0,lift-0.06,0),
            Vector3(width+0.14,0.18,depth+0.10),"wood")
    _box(mesh_root,"DindingBangunan",Vector3(0,lift+wall*0.5,0),
        Vector3(width,wall,depth),wall_material)
    _roof(mesh_root,roof_style,width,depth,lift+wall,kind)
    var door_x := -width*0.18 if index%3==0 else (width*0.16 if index%3==1 else 0.0)
    _box(mesh_root,"PintuUkir",Vector3(door_x,lift+wall*0.42,
        depth*0.5+0.066),Vector3(0.94,wall*0.73,0.13),"wood_dark")
    _box(mesh_root,"AmbangPintu",Vector3(door_x,lift+wall*0.79,
        depth*0.5+0.105),Vector3(1.09,0.12,0.16),"wood")
    _windows(mesh_root,width,depth,wall,lift,windows,index)
    _porch(mesh_root,kind,porch,width,depth,wall,lift)
    _annex(mesh_root,annex,width,depth,lift,wall,kind)
    # Building identities must not be metadata-only. These values drive real
    # mesh vertex/box dimensions, roof shape and window topology for each lot.
    var signature := "%s:%.3f:%.3f:%.3f:%s:%s:%.2f:%d" % [
        roof_style,width,depth,wall,porch,annex,lift,windows]
    mesh_root.set_meta("architecture_signature",signature)
    mesh_root.set_meta("roof_style",roof_style)
    mesh_root.set_meta("texture_source","village_art painterly atlas+normal")
    return {"body_dimensions":Vector3(width*0.96,wall+lift,depth*0.96),
            "signature":signature,"profile":roof_style}
