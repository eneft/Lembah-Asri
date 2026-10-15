extends SceneTree
## Pixel-level regression: scene metadata alone cannot prove the player is visible.
func _initialize() -> void:
 call_deferred("_check")

func _fail(reason: String) -> void:
 push_error("PSD VISUAL FAIL: " + reason)
 quit(1)

func _snapshot() -> Image:
 await process_frame
 await RenderingServer.frame_post_draw
 return root.get_texture().get_image()

func _check() -> void:
 var packed := load("res://scenes/rumah_ladang_psd_camera3d.tscn") as PackedScene
 if packed == null:
  _fail("PSD main scene cannot load")
  return
 var world: Node3D = packed.instantiate()
 root.add_child(world)
 await process_frame
 var camera := world.get_node("Camera3D") as Camera3D
 var player := world.get_node("Run8Player") as CharacterBody3D
 var sprite := player.get_node("AnimatedSprite3D") as AnimatedSprite3D
 world.get_node("WeatherOverlay/RainWeather").call("set_raining", false)
 world.set_process(false)
 world.set_physics_process(false)
 var texture: Texture2D = sprite.sprite_frames.get_frame_texture("idle_down", 0)
 var artwork: Image = texture.get_image()
 var used_rect: Rect2i = artwork.get_used_rect()
 var foot_screen: Vector2 = camera.unproject_position(player.global_position)
 print("PSD VISUAL DEBUG: sprite rect=", used_rect, " frame=", artwork.get_size(), " visible=", sprite.visible, " world_pos=", player.global_position, " camera_pos=", camera.global_position, " projected_foot=", foot_screen, " pixel_size=", sprite.pixel_size)
 if used_rect.size.x < 5 or used_rect.size.y < 5:
  _fail("RUN8/IDLE8 sprite texture is blank")
  return
 var with_player: Image = await _snapshot()
 sprite.visible = false
 var without_player: Image = await _snapshot()
 if with_player.is_empty() or without_player.is_empty():
  _fail("GPU screenshot is empty")
  return
 var rect := Rect2i(Vector2i(roundi(foot_screen.x) - 130, roundi(foot_screen.y) - 190), Vector2i(260, 230))
 var start_x: int = maxi(0, rect.position.x)
 var end_x: int = mini(with_player.get_width(), rect.end.x)
 var start_y: int = maxi(0, rect.position.y)
 var end_y: int = mini(with_player.get_height(), rect.end.y)
 var changed: int = 0
 for y in range(start_y, end_y, 2):
  for x in range(start_x, end_x, 2):
   var on: Color = with_player.get_pixel(x, y)
   var off: Color = without_player.get_pixel(x, y)
   if absf(on.r - off.r) + absf(on.g - off.g) + absf(on.b - off.b) > 0.24:
    changed += 1
 print("PSD VISUAL QA: player_changed_pixels=", changed, " foot_screen=", foot_screen, " size=", with_player.get_size())
 if changed < 100:
  _fail("main character not visibly drawn in Camera3D despite present SpriteFrames; changed=" + str(changed))
  return
 sprite.visible = true
 world.queue_free()
 print("PSD VISUAL PASS: Camera3D actually renders protagonist pixels in gameplay viewport")
 quit(0)
