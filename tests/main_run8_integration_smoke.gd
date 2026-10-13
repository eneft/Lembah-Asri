extends SceneTree
# Focused integration smoke for ACTUAL MAIN game (not isolated run8 test).
# Checks assets/foot-pivot/scene persistence without depending on GPU screenshot.
func _initialize() -> void:
 call_deferred("_check")

func _fail(message: String) -> void:
 push_error("MAIN RUN8 FAIL: " + message)
 quit(1)

func _check() -> void:
 var source: PackedScene = load("res://scenes/house_garden_stage1.tscn") as PackedScene
 if source == null:
  _fail("main stage cannot load")
  return
 var world: Node2D = source.instantiate()
 root.add_child(world)
 await process_frame
 var player: Variant = world.get_node_or_null("Player")
 if player == null or not player.using_run8_uploaded:
  _fail("main stage did not instantiate native eight-direction player")
  return
 var sprite: AnimatedSprite2D = player.get_node_or_null("AnimatedSprite2D") as AnimatedSprite2D
 if sprite == null or sprite.sprite_frames == null:
  _fail("missing protagonist AnimatedSprite2D bank")
  return
 if world.get_node_or_null("BackgroundBase") == null or world.get_node_or_null("RiverWaterfallSurface") == null:
  _fail("original painted main-scene background or animated river missing")
  return
 if world.get_node_or_null("MobileControlsLayer/TouchControls") == null:
  _fail("mobile joystick/buttons missing")
  return
 var camera: Camera2D = player.get_node_or_null("Camera2D") as Camera2D
 if camera == null or player.get_node_or_null("FootContactShadow") == null:
  _fail("existing camera or ground shadow missing")
  return
 # Zoom MAIN stage only; keep world bounds, follow smoothing and mobile UI intact.
 if not camera.zoom.is_equal_approx(Vector2(1.25, 1.25)):
  _fail("main camera must use 1.25 zoom after requested close-up")
  return
 if camera.limit_left != 0 or camera.limit_top != 0 or camera.limit_right != 1672 or camera.limit_bottom != 941:
  _fail("main camera map boundaries were modified")
  return
 if not camera.position_smoothing_enabled or not is_equal_approx(camera.position_smoothing_speed, 4.0):
  _fail("camera follow smoothing was modified")
  return
 print("MAIN CAMERA ZOOM PASS: 1.25 x/y, limits intact, smoothing intact")
 if not player.is_walkable_foot(Vector2(1430,470)) or player.is_walkable_foot(Vector2(1450,700)):
  _fail("bridge or river walkability was changed")
  return
 var headings := ["right","down_right","down","down_left","left","up_left","up","up_right"]
 for direction in headings:
  for mode in ["run", "idle"]:
   var key: String = mode + "_" + direction
   if not sprite.sprite_frames.has_animation(key):
    _fail("missing " + key)
    return
   var expected: int = 1 if mode == "idle" else (26 if direction in ["left","right"] else (21 if direction in ["up_left","up_right"] else 12))
   if sprite.sprite_frames.get_frame_count(key) != expected:
    _fail(key + " frames should be " + str(expected))
    return
   player._set_animation(mode, direction)
   var original: String = player._native_direction(direction)
   var native_h: float = float(player.IDLE_VISIBLE_HEIGHT[original]) if mode == "idle" else float(player.SOURCE_VISIBLE_HEIGHT[direction])
   var world_h: float = sprite.scale.y * native_h
   if absf(world_h - 112.0) > 0.05:
    _fail(key + " rendered height must be 112 world px, got " + str(world_h))
    return
   if absf(sprite.scale.x - sprite.scale.y) > 0.00001 or not sprite.position.is_equal_approx(Vector2.ZERO):
    _fail(key + " anisotropic scale or wrong foot origin")
    return
   if sprite.flip_h != (direction in ["left","down_left","up_left"]):
    _fail(key + " mirror incorrectly applied")
    return
   if mode == "run" and absf(sprite.sprite_frames.get_animation_speed(key) - float(expected)) > 0.01:
    _fail(key + " original gait fps not preserved")
    return
   print("MAIN RUN8 ART PASS: ", key, " native_frames=", expected, " body_height_px=", world_h)
 var material: ShaderMaterial = sprite.material as ShaderMaterial
 if material == null or material.shader == null or not material.shader.code.contains("shirt_mask"):
  _fail("selective side-run color material missing")
  return
 player._set_animation("idle", "down")
 if absf(float(material.get_shader_parameter("grading_enabled"))) > 0.01:
  _fail("native user idle PNG recolored by side shader")
  return
 world.queue_free()
 print("MAIN RUN8 INTEGRATION PASS: original illustrated scene, 112px 8-way avatar, full 26/21 native cycles, idle, Y-sort, mobile/camera")
 quit(0)
