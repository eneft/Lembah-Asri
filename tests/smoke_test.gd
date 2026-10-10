extends SceneTree
## Import and run a genuine 2D world, move player and trigger NPC interaction.
var failed: bool = false

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var packed := load("res://scenes/world_2d.tscn") as PackedScene
    if packed == null:
        push_error("SMOKE FAIL: 2D scene missing")
        quit(1)
        return
    var world := packed.instantiate()
    root.add_child(world)
    await process_frame
    await process_frame
    var scene_sprite = world.get_node_or_null("ConceptArtwork2D")
    if scene_sprite == null or not scene_sprite is Sprite2D:
        push_error("SMOKE FAIL: 2D scene lacks explicit texture-linked artwork node")
        failed = true
    if not world.art_loaded or world.artwork == null or world.artwork.texture == null:
        push_error("SMOKE FAIL: approved concept artwork not loaded")
        failed = true
    elif world.artwork.texture.get_width() < 1000 or world.artwork.texture.get_height() < 500:
        push_error("SMOKE FAIL: concept image too small")
        failed = true
    else:
        print("ART PASS: assets/art/concept_farm.png loaded (%d x %d)" % [world.artwork.texture.get_width(), world.artwork.texture.get_height()])
    var player = world.get_node_or_null("Player")
    if player == null or not player is CharacterBody2D:
        push_error("SMOKE FAIL: CharacterBody2D player missing")
        failed = true
    else:
        var camera = player.get_node_or_null("Camera2D")
        if camera == null or not camera is Camera2D:
            push_error("SMOKE FAIL: Camera2D missing")
            failed = true
        var initial_x: float = player.global_position.x
        Input.action_press("ui_right")
        for i in range(5):
            await physics_frame
        Input.action_release("ui_right")
        if player.global_position.x <= initial_x + 0.01:
            push_error("SMOKE FAIL: player failed 2D movement")
            failed = true
        player.global_position = Vector2(780, 530)
        var event := InputEventKey.new()
        event.keycode = KEY_E
        event.pressed = true
        world._unhandled_input(event)
        if world.interaction_timer <= 0.0:
            push_error("SMOKE FAIL: NPC interaction did not open")
            failed = true
    root.remove_child(world)
    world.free()
    await process_frame
    if failed:
        quit(1)
    else:
        print("SMOKE PASS: Godot 2D scene, concept artwork, Camera2D, movement and NPC E interaction")
        quit(0)
