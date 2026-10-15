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
 if puddle_entries.size() != 8:
  _fail("expected eight grounded puddles, not twelve generic puddles")
  return
 for entry in puddle_entries:
  var spot := Vector2(entry.x, entry.y)
  if not SURFACES.ellipse_on_soil(spot, soil):
   _fail("puddle overlaps a wall or prop: " + str(spot))
   return
 if bool(weather.call("is_in_puddle",Vector2(378,568))):
  _fail("wall-adjacent legacy puddle still creates footsteps")
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
 if current.get_child_count() != 3:
  _fail("water current polygons cover bridge or land")
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
 print("PSD NATIVE WEATHER PASS: five presets, dark storm, gusts, lightning, 8 soil puddles, moving current and masked splashes")
 stage.queue_free()
 quit(0)
