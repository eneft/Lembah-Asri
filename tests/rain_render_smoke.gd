extends SceneTree
## Godot Compatibility visual verification for batched rain (not just source tests).
func _initialize() -> void:
 call_deferred("_check")

func _snapshot(view: SubViewport) -> Image:
 await process_frame
 await process_frame
 await RenderingServer.frame_post_draw
 return view.get_texture().get_image()

func _count_visible(image: Image) -> int:
 var count: int = 0
 for y in range(0, image.get_height(), 2):
  for x in range(0, image.get_width(), 2):
   if image.get_pixel(x, y).a > 0.025:
    count += 1
 return count

func _check() -> void:
 var view := SubViewport.new()
 view.size = Vector2i(640, 360)
 view.transparent_bg = true
 view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
 root.add_child(view)
 var scene: PackedScene = load("res://scenes/weather/rain_weather.tscn") as PackedScene
 if scene == null:
  push_error("RAIN RENDER FAIL: weather scene missing")
  quit(1)
  return
 var weather: Node2D = scene.instantiate()
 view.add_child(weather)
 var on_image: Image = await _snapshot(view)
 var rain_pixels: int = _count_visible(on_image)
 weather.call("set_raining", false)
 var off_image: Image = await _snapshot(view)
 var dry_pixels: int = _count_visible(off_image)
 print("RAIN RENDER QA: %d rain pixels and %d dry pixels; MultiMesh compatibility" % [rain_pixels, dry_pixels])
 if rain_pixels < 16 or dry_pixels > 2:
  push_error("RAIN RENDER FAIL: GPU batch missing, invisible or disable toggle not clearing")
  quit(1)
  return
 view.queue_free()
 print("RAIN RENDER PASS: batched rain visible on GPU, rain OFF clears screen")
 quit(0)
