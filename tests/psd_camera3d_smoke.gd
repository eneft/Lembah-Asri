extends SceneTree
## Shipping PSD Camera3D smoke: source pixels, 3D order, physical blockers, bridge, 8-way character, rain.
func _initialize() -> void:
 call_deferred("_check")

func _fail(reason: String) -> void:
 push_error("PSD CAMERA3D FAIL: " + reason)
 quit(1)

func _check() -> void:
 var main_path: String = str(ProjectSettings.get_setting("application/run/main_scene"))
 if main_path != "res://scenes/rumah_ladang_psd_camera3d.tscn":
  _fail("PSD Camera3D scene is not the playable main scene")
  return
 var packed: PackedScene = load(main_path) as PackedScene
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
 for obstacle in ["HouseWallsCollision", "HouseSideCollision", "BananaTrunkCollision", "ForegroundTreeCollision", "RiverBankCollision"]:
  var blocker: StaticBody3D = scene.get_node_or_null("ArtRig/CollisionGeometry/" + obstacle) as StaticBody3D
  if blocker == null or blocker.collision_layer != 2 or blocker.get_node_or_null("CollisionShape3D") == null:
   _fail("missing editable static body: " + obstacle)
   return
 player.global_position = rig.to_global(scene.call("_pixel_to_local", Vector2(590, 565), -0.10))
 if not player.test_move(player.global_transform, rig.global_basis * Vector3(0, 1.9, 0)):
  _fail("house is not physically solid")
  return
 player.global_position = rig.to_global(scene.call("_pixel_to_local", Vector2(1480, 477), -0.10))
 if not player.test_move(player.global_transform, rig.global_basis * Vector3(0, -1.7, 0)):
  _fail("river is not physically blocked away from bridge")
  return
 player.global_position = rig.to_global(scene.call("_pixel_to_local", Vector2(1420, 460), -0.10))
 if player.test_move(player.global_transform, rig.global_basis * Vector3(0.35, 0, 0)):
  _fail("bridge entrance is physically obstructed")
  return
 var weather: Node2D = scene.get_node_or_null("WeatherOverlay/RainWeather") as Node2D
 if weather == null or not bool(weather.get("raining")) or weather.get_node_or_null("GroundPuddles") == null or weather.get_node_or_null("FootstepSplashes") == null:
  _fail("batched rain and puddles were not carried into main scene")
  return
 print("PSD CAMERA3D PASS: four PSD layers, real 3D collisions, bridge access, original RUN8/IDLE8 and weather")
 scene.queue_free()
 quit(0)
