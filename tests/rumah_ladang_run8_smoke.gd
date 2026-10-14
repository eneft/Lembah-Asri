extends SceneTree
## Isolated test: new scene exists; old startup scene remains unchanged.
const EXPECTED := {
 "right": 8, "down_right": 10, "down": 10, "down_left": 10,
 "left": 8, "up_left": 10, "up": 8, "up_right": 10
}

func _initialize() -> void:
 call_deferred("_check")

func _fail(message: String) -> void:
 push_error("RUMAH LADANG RUN8 FAIL: " + message)
 quit(1)

func _check() -> void:
 if str(ProjectSettings.get_setting("application/run/main_scene")) != "res://scenes/house_garden_stage1.tscn":
  _fail("existing main scene was replaced")
  return
 var packed := load("res://scenes/rumah_ladang_run8_test.tscn") as PackedScene
 if packed == null:
  _fail("new separate test scene cannot load")
  return
 var world: Node2D = packed.instantiate()
 root.add_child(world)
 await process_frame
 var player: Variant = world.get_node_or_null("Run8Player")
 var sprite := world.get_node_or_null("Run8Player/AnimatedSprite2D") as AnimatedSprite2D
 var camera := world.get_node_or_null("Run8Player/FollowCamera") as Camera2D
 var background := world.get_node_or_null("Background") as Sprite2D
 if player == null or sprite == null or sprite.sprite_frames == null:
  _fail("new test scene cannot load real proportional RUN8 player")
  return
 if not player.has_method("set_idle_direction") or not player.has_method("set_run_direction"):
  _fail("test runner must implement both 8-way idle and run")
  return
 if str(player.get("animation_state")) != "idle" or str(sprite.animation) != "idle_down" or sprite.is_playing():
  _fail("standing character must start in a stopped front-facing IDLE pose")
  return
 if background == null or background.texture == null or background.texture.get_size() != Vector2(1672,941):
  _fail("new test background not valid 1672x941 texture")
  return
 if background.texture_filter != CanvasItem.TEXTURE_FILTER_LINEAR:
  _fail("texture-quality regression: background must use LINEAR, not NEAREST, at camera 1.25x")
  return
 print("RUMAH LADANG BACKGROUND FILTER PASS: linear interpolation at native texture size")
 var source_present: bool = ResourceLoader.exists("res://assets/art/scenes/rumah_ladang_empty.png")
 if bool(world.get("background_installed")) != source_present:
  _fail("background display status does not match installed source art")
  return
 if not source_present:
  _fail("approved original 1672x941 character-free background PNG is missing; do not ship fallback")
  return
 print("RUMAH LADANG BACKGROUND PASS: approved original PNG 1672x941 active")
 if world.get_node_or_null("HUD/HUDRoot/DirectionPanel") == null:
  _fail("8-way direction test controls missing")
  return
 if world.get_node_or_null("TouchOverlay/TouchControls") == null:
  _fail("mobile joystick layer missing")
  return
 if camera == null or not camera.zoom.is_equal_approx(Vector2(1.25,1.25)):
  _fail("test camera zoom does not match existing game camera")
  return
 if not camera.position_smoothing_enabled or camera.limit_right != 1672 or camera.limit_bottom != 941:
  _fail("test camera bounds or smoothing missing")
  return
 # This test uses no physics-based collisions: moving the runner in
 # _physics_process while the camera updates in idle causes browser judder.
 # Both must update at render time to avoid sampling stale/fractional targets.
 if not world.is_processing() or world.is_physics_processing():
  _fail("background jitter regression: player motion must use render _process, not physics ticks")
  return
 if camera.process_callback != Camera2D.CAMERA2D_PROCESS_IDLE:
  _fail("background jitter regression: Camera2D must update on idle/render ticks")
  return
 print("RUMAH LADANG CAMERA SYNC PASS: render-time runner and idle camera, frame-step cap")
 # Scene now starts in IDLE, which uses the source image's native
 # foot pivot and silhouette height. RUN has its own normalized 512x768
 # canvas and must still use (256,708) at 112 world pixels.
 var initial_idle_scale: float = 112.0 / float(player.IDLE_HEIGHT["down"])
 if not sprite.offset.is_equal_approx(Vector2(-528.0,-1464.0)) or not sprite.scale.is_equal_approx(Vector2.ONE * initial_idle_scale):
  _fail("standing IDLE DOWN foot pivot or 112 world-pixel scale is incorrect")
  return
 if player.get_node_or_null("FootContactShadow") == null:
  _fail("grounding shadow missing")
  return
 var count := 0
 for direction in EXPECTED:
  var key: String = "run_" + direction
  var frame_count: int = EXPECTED[direction]
  if not sprite.sprite_frames.has_animation(key) or sprite.sprite_frames.get_frame_count(key) != frame_count:
   _fail("RUN frame inventory mismatch " + key)
   return
  var expected_fps: float = 8.0 if direction in ["right","left"] else 10.0
  if not is_equal_approx(sprite.sprite_frames.get_animation_speed(key), expected_fps):
   _fail(key + " FPS must be " + str(expected_fps))
   return
  player.set_run_direction(direction)
  if sprite.animation != key or sprite.flip_h or not sprite.is_playing() or str(player.get("animation_state")) != "run":
   _fail("RUN direction did not play premirrored normalized frames: " + key)
   return
  if not sprite.offset.is_equal_approx(Vector2(-256,-708)) or not sprite.scale.is_equal_approx(Vector2.ONE * (112.0/640.0)):
   _fail("normalized RUN pivot or 112 world-pixel scale changed on " + direction)
   return
  var idle_key: String = "idle_" + direction
  if not sprite.sprite_frames.has_animation(idle_key) or sprite.sprite_frames.get_frame_count(idle_key) != 1:
   _fail("one native/mirrored standing IDLE frame is required for " + direction)
   return
  player.set_idle_direction(direction)
  if sprite.animation != idle_key or sprite.is_playing() or sprite.frame != 0 or str(player.get("animation_state")) != "idle":
   _fail("IDLE must stop running and retain facing " + direction)
   return
  var native: String = player._idle_native_direction(direction)
  var expected_mirror: bool = direction in ["left","down_left","up_left"]
  var expected_scale: float = 112.0 / float(player.IDLE_HEIGHT[native])
  if sprite.flip_h != expected_mirror or absf(sprite.scale.x - expected_scale) > 0.00001 or absf(sprite.scale.y - expected_scale) > 0.00001:
   _fail("IDLE mirror and 112px character scale incorrect for " + direction)
   return
  var idle_texture: Texture2D = sprite.sprite_frames.get_frame_texture(idle_key, 0)
  if idle_texture != player._idle_texture_for_native(native):
   _fail("IDLE image differs from approved standing sprite for " + direction)
   return
  count += frame_count
 if count != 74:
  _fail("expected 74 total RUN poses")
  return
 # Simulate movement via mobile vector so keyboard devices are not needed in CI.
 world.set("touch_direction", Vector2.RIGHT)
 world.call("_process", 1.0 / 60.0)
 if str(player.get("animation_state")) != "run" or sprite.animation != &"run_right":
  _fail("moving right must switch IDLE to RUN immediately")
  return
 world.set("touch_direction", Vector2.ZERO)
 world.call("_process", 1.0 / 60.0)
 if str(player.get("animation_state")) != "idle" or sprite.animation != &"idle_right" or sprite.is_playing():
  _fail("releasing movement must stop RUN and keep last right-facing IDLE")
  return
 print("RUMAH LADANG IDLE8 PASS: eight actual standstill poses; 5 native + 3 mirrored; stop/run/resume retains facing and feet")
 if world.get_node_or_null("GameplayHUDLayer") != null:
  _fail("new isolated scene must not modify/inherit the old gameplay HUD")
  return
 print("RUMAH LADANG RUN8 SMOKE PASS: separate scene, IDLE8+RUN8, 74 original RUN poses, left/right 8FPS, other six 10FPS, 112px foot pivot, camera, mobile, old main preserved")
 world.queue_free()
 quit(0)
