extends Node3D
## Load the same Mixamo/tripo character ONCE, then share four imported clips.
## FBX binaries are intentionally NOT embedded into GDScript.
## Paths are case-sensitive on GitHub Pages / Linux.
const SOURCES := {
    "idle": "res://assets/character/fbx/Orc Idle.fbx",
    "walk": "res://assets/character/fbx/Walking.fbx",
    "run": "res://assets/character/fbx/Running (3).fbx",
    "jump": "res://assets/character/fbx/Jump Over.fbx"
}
const CLIPS := ["idle", "walk", "run", "jump"]
const TARGET_HEIGHT := 1.78

var animator: AnimationPlayer
var model_root: Node3D
var current_state := ""
var loaded_clips: Dictionary = {}
var warnings: PackedStringArray = []
const AIR_START := 0.42
const AIR_APEX := 1.10
const AIR_CONTACT := 1.65
var landing_left := 0.0
var base_model_y := 0.0
var idle_foot_y := 0.0
var feet: Array[int] = []
var motion_skeleton: Skeleton3D


func _ready() -> void:
    process_priority = 100 # Place feet after AnimationPlayer evaluates the rendered pose.
    _load_character()

func _process(_delta: float) -> void:
    if current_state == "land" and model_root != null:
        model_root.position.y = base_model_y
        model_root.position.y += idle_foot_y - _lowest_foot()

func _find_animation_player(node: Node) -> AnimationPlayer:
    if node is AnimationPlayer:
        return node as AnimationPlayer
    for sub in node.find_children("*", "AnimationPlayer", true, false):
        return sub as AnimationPlayer
    return null

func _choose_clip(player: AnimationPlayer) -> Animation:
    if player == null:
        return null
    for clip_name in player.get_animation_list():
        if str(clip_name).to_upper().find("RESET") != -1:
            continue
        var clip: Animation = player.get_animation(clip_name)
        if clip != null and clip.length > 0.0:
            return clip
    return null

func _load_character() -> void:
    if not ResourceLoader.exists(SOURCES["idle"]):
        warnings.append("Orc Idle.fbx belum ada di repository")
        print("LEMBAH FBX PENDING: upload all four FBX files into blockout3d/assets/character/fbx/")
        return

    var source: Resource = load(SOURCES["idle"])
    if not (source is PackedScene):
        warnings.append("FBX idle gagal diimpor sebagai PackedScene")
        return
    model_root = (source as PackedScene).instantiate() as Node3D
    if model_root == null:
        warnings.append("Root FBX idle tidak bertipe Node3D")
        return
    model_root.name = "SingleImportedMixamoModel"
    add_child(model_root)
    animator = _find_animation_player(model_root)
    if animator == null:
        warnings.append("AnimationPlayer tidak ditemukan dalam Orc Idle.fbx")
        return

    var idle_reference := _choose_clip(animator)
    var library := AnimationLibrary.new()
    for state in CLIPS:
        var imported_scene: Node3D = null
        var imported_player: AnimationPlayer = animator
        if state != "idle":
            if not ResourceLoader.exists(SOURCES[state]):
                warnings.append(SOURCES[state] + " belum ada")
                continue
            var imported_resource: Resource = load(SOURCES[state])
            if not (imported_resource is PackedScene):
                warnings.append(SOURCES[state] + " bukan PackedScene")
                continue
            imported_scene = (imported_resource as PackedScene).instantiate() as Node3D
            if imported_scene == null:
                warnings.append("Root invalid: " + state)
                continue
            imported_player = _find_animation_player(imported_scene)
        if imported_player == null:
            warnings.append("AnimationPlayer hilang: " + state)
        else:
            var clip: Animation = _choose_clip(imported_player)
            if clip == null:
                warnings.append("Animasi tidak ditemukan: " + state)
            else:
                if imported_player != animator and imported_player.root_node != animator.root_node:
                    warnings.append("Periksa root path animasi: " + state)
                var clean_clip: Animation = clip.duplicate(true) as Animation
                _anchor_motion_roots(clean_clip, idle_reference, state == "jump")
                clean_clip.loop_mode = Animation.LOOP_NONE if state == "jump" else Animation.LOOP_LINEAR
                var err := library.add_animation(state, clean_clip)
                if err == OK:
                    loaded_clips[state] = true
                else:
                    warnings.append("Gagal menambahkan animasi: " + state)
        if imported_scene != null:
            imported_scene.free()

    if library.get_animation_list().size() == 0:
        return
    if animator.add_animation_library("lembah", library) != OK:
        warnings.append("Gagal menggabungkan AnimationLibrary")
        return
    var landing := _landing_tail(library.get_animation("jump"))
    library.add_animation("land", landing)
    _fit_single_model_to_player()
    base_model_y = model_root.position.y
    animator.play("lembah/idle")
    animator.advance(0.0)
    for node in model_root.find_children("*", "Skeleton3D", true, false):
        motion_skeleton = node as Skeleton3D
        for bone_name in ["mixamorig_LeftFoot", "mixamorig_RightFoot"]:
            var bone := motion_skeleton.find_bone(bone_name)
            if bone >= 0:
                feet.append(bone)
        break
    idle_foot_y = _lowest_foot()

    var placeholder := get_parent().get_node_or_null("Placeholder")
    if placeholder != null:
        placeholder.hide()
    play_state("idle")
    print("LEMBAH FBX ACTIVE: one skinned model; clips=", loaded_clips.keys(), " warnings=", warnings)

func _fit_single_model_to_player() -> void:
    # Determine scale ONCE from the idle mesh. Never change scale on state transitions.
    var low := INF
    var high := -INF
    for node in model_root.find_children("*", "MeshInstance3D", true, false):
        var mesh: MeshInstance3D = node as MeshInstance3D
        var aabb := mesh.get_aabb()
        if aabb.size.length_squared() < 0.00001:
            continue
        for i in range(8):
            var corner := aabb.position + Vector3(
                aabb.size.x if (i & 1) != 0 else 0.0,
                aabb.size.y if (i & 2) != 0 else 0.0,
                aabb.size.z if (i & 4) != 0 else 0.0)
            var p: Vector3 = model_root.to_local(mesh.to_global(corner))
            low = minf(low, p.y)
            high = maxf(high, p.y)
    if low == INF or high - low < 0.1:
        warnings.append("Bounds model tidak valid; skala import dipertahankan")
        return
    var s := clampf(TARGET_HEIGHT / (high - low), 0.005, 25.0)
    model_root.scale = Vector3.ONE * s
    model_root.position.y = -low * s

func is_model_ready() -> bool:
    return model_root != null and animator != null and loaded_clips.size() == 4

func play_state(next_state: String) -> void:
    if animator == null:
        return
    if next_state != "land" and not loaded_clips.has(next_state):
        next_state = "idle"
    if (next_state != "land" and not loaded_clips.has(next_state)) or current_state == next_state:
        return
    current_state = next_state
    # Jump Over is 1.933 seconds; speed it up to match ~0.9s physical airtime.
    var playback_speed := 2.05 if next_state == "jump" else 1.0
    animator.play("lembah/" + next_state, 0.18 if current_state != "jump" else 0.08, playback_speed)

func _anchor_motion_roots(clip: Animation, idle_reference: Animation, jumping: bool) -> void:
    # CharacterBody3D owns world travel. Mixamo Jump Over contains forward hip motion.
    # Anchor only skeleton root translation; retain every limb rotation/translation.
    var roots: Array[String] = []
    for node in model_root.find_children("*", "Skeleton3D", true, false):
        var skeleton := node as Skeleton3D
        for bone in range(skeleton.get_bone_count()):
            if skeleton.get_bone_parent(bone) == -1:
                roots.append(skeleton.get_bone_name(bone))
    for track in range(clip.get_track_count()):
        if clip.track_get_type(track) != Animation.TYPE_POSITION_3D:
            continue
        var path := clip.track_get_path(track)
        if path.get_subname_count() != 1 or str(path.get_subname(0)) not in roots:
            continue
        var idle_track := idle_reference.find_track(path, Animation.TYPE_POSITION_3D)
        if idle_track < 0 or idle_reference.track_get_key_count(idle_track) == 0:
            continue
        var anchor: Vector3 = idle_reference.track_get_key_value(idle_track, 0)
        for key in range(clip.track_get_key_count(track)):
            var position: Vector3 = clip.track_get_key_value(track, key)
            position.x = anchor.x
            position.z = anchor.z
            # The physical jump supplies height, avoiding a second animated leap.
            if jumping:
                position.y = anchor.y
            clip.track_set_key_value(track, key, position)

func _landing_tail(source: Animation) -> Animation:
    var landing := source.duplicate(true) as Animation
    landing.length = source.length - AIR_CONTACT
    landing.loop_mode = Animation.LOOP_NONE
    for track in range(landing.get_track_count()):
        var kind := source.track_get_type(track)
        var contact: Variant
        if kind == Animation.TYPE_POSITION_3D:
            contact = source.position_track_interpolate(track, AIR_CONTACT)
        elif kind == Animation.TYPE_ROTATION_3D:
            contact = source.rotation_track_interpolate(track, AIR_CONTACT)
        elif kind == Animation.TYPE_SCALE_3D:
            contact = source.scale_track_interpolate(track, AIR_CONTACT)
        else:
            continue
        for key in range(landing.track_get_key_count(track) - 1, -1, -1):
            landing.track_remove_key(track, key)
        landing.track_insert_key(track, 0.0, contact)
        for key in range(source.track_get_key_count(track)):
            var time := source.track_get_key_time(track, key)
            if time > AIR_CONTACT:
                landing.track_insert_key(track, time - AIR_CONTACT, source.track_get_key_value(track, key))
    return landing

func _lowest_foot() -> float:
    if motion_skeleton == null or feet.is_empty():
        return 0.0
    motion_skeleton.force_update_all_bone_transforms()
    var lowest := INF
    for bone in feet:
        var point := motion_skeleton.to_global(motion_skeleton.get_bone_global_pose(bone).origin)
        lowest = minf(lowest, to_local(point).y)
    return lowest

func update_motion(state: String, vertical_speed: float, landed: bool, impact_speed: float, delta: float) -> void:
    if animator == null:
        return
    if state == "jump":
        landing_left = 0.0
        play_state("jump")
        animator.pause()
        var phase := clampf(1.0 - vertical_speed / 8.6, 0.0, 2.0)
        var sample := lerpf(AIR_START, AIR_APEX, phase) if phase <= 1.0 else lerpf(AIR_APEX, AIR_CONTACT, phase - 1.0)
        animator.seek(sample, true)
        # Ease the feet towards the contact plane during the final descent.
        var contact_weight := smoothstep(1.30, AIR_CONTACT, sample)
        model_root.position.y = base_model_y
        model_root.position.y += (idle_foot_y - _lowest_foot()) * contact_weight
        return
    if landed and impact_speed > 2.0:
        play_state("land")
        animator.speed_scale = 1.0
        landing_left = animator.get_animation("lembah/land").length
    if landing_left > 0.0:
        landing_left = maxf(0.0, landing_left - delta)
        model_root.position.y = base_model_y
        model_root.position.y += idle_foot_y - _lowest_foot()
        return
    play_state(state)
    model_root.position.y = lerpf(model_root.position.y, base_model_y, 1.0 - exp(-18.0 * delta))
