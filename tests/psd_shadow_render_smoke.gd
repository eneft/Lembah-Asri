extends SceneTree
## Render verification: animated body silhouette must actually cast on the PSD.
func _initialize() -> void:
 call_deferred("_check")

func _fail(message: String) -> void:
 push_error("PSD SHADOW FAIL: " + message)
 quit(1)

func _image() -> Image:
 await process_frame
 await RenderingServer.frame_post_draw
 return root.get_texture().get_image()

func _difference(a: Image, b: Image, origin: Vector2) -> int:
 var total: int = 0
 for y in range(maxi(0, roundi(origin.y)-80), mini(a.get_height(), roundi(origin.y)+130), 2):
  for x in range(maxi(0, roundi(origin.x)-140), mini(a.get_width(), roundi(origin.x)+140), 2):
   var on: Color = a.get_pixel(x, y)
   var off: Color = b.get_pixel(x, y)
   if absf(on.r-off.r)+absf(on.g-off.g)+absf(on.b-off.b)>0.05:
    total+=1
 return total

func _check() -> void:
 var stage: Node3D = (load("res://scenes/rumah_ladang_psd_camera3d.tscn") as PackedScene).instantiate()
 root.add_child(stage)
 await process_frame
 var shadow: AnimatedSprite2D = stage.get_node_or_null("CharacterOverlay/ProjectedShadow") as AnimatedSprite2D
 var hero: AnimatedSprite2D = stage.get_node("CharacterOverlay/ProjectedPlayer") as AnimatedSprite2D
 var player: CharacterBody3D = stage.get_node("Run8Player") as CharacterBody3D
 var driver: AnimatedSprite3D = player.get_node("AnimatedSprite3D") as AnimatedSprite3D
 var camera: Camera3D = stage.get_node("Camera3D") as Camera3D
 shadow.call("_sync_shadow", 0.0, true)
 if shadow == null or shadow.material == null or shadow.sprite_frames == null:
  _fail("silhouette not initialized")
  return
 if shadow.sprite_frames != hero.sprite_frames or shadow.offset != hero.offset:
  _fail("shadow doesn't use same live frame bank and foot anchor")
  return
 if camera.projection != Camera3D.PROJECTION_ORTHOGONAL or shadow.z_index >= hero.z_index:
  _fail("visual layering or Camera3D changed")
  return
 stage.get_node("WeatherOverlay/RainWeather").call("set_raining", false)
 stage.set_process(false)
 stage.set_physics_process(false)
 var foot_before: Vector3 = player.global_position
 var radius_before: float = (player.get_node("CollisionShape3D").shape as SphereShape3D).radius
 for i in range(4):
  stage.call("_set_lighting_preset", i, true)
  shadow.call("_sync_shadow", 0.0, true)
  if shadow.transform.y.y >= -0.01:
   _fail("shadow is upright instead of cast flat onto ground")
   return
  var strength: float = float((shadow.material as ShaderMaterial).get_shader_parameter("shadow_opacity"))
  if strength <= 0.05 or strength > 0.31:
   _fail("lighting preset opacity not applied")
   return
 for direction in ["down", "right", "up_left", "down_right"]:
  player.call("set_run_direction", direction)
  shadow.call("_sync_shadow", 0.0, true)
  if shadow.animation != driver.animation:
   _fail("RUN8 shadow frame orientation differs from hero")
   return
  player.call("set_idle_direction", direction)
  shadow.call("_sync_shadow", 0.0, true)
  if shadow.animation != driver.animation:
   _fail("IDLE8 shadow frame orientation differs from hero")
   return
 if not player.global_position.is_equal_approx(foot_before) or not is_equal_approx((player.get_node("CollisionShape3D").shape as SphereShape3D).radius, radius_before):
  _fail("shadow changed the physics world")
  return
 player.call("set_idle_direction", "down")
 stage.call("_set_lighting_preset", 2, true)
 shadow.call("_sync_shadow", 0.0, true)
 var foot_screen: Vector2 = camera.unproject_position(player.global_position)
 var with_shadow: Image = await _image()
 shadow.visible = false
 var without_shadow: Image = await _image()
 var pixels: int = _difference(with_shadow, without_shadow, foot_screen)
 print("PSD SHADOW VISIBLE PIXELS: ", pixels)
 if pixels < 22:
  _fail("GPU silhouette invisible; changed=" + str(pixels))
  return
 print("PSD SHADOW PASS: visible frame-correct flat silhouette in all four lighting modes, unchanged camera and collision")
 stage.queue_free()
 quit(0)
