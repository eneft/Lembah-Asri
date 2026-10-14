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
 if background == null or background.texture == null or background.texture.get_size() != Vector2(1672,941):
  _fail("new test background not valid 1672x941 texture")
  return
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
 if not sprite.offset.is_equal_approx(Vector2(-256,-708)) or not sprite.scale.is_equal_approx(Vector2.ONE * (112.0/640.0)):
  _fail("character foot pivot or scale changed from 112 world pixels")
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
  player.set_direction(direction)
  if sprite.animation != key or sprite.flip_h or not sprite.is_playing():
   _fail("RUN direction did not play premirrored normalized frames: " + key)
   return
  count += frame_count
 if count != 74:
  _fail("expected 74 total RUN poses")
  return
 if world.get_node_or_null("GameplayHUDLayer") != null:
  _fail("new isolated scene must not modify/inherit the old gameplay HUD")
  return
 print("RUMAH LADANG RUN8 SMOKE PASS: separate scene, 74 proportional RUN poses, left/right 8FPS, six other directions 10FPS, 112px pivot, camera, mobile and old main preserved")
 world.queue_free()
 quit(0)
