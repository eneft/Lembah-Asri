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
  for effect in ["RainBack", "RainFront", "GroundPuddles", "GroundSplashes", "RiverRipples", "FootstepSplashes"]:
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
   var expected_fps: float = 30.0 if effect.begins_with("Rain") else (12.0 if effect == "GroundPuddles" else 20.0)
   if not is_equal_approx(float(layer.get("update_fps")), expected_fps):
    _fail("weather effect tick cap regressed: " + effect)
    return
  var ground: Node2D = weather.get_node("GroundSplashes")
  var ground_entries: Array = ground.get("entries")
  var first_locations: Array[Vector2] = []
  var exposed: PackedVector2Array = ground.get("yard_polygon")
  for entry in ground_entries:
   var point := Vector2(entry.x, entry.y)
   first_locations.append(point)
   if entry.y < 485.0 or not Geometry2D.is_point_in_polygon(point, exposed):
    _fail("a yard splash escaped onto a roof, building or river")
    return
  # The pre-optimization bug reused the very same impact positions forever.
  # Advance all pools across multiple lifetimes; every recycled drop must be
  # redistributed, while remaining inside the same valid dirt polygon.
  ground.set("elapsed", float(ground.get("elapsed")) + 2.0)
  ground.call("_update_batch")
  if int(ground.get("yard_relocations")) < ground_entries.size():
   _fail("ground impacts are still stuck on static points")
   return
  var moved_count: int = 0
  var variant_counts := [0, 0, 0]
  var styles: PackedInt32Array = ground.get("yard_variant")
  for i in range(ground_entries.size()):
   var new_drop: Vector4 = ground_entries[i]
   var new_point := Vector2(new_drop.x, new_drop.y)
   if not Geometry2D.is_point_in_polygon(new_point, exposed):
    _fail("recycled splash moved outside exposed soil")
    return
   if new_point.distance_to(first_locations[i]) > 15.0:
    moved_count += 1
   variant_counts[styles[i]] += 1
  if moved_count < int(float(ground_entries.size()) * 0.80):
   _fail("recycled ground positions do not move enough")
   return
  if variant_counts[0] < 20 or variant_counts[1] < 8 or variant_counts[2] < 2:
   _fail("small / medium / accent ground splash variety missing")
   return
  for entry in weather.get_node("RiverRipples").get("entries"):
   if entry.x < 1058.0 or entry.y < 288.0:
    _fail("river impact outside RGBA sprite origin")
    return
  # Verify that puddle footprints generate splashes only while moving.
  var splashes: Node2D = weather.get_node("FootstepSplashes")
  var before: int = int(splashes.get("next_footstep_slot"))
  var spot := Vector2(821, 562)
  if not bool(weather.call("is_in_puddle", spot)) or bool(weather.call("is_in_puddle", Vector2(100, 100))):
   _fail("puddle collision radius is missing or too broad")
   return
  weather.call("register_footstep", spot, false)
  if int(splashes.get("next_footstep_slot")) != before:
   _fail("standing still must not create a puddle footstep")
   return
  weather.call("register_footstep", spot, true)
  if int(splashes.get("next_footstep_slot")) == before:
   _fail("moving through a puddle must produce a footstep splash")
   return
  var after: int = int(splashes.get("next_footstep_slot"))
  weather.call("register_footstep", spot, true)
  if int(splashes.get("next_footstep_slot")) != after:
   _fail("footstep cooldown is not enforced")
   return
  # Genangan visible even without motion; stable seed/canonical positions.
  var puddles: Node2D = weather.get_node("GroundPuddles")
  if (puddles.get("entries") as Array).size() != 12:
   _fail("expected twelve hand-positioned puddles")
   return
  weather.call("set_raining", false)
  weather.call("register_footstep", spot, true)
  if int(splashes.get("next_footstep_slot")) != after:
   _fail("disabled rain must suppress footsteps")
   return
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
 print("RAIN WEATHER PASS: dynamic recycled dirt impacts with 3 shapes, six GPU batches, 12 puddles, river/footstep preserved")
 quit(0)
