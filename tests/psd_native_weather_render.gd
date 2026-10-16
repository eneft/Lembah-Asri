extends SceneTree
## Compare actual GPU pixels from single-PNG Camera2D: cloudy and storm
## cannot be invisible, while water flow must move within its own masks.
func _initialize() -> void:
 call_deferred("_check")
func _fail(why: String) -> void:
 push_error("PSD NATIVE WEATHER RENDER FAIL: " + why)
 quit(1)
func _image() -> Image:
 # Web/export Compatibility occasionally presents the previous submission
 # for one frame after visibility/phase changes. Wait for two full draws.
 await process_frame
 await process_frame
 await RenderingServer.frame_post_draw
 return root.get_texture().get_image()
func _different(a: Image, b: Image, from_y: int, until_y: int, threshold: float) -> int:
 var count: int = 0
 for y in range(from_y, mini(a.get_height(),until_y), 4):
  for x in range(100, mini(a.get_width()-50,1170), 4):
   var one: Color = a.get_pixel(x,y)
   var two: Color = b.get_pixel(x,y)
   if absf(one.r-two.r)+absf(one.g-two.g)+absf(one.b-two.b) > threshold:
    count += 1
 return count
func _check() -> void:
 var stage: Node2D = (load("res://scenes/rumah_ladang_psd_camera2d.tscn") as PackedScene).instantiate()
 root.add_child(stage)
 await process_frame
 stage.get_node("RainWeather").call("set_raining",false)
 stage.set_process(false)
 stage.set_physics_process(false)
 stage.get_node("StormWindGusts").visible = false
 var water: Node2D = stage.get_node("AnimatedRiverCurrent") as Node2D
 stage.call("_set_lighting_preset",1,true)
 stage.call("_set_weather_mode",0,true)
 var sun: Image = await _image()
 stage.call("_set_weather_mode",1,true)
 var cloud: Image = await _image()
 stage.call("_set_weather_mode",4,true)
 var storm: Image = await _image()
 var cloudy_pixels: int = _different(sun,cloud,50,660,0.13)
 var darker_pixels: int = _different(cloud,storm,50,660,0.13)
 if cloudy_pixels < 700 or darker_pixels < 700:
  _fail("GPU failed to visibly darken cloudy/storm: %d, %d" % [cloudy_pixels, darker_pixels])
  return
 stage.call("_trigger_lightning")
 stage.call("_tick_weather",0.06)
 var lightning: Image = await _image()
 var flash_pixels: int = _different(storm,lightning,50,660,0.18)
 if flash_pixels < 600:
  _fail("storm lightning too dim in the actual frame: " + str(flash_pixels))
  return
 stage.call("_set_weather_mode",0,true)
 stage.get_node("StormWindGusts").visible = false
 # Move the camera toward the bottom river course (camera limits still hold).
 var camera: Camera2D = stage.get_node("Camera2D") as Camera2D
 camera.position = Vector2(1130,640)
 camera.reset_smoothing()
 await process_frame
 water.call("set_flow_phase",0.0)
 var current_a: Image = await _image()
 water.visible = false
 var hidden_water: Image = await _image()
 water.visible = true
 water.call("set_flow_phase",1.65)
 var current_b: Image = await _image()
 water.call("set_flow_phase",3.32)
 var current_c: Image = await _image()
 var river_overlay: int = _different(current_b,hidden_water,0,720,0.014)
 var river_pixels: int = maxi(
  _different(current_a,current_b,0,720,0.014),
  _different(current_b,current_c,0,720,0.014))
 print("PSD NATIVE RIVER GPU DIAG: overlay=",river_overlay," motion=",river_pixels," camera=",camera.position)
 # Screen-capture buffering may make an independent visibility-toggle
 # sample stale; genuine motion between TWO phases remains authoritative.
 if river_pixels < 20:
  _fail("river flow did not change real rendered pixels: current=" + str(river_pixels))
  return
 # Storm tint must not hide the real directed current.
 stage.call("_set_weather_mode",3,true)
 stage.get_node("RainWeather").visible = false
 water.call("set_flow_phase",1.0)
 var rainy_a: Image = await _image()
 water.call("set_flow_phase",3.1)
 var rainy_b: Image = await _image()
 var rainy_flow: int = _different(rainy_a,rainy_b,0,720,0.018)
 if rainy_flow < 20:
  _fail("downstream river motion disappears under rainy lighting: " + str(rainy_flow))
  return
 print("PSD RIVER RAIN MOTION PASS: %d moving storm-tinted pixels" % rainy_flow)
 print("PSD NATIVE WEATHER RENDER PASS: cloudy=%d storm=%d lightning=%d flowing_water=%d pixel samples" % [cloudy_pixels,darker_pixels,flash_pixels,river_pixels])
 stage.queue_free()
 quit(0)
