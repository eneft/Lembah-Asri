extends RefCounted
## V7.2 authored village architecture kit. Reuses the existing painterly
## village_art.gd mesh/UV/normal-map materials, but every village address
## receives a DIFFERENT physical mesh silhouette (not one GLB recolored).
## The user-supplied childhood-house Meshy GLB stays exclusive to its plot.
const ART_KIT := preload("res://scripts/village_art.gd")
# All building measurements below use real Godot meters, with the
# protagonist 1.68m tall. Keep the 17 zoning plots unchanged: a plot
# reserves walkable yard, it is NOT the physical footprint of a building.
const ADULT_HEIGHT_M := 1.68
const DOOR_CLEAR_HEIGHT_M := 2.16
const MIN_PORCH_HEADROOM_M := 2.14

# Roof, width ratio, depth ratio, wall height, front porch, annex, stilts,
# front windows. Each design has unique silhouette, proportions AND facade.
const DESIGNS := {
    # label: [roof, plot-width factor, plot-depth factor, eave/wall height,
    #         porch style, wing, raised-floor height, window count]
    # V8.2 human scale: original footprints stay within their allotted plots.
    # Raise EAVES/WALLS rather than widening houses into paths or moving plots.
    # A 168 cm avatar should have ~0.48-0.62 m visible headroom at the door.
    "rumah_barat_01": ["limasan", 0.69, 0.70, 2.98, "left", "grain", 0.0, 2],
    "rumah_barat_02": ["pelana", 0.66, 0.71, 3.01, "right", "none", 0.0, 1],
    "rumah_barat_03": ["joglo", 0.72, 0.67, 3.10, "full", "side", 0.0, 2],
    "gudang_kebun": ["shed", 0.67, 0.70, 2.79, "none", "grain", 0.0, 0],
    "rumah_desa_01": ["pelana", 0.70, 0.70, 3.00, "full", "side", 0.0, 2],
    "rumah_desa_02": ["joglo", 0.69, 0.69, 3.14, "full", "none", 0.0, 3],
    "rumah_desa_03": ["limasan", 0.68, 0.69, 3.04, "left", "side", 0.0, 1],
    "rumah_desa_04": ["asymmetric", 0.67, 0.70, 2.98, "right", "none", 0.0, 2],
    "rumah_desa_05": ["limasan", 0.70, 0.68, 3.05, "full", "grain", 0.0, 2],
    "rumah_desa_06": ["joglo", 0.71, 0.68, 3.13, "left", "side", 0.0, 1],
    "rumah_desa_07": ["pelana", 0.68, 0.69, 3.09, "right", "grain", 0.0, 3],
    "balai_desa": ["joglo", 0.76, 0.71, 3.64, "public", "none", 0.0, 3],
    "rumah_nelayan_01": ["tin_gable", 0.71, 0.75, 3.12, "jetty", "net", 0.57, 1],
    "rumah_nelayan_02": ["tin_shed", 0.68, 0.74, 3.12, "jetty", "net", 0.79, 2],
    "warung_pesisir": ["warung", 0.70, 0.72, 3.07, "counter", "net", 0.09, 0]
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
    elif kind == "roof_edge":
        lookup = "roof_edge"
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
    elif kind == "roof_edge":
        m.albedo_color = Color("f6e4d0")
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

# Decorative edge rails only. No collision geometry or extra script physics.
func _roof_rail(parent: Node3D, label: String,
                start: Vector3, finish: Vector3, radius: float,
                paint: String) -> void:
    var direction := finish - start
    if direction.length() < 0.001:
        return
    var rail := MeshInstance3D.new()
    rail.name = label
    var mesh := CylinderMesh.new()
    mesh.height = direction.length()
    mesh.top_radius = radius
    mesh.bottom_radius = radius * 1.04
    mesh.radial_segments = 6
    rail.mesh = mesh
    rail.material_override = _material(paint)
    rail.position = (start+finish)*0.5
    rail.quaternion = Quaternion(Vector3.UP,direction.normalized())
    rail.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    parent.add_child(rail)

# A small batched mesh of roof clay-tile relief marks, not hundreds of
# objects. The illustrated pigment comes from the shared 192px atlas.
func _tile_ribbons(parent: Node3D, width: float, depth: float,
                   eave_y: float, rise: float, peak: float) -> void:
    var half_w := width*0.5+0.32
    var half_d := depth*0.5+0.36
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    for side in range(2):
        for row in range(1,8):
            var t := float(row)/8.0
            var x := lerpf(-half_w,peak,t) if side==0 else lerpf(peak,half_w,t)
            var y := eave_y + (rise*t if side==0 else rise*(1.0-t)) + 0.052
            var thickness := 0.024
            var p := [
                Vector3(x-thickness,y,-half_d+0.04),
                Vector3(x+thickness,y,-half_d+0.04),
                Vector3(x+thickness,y,half_d-0.04),
                Vector3(x-thickness,y,half_d-0.04)]
            for i in [0,1,2,0,2,3]:
                st.set_uv(Vector2(float(i%3)*0.25,t))
                st.add_vertex(p[i])
    st.generate_normals()
    var stripes := MeshInstance3D.new()
    stripes.name = "GentengSapuanBertingkat"
    stripes.mesh = st.commit()
    stripes.material_override = _material("roof_edge")
    stripes.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    parent.add_child(stripes)

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
    _tile_ribbons(parent,width,depth,eave_y,rise,peak)
    _roof_rail(parent,"LisTepiGentengKiri",
        Vector3(-w,eave_y,-d),Vector3(-w,eave_y,d),0.055,"wood")
    _roof_rail(parent,"LisTepiGentengKanan",
        Vector3(w,eave_y,-d),Vector3(w,eave_y,d),0.055,"wood")

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
    for side in [-1.0,1.0]:
        for far in [-1.0,1.0]:
            _roof_rail(parent,"LisSudutLimasan",
                Vector3(side*w,eave_y,far*d),
                Vector3(side*rw,upper,0.0),0.042,"roof_edge")

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
    _roof_rail(parent,"LisTepiAtapMiringDepan",
        Vector3(-w,last,d),Vector3(w,last,d),0.042,"wood")
    _roof_rail(parent,"LisTepiAtapMiringBelakang",
        Vector3(-w,first,-d),Vector3(w,first,-d),0.042,"wood")

func _roof(parent: Node3D, style: String, w: float, d: float,
           top: float, kind: String) -> void:
    var roof_mat := "fishing_roof" if kind == "fishing" else "roof"
    if style == "pelana":
        _gable(parent,w,d,top+0.08,1.22,roof_mat)
    elif style == "asymmetric":
        _gable(parent,w,d,top+0.06,1.03,roof_mat,w*0.18)
    elif style == "limasan":
        _hip(parent,w,d,top+0.13,1.27,roof_mat,0.23)
    elif style == "joglo":
        _hip(parent,w,d,top-0.08,0.95,roof_mat,0.24)
        # The public hall gets a genuinely taller tier, not a giant scaling
        # transform that would push porches and footprint into nearby lanes.
        var upper_offset := 0.90 if kind=="public" else 0.64
        var upper_rise := 1.26 if kind=="public" else 0.98
        _hip(parent,w*0.56,d*0.58,top+upper_offset,upper_rise,roof_mat,0.19)
        for x in [-w*0.36,w*0.36]:
            for z in [-d*0.37,d*0.37]:
                var pillar_h := top*1.16 if kind=="public" else top*0.95
                _box(parent,"SakaGuruJoglo",Vector3(x,0.05+pillar_h*0.5,z),
                    Vector3(0.16,pillar_h,0.16),"wood")
    elif style == "shed":
        _shed(parent,w,d,top+0.17,"tin",true)
    elif style == "tin_shed":
        _shed(parent,w,d,top+0.17,"tin")
    elif style == "tin_gable":
        _gable(parent,w,d,top+0.08,0.84,"tin")
    elif style == "warung":
        _shed(parent,w*1.13,d*1.15,top+0.37,"tin",true)

func _windows(parent: Node3D, width: float, depth: float,
              height: float, lift: float, count: int, index: int,
              door_x: float) -> void:
    var z := depth*0.5+0.044
    # V8.2 human-scale readable windows: ~0.85 x 1.13m, 1.04m sill.
    # Use four potential positions so no windows overlap the actual door
    # even on the smaller 5.5m village facades.
    var candidates := [-width*0.38,-width*0.23,width*0.23,width*0.38]
    var placed := 0
    for x in candidates:
        if placed >= count:
            break
        if absf(x-door_x) < 1.07:
            continue
        _box(parent,"Jendela_"+str(placed),
            Vector3(x,lift+1.61,z),
            Vector3(0.85,1.13,0.08),"wood_dark")
        _box(parent,"KacaJendela_"+str(placed),
            Vector3(x,lift+1.61,z+0.052),
            Vector3(0.67,0.94,0.06),"glass")
        _box(parent,"AmbangJendela_"+str(placed),
            Vector3(x,lift+1.00,z+0.10),
            Vector3(1.01,0.085,0.18),"wood")
        if index%3==1:
            _box(parent,"KisiJendela_"+str(placed),
                Vector3(x,lift+1.61,z+0.09),
                Vector3(0.075,0.94,0.08),"wood")
        placed += 1
    for side in [-1.0,1.0]:
        var side_z := depth*(0.07 if index%2==0 else -0.07)
        _box(parent,"JendelaSamping",Vector3(side*width*0.5+side*0.045,
            lift+1.61,side_z),Vector3(0.075,1.12,0.86),"wood_dark")
        _box(parent,"KacaSamping",Vector3(side*width*0.5+side*0.09,
            lift+1.61,side_z),Vector3(0.06,0.90,0.68),"glass")

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
    # The V7.2 edge dipped close to an adult's head. Floor-to-canopy
    # front clearance now >= 2.14m above raised porch floor.
    var roof_h := lift+maxf(MIN_PORCH_HEADROOM_M+0.40,wall-0.06)
    _panel(parent,"KanopiTeras",[
        Vector3(px-pw*0.54,roof_h+0.17,depth*0.5-0.1),
        Vector3(px-pw*0.54,roof_h-0.18,depth*0.5+length+0.15),
        Vector3(px+pw*0.54,roof_h-0.18,depth*0.5+length+0.15),
        Vector3(px+pw*0.54,roof_h+0.17,depth*0.5-0.1)],
        "tin" if kind=="fishing" else "roof")
    var post_height := roof_h-lift-0.18
    for side in [-1.0,1.0]:
        _box(parent,"TiangTeras",Vector3(px+side*pw*0.45,
            lift+0.05+post_height*0.5,depth*0.5+length+0.02),
            Vector3(0.13,post_height,0.13),"wood")
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
    var walls := _box(mesh_root,"DindingBangunan",Vector3(0,lift+wall*0.5,0),
        Vector3(width,wall,depth),wall_material)
    # Muted limewash variations retain the hand-painted shared albedo+normal.
    var plaster_tints := [
        Color("fff4e7"),Color("e6ede0"),Color("f8e5da"),
        Color("f4e9d7"),Color("e6e8d8"),Color("f1e2c9")
    ]
    var wall_paint := (walls.material_override as StandardMaterial3D).duplicate() as StandardMaterial3D
    wall_paint.albedo_color *= plaster_tints[index%plaster_tints.size()]
    walls.material_override = wall_paint
    _roof(mesh_root,roof_style,width,depth,lift+wall,kind)
    # Little fascia details make even shaded silhouettes read as crafted
    # Javanese houses. All these additions are MESH ONLY, not colliders.
    if kind!="fishing":
        _box(mesh_root,"LisPlintDindingDepan",
            Vector3(0.0,lift+0.24,depth*0.5+0.055),
            Vector3(width-0.12,0.13,0.09),"stone")
    for side in [-1.0,1.0]:
        _box(mesh_root,"KusenSudutDepan",
            Vector3(side*(width*0.5-0.09),lift+wall*0.5,depth*0.5+0.059),
            Vector3(0.11,wall*0.93,0.12),"wood")
    var roof_tints := [
        Color("fae2cf"),Color("e8e1d7"),Color("f4ead6"),
        Color("e4d6cb"),Color("f0dec8"),Color("eee7d4")
    ]
    for item in mesh_root.get_children():
        var roof_mesh := item as MeshInstance3D
        if roof_mesh == null or roof_mesh.mesh == null:
            continue
        var mesh_name: String = str(roof_mesh.name)
        if mesh_name.begins_with("Genteng") or mesh_name.begins_with("Limasan") or mesh_name.begins_with("AtapMiringSatuBidang") or mesh_name.begins_with("Bubungan"):
            var original_roof := roof_mesh.material_override as StandardMaterial3D
            if original_roof != null:
                var tinted := original_roof.duplicate() as StandardMaterial3D
                tinted.albedo_color *= roof_tints[index%roof_tints.size()]
                roof_mesh.material_override = tinted
    var door_x := -width*0.12 if index%3==0 else (width*0.12 if index%3==1 else 0.0)
    # Preserve actual human height independently of the taller eaves:
    # 2.16m dwelling, 2.18m fishing/warung, 2.30m balai public entrance,
    # 2.10m storage. A taller wall must NOT accidentally become a 2.9m door.
    var target_door_height := 2.30 if kind=="public" else (2.18 if kind=="fishing" else (2.10 if kind=="farm" else DOOR_CLEAR_HEIGHT_M))
    var door_height := minf(wall-0.30,target_door_height)
    var door_width := 1.26 if kind=="public" else (1.03 if kind=="fishing" else 0.96)
    _box(mesh_root,"PintuUkir",Vector3(door_x,lift+0.04+door_height*0.5,
        depth*0.5+0.066),Vector3(door_width,door_height,0.13),"wood_dark")
    _box(mesh_root,"AmbangPintu",Vector3(door_x,lift+door_height+0.07,
        depth*0.5+0.105),Vector3(door_width+0.15,0.08,0.16),"wood")
    _windows(mesh_root,width,depth,wall,lift,windows,index,door_x)
    _porch(mesh_root,kind,porch,width,depth,wall,lift)
    _annex(mesh_root,annex,width,depth,lift,wall,kind)
    # Building identities must not be metadata-only. These values drive real
    # mesh vertex/box dimensions, roof shape and window topology for each lot.
    var signature := "%s:%.3f:%.3f:%.3f:%s:%s:%.2f:%d" % [
        roof_style,width,depth,wall,porch,annex,lift,windows]
    mesh_root.set_meta("architecture_signature",signature)
    mesh_root.set_meta("roof_style",roof_style)
    mesh_root.set_meta("texture_source","village_art handpainted plaster, wood and roof atlas+normal V7.7")
    mesh_root.set_meta("visual_polish_version","V7.7")
    mesh_root.set_meta("human_reference_height_m",ADULT_HEIGHT_M)
    mesh_root.set_meta("proportion_revision","V8.2")
    mesh_root.set_meta("actual_width_m",width)
    mesh_root.set_meta("actual_depth_m",depth)
    mesh_root.set_meta("wall_height_m",wall)
    mesh_root.set_meta("door_height_m",door_height)
    mesh_root.set_meta("floor_elevation_m",lift)
    return {"body_dimensions":Vector3(width*0.96,wall+lift,depth*0.96),
            "actual_footprint":Vector2(width,depth),
            "signature":signature,"profile":roof_style}
