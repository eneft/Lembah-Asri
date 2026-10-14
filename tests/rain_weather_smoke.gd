extends SceneTree
## Regression: rain + masked ripples + toggle in test and main scenes.
func _initialize() -> void:
 call_deferred("_check")

func _fail(why: String) -> void:
 push_error("RAIN WEATHER FAIL: " + why)
 quit(1)

func _check() -> void:
 var paths := ["res://scenes/rumah_ladang_run8_test.tscn", "res://scenes/house_garden_stage1.tscn"]
 for path in paths:
  var scene: PackedScene = load(path) as PackedScene
  if scene == null:
   _fail("cannot load " + path)
   return
  var world: Node2D = scene.instantiate()
  root.add_child(world)
  await process_frame
  var weather: Node2D = world.get_node_or_null("RainWeather") as Node2D
  if weather == null or not bool(weather.get("raining")):
   _fail("active RainWeather scene missing from " + path)
   return
  for effect in ["RainBack", "RainFront", "GroundSplashes", "RiverRipples"]:
   var layer: Node2D = weather.get_node_or_null(effect) as Node2D
   if layer == null or not layer.visible or not layer.is_processing():
    _fail("missing active effect " + effect)
    return
   var points: Array = layer.get("entries")
   if points.is_empty():
    _fail("no rain/impact data for " + effect)
    return
   # Performance regression guard: one GPU-instanced batch per layer.
   # No CanvasItem queue_redraw/arc/line loops for each particle.
   var batch: MultiMeshInstance2D = layer.get_node_or_null("BatchedSprites") as MultiMeshInstance2D
   if batch == null or batch.multimesh == null or batch.multimesh.instance_count != points.size():
    _fail("weather must be GPU-instanced, not individual draw calls: " + effect)
    return
   if points.size() > 230:
    _fail("weather layer exceeds bounded GPU batch budget: " + effect)
    return
   var expected_fps: float = 30.0 if effect.begins_with("Rain") else 20.0
   if not is_equal_approx(float(layer.get("update_fps")), expected_fps):
    _fail("weather effect tick cap regressed: " + effect)
    return
  for entry in weather.get_node("GroundSplashes").get("entries"):
   if entry.y < 485.0:
    _fail("a yard splash appears on a roof")
    return
  for entry in weather.get_node("RiverRipples").get("entries"):
   if entry.x < 1058.0 or entry.y < 288.0:
    _fail("river impact outside RGBA sprite origin")
    return
  weather.call("set_raining", false)
  if bool(weather.get("raining")):
   _fail("toggle off failed")
   return
  for child in weather.get_children():
   if child.visible or child.is_processing():
    _fail("disabled rain still active")
    return
  weather.call("set_raining", true)
  for child in weather.get_children():
   if not child.visible or not child.is_processing():
    _fail("rain reactivation failed")
    return
  if path.contains("rumah_ladang"):
   var button: CheckButton = world.get_node("HUD/HUDRoot/DirectionPanel").find_child("RainSwitch", true, false) as CheckButton
   if button == null:
    _fail("touch rain switch missing")
    return
   var runner := world.get_node("Run8Player")
   var sprite := runner.get_node("AnimatedSprite2D") as AnimatedSprite2D
   if str(runner.get("animation_state")) != "idle" or sprite.animation != &"idle_down":
    _fail("weather disturbed IDLE8")
    return
  else:
   if world.get_node_or_null("Player/CollisionShape2D") == null or world.get_node_or_null("RiverWaterfallSurface") == null:
    _fail("weather disturbed main collisions or water shader")
    return
  world.queue_free()
  await process_frame
 print("RAIN WEATHER PASS: four GPU-instanced weather layers, visible-rain budgets <=230, 30/20Hz updates, land+river splashes and game unchanged")
 quit(0)
