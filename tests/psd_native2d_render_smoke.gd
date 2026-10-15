extends SceneTree
## Actual 2D compositor regression: player and shadow must change GPU pixels.
func _initialize() -> void:
 call_deferred("_check")

func _fail(why: String) -> void:
 push_error("PSD NATIVE2D RENDER FAIL: " + why)
 quit(1)

func _capture() -> Image:
 await process_frame
 await RenderingServer.frame_post_draw
 return root.get_texture().get_image()

func _difference(a: Image, b: Image, center: Vector2) -> int:
 var hits: int = 0
 for y in range(maxi(0, roundi(center.y) - 135), mini(a.get_height(), roundi(center.y) + 125), 2):
  for x in range(maxi(0, roundi(center.x)-150), mini(a.get_width(), roundi(center.x)+150), 2):
   var left: Color = a.get_pixel(x,y)
   var right: Color = b.get_pixel(x,y)
   if absf(left.r-right.r)+absf(left.g-right.g)+absf(left.b-right.b)>0.055:
    hits += 1
 return hits

func _check() -> void:
 var stage: Node2D = (load("res://scenes/rumah_ladang_psd_camera2d.tscn") as PackedScene).instantiate()
 root.add_child(stage)
 await process_frame
 stage.get_node("RainWeather").call("set_raining",false)
 stage.set_process(false)
 stage.set_physics_process(false)
 var sprite: AnimatedSprite2D = stage.get_node("Run8Player/AnimatedSprite2D") as AnimatedSprite2D
 var shadow: AnimatedSprite2D = stage.get_node("ProjectedShadow") as AnimatedSprite2D
 var foot: Vector2 = stage.get_node("Run8Player").position
 shadow.call("_sync_shadow",0.0,true)
 await process_frame
 var camera_screen: Vector2 = root.get_viewport().get_canvas_transform() * foot
 print("PSD NATIVE2D SHADOW DIAG: visible=",shadow.visible," bank=",shadow.sprite_frames != null," frame=",shadow.frame," anim=",shadow.animation," offset=",shadow.offset," transform=",shadow.transform," alpha=",(shadow.material as ShaderMaterial).get_shader_parameter("shadow_opacity")," sprite=",sprite.animation, " herofoot=",foot," screenfoot=",camera_screen)
 var both: Image = await _capture()
 sprite.visible = false
 var only_shadow: Image = await _capture()
 var hero_pixels: int = _difference(both,only_shadow,camera_screen)
 sprite.visible = true
 shadow.visible = false
 var without_shadow: Image = await _capture()
 var shadow_pixels: int = _difference(both,without_shadow,camera_screen)
 sprite.visible = false
 shadow.visible = true
 var shadow_only: Image = await _capture()
 shadow.visible = false
 var background_only: Image = await _capture()
 var isolated: int = _difference(shadow_only,background_only,camera_screen)
 shadow.visible = true
 sprite.visible = true
 print("PSD NATIVE2D SHADOW TEST: standard_pixels=",shadow_pixels," isolated_pixels=",isolated)
 if hero_pixels < 90:
  _fail("hero missing from native Camera2D pixels: " + str(hero_pixels))
  return
 if shadow_pixels < 18:
  _fail("moving silhouette shadow missing native Camera2D pixels: " + str(shadow_pixels))
  return
 shadow.visible = true
 stage.call("_set_lighting_preset",1,true)
 var noon: Image = await _capture()
 stage.call("_set_lighting_preset",3,true)
 var night: Image = await _capture()
 var scene_change: int = 0
 for y in range(120,600,16):
  for x in range(120,1160,16):
   var a: Color = noon.get_pixel(x,y)
   var b: Color = night.get_pixel(x,y)
   if absf(a.r-b.r)+absf(a.g-b.g)+absf(a.b-b.b)>0.12:
    scene_change += 1
 if scene_change < 100:
  _fail("night lighting not visible in native Camera2D renderer")
  return
 print("PSD NATIVE2D RENDER PASS: hero_pixels=",hero_pixels," silhouette_pixels=",shadow_pixels," light_changed=",scene_change," native Camera2D")
 stage.queue_free()
 quit(0)
