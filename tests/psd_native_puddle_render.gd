extends SceneTree
## Verify actual Godot GPU water pixels change when ONLY puddle layout changes.
## No weather particles, moving river, actor, or time-of-day effects as noise.
func _initialize() -> void:
 call_deferred("_check")

func _fail(reason: String) -> void:
 push_error("PSD NATURAL PUDDLES RENDER FAIL: " + reason)
 quit(1)

func _frame() -> Image:
 await process_frame
 await process_frame
 await RenderingServer.frame_post_draw
 return root.get_texture().get_image()

func _difference(a: Image, b: Image) -> int:
 var changed: int = 0
 for y in range(80, mini(a.get_height(), 670), 3):
  for x in range(60, mini(a.get_width(), 1210), 3):
   var first: Color = a.get_pixel(x,y)
   var second: Color = b.get_pixel(x,y)
   if absf(first.r-second.r) + absf(first.g-second.g) + absf(first.b-second.b) > 0.065:
    changed += 1
 return changed

func _check() -> void:
 var stage: Node2D = (load("res://scenes/rumah_ladang_psd_camera2d.tscn") as PackedScene).instantiate()
 root.add_child(stage)
 await process_frame
 var weather: Node2D = stage.get_node("RainWeather") as Node2D
 var water: Node2D = weather.get_node("GroundPuddles") as Node2D
 stage.call("_set_lighting_preset",1,true)
 stage.call("_set_weather_mode",3,true)
 stage.set_process(false)
 stage.set_physics_process(false)
 stage.get_node("AnimatedRiverCurrent").visible = false
 stage.get_node("StormWindGusts").visible = false
 for child in weather.get_children():
  child.set_process(false)
  if child != water:
   child.visible = false
 water.set("native_puddle_growth",1.0)
 water.call("regenerate_native_puddles",17211)
 water.set("native_puddle_growth",1.0)
 water.call("_update_batch")
 var first: Image = await _frame()
 # Verify contrast against the real painted terrain, not only layout metadata.
 water.visible = false
 var dry_soil: Image = await _frame()
 water.visible = true
 var puddle_visibility: int = _difference(first, dry_soil)
 if puddle_visibility < 45:
  _fail("rain puddles are still nearly invisible over painted dirt: " + str(puddle_visibility))
  return
 var fixed_layout: Array = (water.get("native_puddle_details") as Array).duplicate(true)
 water.call("_update_batch")
 var steady: Image = await _frame()
 var steadiness: int = _difference(first,steady)
 water.call("regenerate_native_puddles",98763)
 water.set("native_puddle_growth",1.0)
 water.call("_update_batch")
 var second_layout: Array = water.get("native_puddle_details")
 var second: Image = await _frame()
 var changed: int = _difference(steady,second)
 if fixed_layout == second_layout:
  _fail("different random seeds did not change placement")
  return
 # Strong layout difference from two real rendered images, not only metadata.
 if changed < 45:
  _fail("layout changes were not visible in GPU render: " + str(changed))
  return
 if steadiness > changed * 0.75:
  _fail("puddle images flicker even without a new rainfall: " + str(steadiness))
  return
 print("PSD NATURAL PUDDLES RENDER PASS: %d changed visual pixels from layouts; static drift=%d" % [changed,steadiness])
 stage.queue_free()
 quit(0)
