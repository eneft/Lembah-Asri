extends SceneTree
## Prove browser /run8/ uses the approved 74-pose proportional player,
## NOT the outdated 16-frame WALK-based demo in run8_test.tscn.
const FRAME_COUNTS := {
 "right": 8, "down_right": 10, "down": 10, "down_left": 10,
 "left": 8, "up_left": 10, "up": 8, "up_right": 10
}
const BASE_PATH := "res://assets/characters/run8_proportional/Run8_Normalized_Base.png"
const MIRROR_PATH := "res://assets/characters/run8_proportional/Run8_Normalized_Mirror.png"

func _initialize() -> void:
 call_deferred("_check")

func _fail(message: String) -> void:
 push_error("PROPORTIONAL RUN8 FAIL: " + message)
 quit(1)

func _check() -> void:
 if not ResourceLoader.exists(BASE_PATH) or not ResourceLoader.exists(MIRROR_PATH):
  _fail("approved PNG atlas is not installed")
  return
 var packed := load("res://scenes/run8_proportional_test.tscn") as PackedScene
 if packed == null:
  _fail("new proportional preview scene missing")
  return
 var scene: Node2D = packed.instantiate()
 root.add_child(scene)
 await process_frame
 var player: Variant = scene.get_node_or_null("Run8Player")
 var sprite := scene.get_node_or_null("Run8Player/AnimatedSprite2D") as AnimatedSprite2D
 if player == null or sprite == null or sprite.sprite_frames == null:
  _fail("preview did not instantiate real proportional Run8Player")
  return
 if scene.get_node_or_null("HUD/Overlay/DirectionPanel") == null:
  _fail("mobile 8-direction buttons missing from new preview")
  return
 if not bool(scene.get("auto_rotate")):
  _fail("approved preview must auto-play all eight RUN directions")
  return
 if sprite.flip_h:
  _fail("left-facing frames are pre-mirrored; flip_h must be disabled")
  return
 if not sprite.offset.is_equal_approx(Vector2(-256.0,-708.0)):
  _fail("foot pivot differs from approved (256,708)")
  return
 if not sprite.scale.is_equal_approx(Vector2.ONE * (244.0/640.0)):
  _fail("preview changed approved normalized body proportions")
  return
 if absf(player.frames_per_second - 10.0) > 0.01:
  _fail("preview must run at 10 FPS")
  return
 var total := 0
 for direction in FRAME_COUNTS:
  var key: String = "run_" + direction
  var expected: int = FRAME_COUNTS[direction]
  if not sprite.sprite_frames.has_animation(key) or sprite.sprite_frames.get_frame_count(key) != expected:
   _fail("expected " + str(expected) + " approved RUN poses in " + key)
   return
  if absf(sprite.sprite_frames.get_animation_speed(key) - 10.0) > 0.01:
   _fail("wrong native FPS for " + key)
   return
  total += expected
  player.set_direction(direction)
  if sprite.animation != key or sprite.flip_h or not sprite.is_playing():
   _fail("failed to play genuine premirrored " + key)
   return
 if total != 74:
  _fail("approved frame inventory must total 74, found " + str(total))
  return
 # Confirm the actual atlas is used, rather than the similarly-named
 # old walk16 run8_test.tscn. Only sample a single texture, no decode loops.
 var first_frame := sprite.sprite_frames.get_frame_texture("run_down", 0) as AtlasTexture
 if first_frame == null or first_frame.atlas == null:
  _fail("approved down frame is not an AtlasTexture")
  return
 if first_frame.atlas.resource_path != BASE_PATH:
  _fail("preview sourced wrong PNG atlas: " + first_frame.atlas.resource_path)
  return
 scene.queue_free()
 print("PROPORTIONAL RUN8 PASS: web test source is approved normalized atlas, 8 RUN directions, 74 frames, 10fps, no legacy 16-frame WALK, foot pivot correct")
 quit(0)
