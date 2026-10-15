extends SceneTree
## Real GPU validation: manual day/sunset/night grades must affect the
## composite including Camera3D without changing the authoritative PSD art.
func _initialize() -> void:
 call_deferred("_test")

func _fail(why: String) -> void:
 push_error("PSD LIGHTING FAIL: " + why)
 quit(1)

func _capture() -> Image:
 await process_frame
 await process_frame
 await RenderingServer.frame_post_draw
 return root.get_texture().get_image()

func _average(image: Image) -> Color:
 var sum := Color(0, 0, 0, 0)
 var count: float = 0.0
 for y in range(195, 525, 12):
  for x in range(220, 920, 12):
   sum += image.get_pixel(x, y)
   count += 1.0
 return sum / count

func _test() -> void:
 var scene: Node3D = load("res://scenes/rumah_ladang_psd_camera3d.tscn").instantiate()
 root.add_child(scene)
 await process_frame
 var camera: Camera3D = scene.get_node("Camera3D") as Camera3D
 var player: CharacterBody3D = scene.get_node("Run8Player") as CharacterBody3D
 var picker: Control = scene.get_node("LightingControls/LightingPicker") as Control
 var grade: ColorRect = scene.get_node("LightingOverlay/Atmosphere") as ColorRect
 var glow: ColorRect = scene.get_node("LightingOverlay/PorchGlow") as ColorRect
 if camera.projection != Camera3D.PROJECTION_ORTHOGONAL or player == null:
  _fail("Camera3D or physics character changed")
  return
 if not grade.mouse_filter == Control.MOUSE_FILTER_IGNORE or not glow.mouse_filter == Control.MOUSE_FILTER_IGNORE:
  _fail("lighting overlays steal touch/movement input")
  return
 scene.get_node("WeatherOverlay/RainWeather").call("set_raining", false)
 scene.set_process(false)
 scene.set_physics_process(false)
 scene.call("_set_lighting_preset", 1, true)
 if glow.visible:
  _fail("noon should be fully neutral")
  return
 var noon: Image = await _capture()
 scene.call("_set_lighting_preset", 2, true)
 var evening: Image = await _capture()
 scene.call("_set_lighting_preset", 3, true)
 if not glow.visible:
  _fail("night porch glow is inactive")
  return
 var night: Image = await _capture()
 scene.call("_set_lighting_preset", 0, true)
 var morning: Image = await _capture()
 var noon_avg: Color = _average(noon)
 var eve_avg: Color = _average(evening)
 var night_avg: Color = _average(night)
 var morning_avg: Color = _average(morning)
 var noon_energy: float = noon_avg.r + noon_avg.g + noon_avg.b
 var evening_energy: float = eve_avg.r + eve_avg.g + eve_avg.b
 var night_energy: float = night_avg.r + night_avg.g + night_avg.b
 var morning_energy: float = morning_avg.r + morning_avg.g + morning_avg.b
 print("PSD LIGHTING SAMPLES: noon=", noon_energy, " morning=", morning_energy, " evening=", evening_energy, " night=", night_energy)
 if not (noon_energy > morning_energy + 0.035 and noon_energy > evening_energy + 0.06 and evening_energy > night_energy + 0.18):
  _fail("GPU image did not change day to night in actual Camera3D viewport")
  return
 # The source illustration has baked golden highlights. Moonlight should
 # cool its hue compared with *that same art at noon*, not magically make
 # every orange roof tile bluer than red in absolute RGB terms.
 var noon_cool_ratio: float = noon_avg.b / maxf(0.01, noon_avg.r)
 var night_cool_ratio: float = night_avg.b / maxf(0.01, night_avg.r)
 print("PSD LIGHTING COOLING: noon_ratio=", noon_cool_ratio, " night_ratio=", night_cool_ratio)
 if night_cool_ratio < noon_cool_ratio * 1.28:
  _fail("night does not cool the painted daytime palette sufficiently")
  return
 if not (picker.has_signal("preset_delta") and scene.get_node_or_null("CollisionDebugOverlay") != null):
  _fail("mobile picker or collision tools were removed")
  return
 picker.emit_signal("preset_delta", 1)
 if int(scene.get("lighting_preset_index")) != 1:
  _fail("touch buttons do not update scene lighting")
  return
 if scene.get_node("HUD").get_child_count() != 0:
  _fail("lighting added a giant debug banner")
  return
 print("PSD LIGHTING PASS: four manual modes, real GPU pixels, touch preset picker, Camera3D/collision/character intact")
 scene.queue_free()
 quit(0)
