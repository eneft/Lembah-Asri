extends SceneTree
## Shipping PSD Camera3D smoke: source pixels, 3D order, physical blockers, bridge, 8-way character, rain.
func _initialize() -> void:
 call_deferred("_check")

func _fail(reason: String) -> void:
 push_error("PSD CAMERA3D FAIL: " + reason)
 quit(1)

func _check() -> void:
 # Camera3D is preserved as a legacy standalone scene, never the game's
 # default entrypoint. Keep its 3D and collision regression tests working.
 var packed: PackedScene = load("res://scenes/rumah_ladang_psd_camera3d.tscn") as PackedScene
 if packed == null:
  _fail("scene cannot load")
  return
 var scene: Node3D = packed.instantiate()
 root.add_child(scene)
 await process_frame
 await physics_frame
 var camera: Camera3D = scene.get_node_or_null("Camera3D") as Camera3D
 var rig: Node3D = scene.get_node_or_null("ArtRig") as Node3D
 var player: CharacterBody3D = scene.get_node_or_null("Run8Player") as CharacterBody3D
 if camera == null or rig == null or player == null or camera.projection != Camera3D.PROJECTION_ORTHOGONAL:
  _fail("real Camera3D / 3D rig / CharacterBody3D missing")
  return
 if not bool(scene.get("psd_ready")):
  _fail("PSD source textures missing - shipping fallback is not permitted")
  return
 var sprite: AnimatedSprite3D = player.get_node_or_null("AnimatedSprite3D") as AnimatedSprite3D
 if sprite == null or sprite.sprite_frames == null or player.get_node_or_null("CollisionShape3D") == null:
  _fail("character missing native animation or foot collider")
  return
 var names := ["Background", "Run8Player", "PSD_House", "PSD_Banana", "PSD_ForegroundTree"]
 var depths := [-0.20, -0.10, -0.04, 0.04, 0.12]
 var dimensions := [Vector2i(1672, 941), Vector2i.ZERO, Vector2i(831, 624), Vector2i(295, 360), Vector2i(916, 893)]
 for i in range(names.size()):
  var node: Node3D = scene.get_node_or_null(names[i]) as Node3D
  if node == null or absf(rig.to_local(node.global_position).z - depths[i]) > 0.001:
   _fail("incorrect PSD Photoshop layer z order: " + names[i])
   return
  if i != 1:
   var plane: Sprite3D = node as Sprite3D
   if plane.texture == null or Vector2i(plane.texture.get_width(), plane.texture.get_height()) != dimensions[i]:
    _fail("invalid Photoshop layer texture or dimensions: " + names[i])
    return
 for direction in ["down", "up_left", "right", "up_right"]:
  for prefix in ["run_", "idle_"]:
   if not sprite.sprite_frames.has_animation(prefix + direction):
    _fail("missing character animation " + prefix + direction)
    return
 player.call("set_run_direction", "up_left")
 if sprite.animation != &"run_up_left" or not sprite.is_playing():
  _fail("RUN8 is not playing")
  return
 player.call("set_idle_direction", "up_left")
 if sprite.animation != &"idle_up_left" or sprite.is_playing():
  _fail("IDLE8 is not stopped correctly")
  return
 # Old oversized BoxShape3D colliders have been removed entirely: collision
 # authority is now the per-foot 1672x941 walkable terrain polygons.
 if scene.get_node_or_null("ArtRig/CollisionGeometry/RiverBankCollision") != null:
  _fail("obsolete giant river rectangle remains, obstructing the bridge")
  return
 if scene.get_node_or_null("CollisionDebugOverlay/WalkablePolygons") == null:
  _fail("visual inspection overlay for the collision polygons is missing")
  return
 for safe in [Vector2(700,530), Vector2(820,565), Vector2(1120,605), Vector2(1320,680), Vector2(1460,739)]:
  if not bool(scene.call("_is_walkable_foot", safe)):
   _fail("painted playable terrain blocked at " + str(safe))
   return
 for forbidden in [Vector2(660,275), Vector2(310,600), Vector2(850,725), Vector2(1050,820), Vector2(1340,833), Vector2(1540,626)]:
  if bool(scene.call("_is_walkable_foot", forbidden)):
   _fail("house / fence / river is penetrable at " + str(forbidden))
   return
 var weather: Node2D = scene.get_node_or_null("WeatherOverlay/RainWeather") as Node2D
 if weather == null or not bool(weather.get("raining")) or weather.get_node_or_null("GroundPuddles") == null or weather.get_node_or_null("FootstepSplashes") == null:
  _fail("batched rain and puddles were not carried into main scene")
  return
 print("PSD CAMERA3D PASS: source PSD, Camera3D player, yard/fence/shore polygon collision, bridge access and RUN8/IDLE8 weather")
 scene.queue_free()
 quit(0)
