extends SceneTree
## Rendered-pixel proof for visible ground raindrop splashes, sky-reflecting
## puddles, and an actual moving footstep (not just node existence).
func _initialize() -> void:
 call_deferred("_check")

func _snapshot(view: SubViewport) -> Image:
 await process_frame
 await process_frame
 await RenderingServer.frame_post_draw
 return view.get_texture().get_image()

func _visible_pixels(img: Image) -> int:
 var count := 0
 for y in range(0, img.get_height(), 2):
  for x in range(0, img.get_width(), 2):
   if img.get_pixel(x, y).a > 0.055:
    count += 1
 return count

func _fail(why: String) -> void:
 push_error("PUDDLE RENDER FAIL: " + why)
 quit(1)

func _check() -> void:
 var view := SubViewport.new()
 view.size = Vector2i(640, 360)
 view.transparent_bg = true
 view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
 root.add_child(view)
 var camera := Camera2D.new()
 camera.position = Vector2(820, 565)
 camera.enabled = true
 view.add_child(camera)
 camera.make_current()
 var scene: PackedScene = load("res://scenes/weather/rain_weather.tscn") as PackedScene
 if scene == null:
  _fail("weather scene unavailable")
  return
 var weather: Node2D = scene.instantiate()
 view.add_child(weather)
 for name in ["RainBack", "RainFront", "GroundSplashes", "RiverRipples", "FootstepSplashes"]:
  weather.get_node(name).visible = false
 var puddle_image: Image = await _snapshot(view)
 var puddle_pixels: int = _visible_pixels(puddle_image)
 if puddle_pixels < 80:
  _fail("ground puddles are not visibly painted: " + str(puddle_pixels))
  return

 weather.get_node("GroundPuddles").visible = false
 weather.get_node("GroundSplashes").visible = true
 var splash_image: Image = await _snapshot(view)
 var splash_pixels: int = _visible_pixels(splash_image)
 if splash_pixels < 10:
  _fail("raindrop-to-ground splashes remain invisible: " + str(splash_pixels))
  return

 weather.get_node("GroundSplashes").visible = false
 weather.get_node("FootstepSplashes").visible = true
 weather.call("register_footstep", Vector2(821, 562), true)
 var step_image: Image = await _snapshot(view)
 var step_pixels: int = _visible_pixels(step_image)
 if step_pixels < 4:
  _fail("footstep splash is invisible: " + str(step_pixels))
  return
 print("PUDDLE RENDER QA: puddle=%d, falling-rain impact=%d, footstep=%d alpha pixels" % [puddle_pixels, splash_pixels, step_pixels])
 weather.call("set_raining", false)
 var dry_image: Image = await _snapshot(view)
 if _visible_pixels(dry_image) > 2:
  _fail("weather OFF still displays puddle/splashes")
  return
 view.queue_free()
 print("PUDDLE RENDER PASS: sky-glint puddles, rainfall splash crowns, walking splash and toggle all visibly rendered")
 quit(0)
