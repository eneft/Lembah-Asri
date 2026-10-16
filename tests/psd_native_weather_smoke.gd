extends SceneTree
## One-baked-image native Camera2D weather regression, independent from old scenes.
func _initialize() -> void:
 call_deferred("_check")
func _fail(reason: String) -> void:
 push_error("PSD NATIVE WEATHER FAIL: " + reason)
 quit(1)
func _check() -> void:
 var stage: Node2D = (load("res://scenes/rumah_ladang_psd_camera2d.tscn") as PackedScene).instantiate()
 root.add_child(stage)
 await process_frame
 # Mobile must fit the entire original PSD without changing authored pixels.
 stage.set("force_mobile_fit_for_testing",true)
 stage.call("_configure_camera")
 var scene_camera: Camera2D = stage.get_node("Camera2D") as Camera2D
 var viewport_size: Vector2 = stage.get_viewport().get_visible_rect().size
 var expected_zoom: float = minf(viewport_size.x / 1672.0, viewport_size.y / 941.0)
 if not scene_camera.zoom.is_equal_approx(Vector2.ONE * expected_zoom):
  _fail("mobile fit crops full PSD canvas instead of containing it")
  return
 if scene_camera.limit_left >= 0 or scene_camera.limit_top >= 0 or scene_camera.limit_right <= 1672 or scene_camera.limit_bottom <= 941:
  _fail("mobile Camera2D limits pin the fitted background to one edge")
  return
 if not scene_camera.position.is_equal_approx(Vector2(836.0,470.5)):
  _fail("mobile contained camera must center the entire original PSD")
  return
 stage.set("force_mobile_fit_for_testing",false)
 stage.call("_configure_camera")
 if scene_camera.limit_left != 0 or scene_camera.limit_right != 1672 or scene_camera.limit_top != 0 or scene_camera.limit_bottom != 941:
  _fail("desktop camera lost original follow boundaries")
  return
 var weather: Node2D = stage.get_node("RainWeather") as Node2D
 var ground: Node2D = weather.get_node("GroundSplashes") as Node2D
 var puddles: Node2D = weather.get_node("GroundPuddles") as Node2D
 var water: Node2D = weather.get_node("RiverRipples") as Node2D
 const SURFACES = preload("res://scripts/weather/native_surface_zones.gd")
 var soil: Array[PackedVector2Array] = SURFACES.bare_soil()
 var river: Array[PackedVector2Array] = SURFACES.river_water()
 if not bool(weather.get("native_masked")):
  _fail("single-background custom ground and water masks not installed")
  return
 if stage.get_node_or_null("PSD_House") != null or stage.get_node("Background").texture == null:
  _fail("baked one-image artwork unexpectedly split")
  return
 var puddle_entries: Array = puddles.get("entries")
 var layout: Array = puddles.get("native_puddle_details")
 if layout.size() < 3 or layout.size() > 4 or layout.size() != puddle_entries.size():
  _fail("sparse rainy puddles must be 3-4: got " + str(layout.size()))
  return
 var blocked: Array[PackedVector2Array] = []
 var hand_collision: Dictionary = stage.get("walkable_regions")
 for original in hand_collision.values():
  blocked.append(original)
 var widths: Dictionary = {}
 var heights: Dictionary = {}
 var unique_rows: Dictionary = {}
 var contours: Dictionary = {}
 var gaps: Dictionary = {}
 for i in range(layout.size()):
  var detail: Dictionary = layout[i]
  var spot: Vector2 = detail["center"]
  var size: Vector2 = detail["size"]
  var angle: float = float(detail["rotation"])
  if not SURFACES.puddle_ellipse_on_soil(spot,size,angle,soil,blocked):
   _fail("rotated puddle footprint over wall, rock, fence or river: " + str(spot))
   return
  if not spot.is_equal_approx(Vector2(puddle_entries[i].x,puddle_entries[i].y)):
   _fail("puddle visual and physics positions diverged")
   return
  if not bool(weather.call("is_in_puddle",spot)):
   _fail("puddle is visible but cannot produce footstep water contact")
   return
  widths[roundi(size.x)] = true
  heights[roundi(size.y)] = true
  unique_rows[roundi(spot.y)] = true
  contours["%d-%d" % [roundi(float(detail["shape_seed"]) * 1000.0),int(detail["lobes"])]] = true
  if i > 0:
   var separation: float = spot.distance_to(layout[i-1]["center"])
   gaps[roundi(separation / 12.0)] = true
 if widths.size() < 2 or heights.size() < 2 or unique_rows.size() < 2 or contours.size() < 3 or gaps.size() < 1:
  _fail("sparse pools still repeat shoreline, size or placement")
  return
 if bool(weather.call("is_in_puddle",Vector2(378,568))):
  _fail("legacy wall-adjacent puddle still active on single-image map")
  return
 var first_layout: Array = layout.duplicate(true)
 puddles.call("regenerate_native_puddles",1234)
 var fixed_layout_a: Array = (puddles.get("native_puddle_details") as Array).duplicate(true)
 puddles.call("regenerate_native_puddles",1234)
 var fixed_layout_b: Array = (puddles.get("native_puddle_details") as Array).duplicate(true)
 if fixed_layout_a != fixed_layout_b:
  _fail("explicit seed does not reproduce the same natural puddle layout")
  return
 puddles.call("regenerate_native_puddles",4567)
 var next_layout: Array = puddles.get("native_puddle_details")
 if next_layout == fixed_layout_a:
  _fail("different rainy episode seed returned identical layout")
  return
 var count_before_weather: int = int(puddles.get("native_puddle_generation"))
 # No repositioning while already raining (light -> heavy -> storm).
 stage.call("_set_weather_mode",2,true)
 var stable_rain: Array = (puddles.get("native_puddle_details") as Array).duplicate(true)
 stage.call("_set_weather_mode",3,true)
 stage.call("_set_weather_mode",4,true)
 if stable_rain != (puddles.get("native_puddle_details") as Array) or int(puddles.get("native_puddle_generation")) != count_before_weather:
  _fail("puddles teleported while rain intensity changed")
  return
 stage.call("_set_weather_mode",0,true)
 stage.call("_set_weather_mode",2,true)
 if int(puddles.get("native_puddle_generation")) != count_before_weather + 1:
  _fail("new rain event failed to choose another distribution")
  return
 for entry in ground.get("entries"):
  if not SURFACES.point_in_any(Vector2(entry.x, entry.y),soil):
   _fail("raindrop contact escaped bare earth")
   return
 ground.set("elapsed", float(ground.get("elapsed")) + 2.0)
 ground.call("_update_batch")
 for entry in ground.get("entries"):
  if not SURFACES.point_in_any(Vector2(entry.x, entry.y),soil):
   _fail("recycled splash escaped bare earth")
   return
 for entry in water.get("entries"):
  if not SURFACES.point_in_any(Vector2(entry.x, entry.y), river):
   _fail("water rain-impact escaped river-only polygon")
   return
 var current: Node2D = stage.get_node("AnimatedRiverCurrent") as Node2D
 # River now uses ONE broad corridor, with blue-only color mask per pixel.
 # Rain ripple sample zones remain the three original water-safe polygons.
 if current.get_child_count() != 1:
  _fail("continuous river should be rendered in one GPU surface pass")
  return
 var channel: Polygon2D = current.get_child(0) as Polygon2D
 if channel == null or channel.polygon.size() < 6:
  _fail("continuous downstream river corridor not present")
  return
 var bounds := Rect2(channel.polygon[0], Vector2.ZERO)
 for vertex in channel.polygon:
  bounds = bounds.expand(vertex)
 if bounds.position.x > 600.0 or bounds.end.x < 1650.0 or bounds.end.y < 930.0:
  _fail("river corridor misses most of visible painted stream")
  return
 stage.call("_set_weather_mode",3,true)
 for mat in current.get("material_instances"):
  if float(mat.get_shader_parameter("current_strength")) < 0.75:
   _fail("rain fails to make moving downstream water visible")
   return
  if (mat.get_shader_parameter("flow_direction") as Vector2).length() < 0.9:
   _fail("river water shader has no downstream direction")
   return
 # A storm must NOT increase foam/flash brightness over heavy rain.
 var river_mat: ShaderMaterial = (current.get("material_instances") as Array)[0] as ShaderMaterial
 var heavy_foam: float = float(river_mat.get_shader_parameter("foam_strength"))
 stage.call("_set_weather_mode",4,true)
 var storm_foam: float = float(river_mat.get_shader_parameter("foam_strength"))
 if storm_foam >= heavy_foam:
  _fail("storm river foam must be calmer than heavy-rain foam")
  return
 for i in range(5):
  stage.call("_set_weather_mode",i,true)
  if bool(weather.get("raining")) != (i >= 2):
   _fail("precipitation switch incorrect in mode " + str(i))
   return
  if int(stage.get("weather_mode_index")) != i:
   _fail("picker synchronization lost")
   return
 stage.call("_set_weather_mode",1,true)
 var cloudy: Color = stage.get("weather_tint_current")
 stage.call("_set_weather_mode",4,true)
 var storm: Color = stage.get("weather_tint_current")
 if storm.r >= cloudy.r or storm.g >= cloudy.g:
  _fail("storm atmosphere not darker than overcast")
  return
 stage.call("_trigger_lightning")
 stage.call("_tick_weather",0.05)
 if not stage.get_node("StormLightning/Flash").visible or not stage.get_node("StormLightning/LightningBolt").visible:
  _fail("storm lightning flashes invisible")
  return
 for i in range(9):
  stage.call("_tick_weather",0.05)
 if stage.get_node("StormLightning/Flash").visible:
  _fail("lightning remains on after 0.4 seconds")
  return
 stage.call("_set_weather_mode",0,true)
 stage.call("_trigger_lightning")
 if stage.get_node("StormLightning/Flash").visible:
  _fail("lightning visible in clear weather")
  return
 stage.call("_set_weather_mode",4,true)
 stage.call("_tick_weather",0.15)
 var rain_front: Node2D = weather.get_node("RainFront") as Node2D
 if absf(float(rain_front.get("wind_strength"))) < 0.3:
  _fail("storm wind is not influencing rain")
  return
 if not stage.get_node("StormWindGusts").visible:
  _fail("wind trails missing in heavy gusts")
  return
 print("PSD NATIVE WEATHER PASS: five presets, dark storm, gusts, lightning, randomized sized earth-only puddles, stable rainy episodes, moving river and masked splashes")
 stage.queue_free()
 quit(0)
