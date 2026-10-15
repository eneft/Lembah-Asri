extends SceneTree
## 3/4 illustrated perspective regression for the live PSD Camera3D scene.
## Unlike a generic zoom test, this verifies the actual ProjectedPlayer scale
## using world-space foot coordinates, both cardinal and diagonal animations.
func _initialize() -> void:
 call_deferred("_check")

func _fail(reason: String) -> void:
 push_error("PSD DEPTH FAIL: " + reason)
 quit(1)

func _check() -> void:
 var packed: PackedScene = load("res://scenes/rumah_ladang_psd_camera3d.tscn") as PackedScene
 if packed == null:
  _fail("cannot load PSD scene")
  return
 var world: Node3D = packed.instantiate()
 root.add_child(world)
 await process_frame
 var rig: Node3D = world.get_node("ArtRig") as Node3D
 var character: CharacterBody3D = world.get_node("Run8Player") as CharacterBody3D
 var image: AnimatedSprite2D = world.get_node("CharacterOverlay/ProjectedPlayer") as AnimatedSprite2D
 var driver: AnimatedSprite3D = character.get_node("AnimatedSprite3D") as AnimatedSprite3D
 var cam: Camera3D = world.get_node("Camera3D") as Camera3D
 var collision: CollisionShape3D = character.get_node("CollisionShape3D") as CollisionShape3D
 if image.sprite_frames == null or collision.shape == null:
  _fail("real animated frames or physics foot collider missing")
  return
 if not is_equal_approx(cam.size, 9.41):
  _fail("approved full-PSD orthographic camera changed")
  return
 var far: float = float(world.call("_character_depth_multiplier", Vector2(800, 360)))
 var middle: float = float(world.call("_character_depth_multiplier", Vector2(800, 570)))
 var near: float = float(world.call("_character_depth_multiplier", Vector2(800, 810)))
 var bridge: float = float(world.call("_character_depth_multiplier", Vector2(1400, 675)))
 var yard_same_y: float = float(world.call("_character_depth_multiplier", Vector2(800, 675)))
 var no_boost_above: float = float(world.call("_character_depth_multiplier", Vector2(1400, 400)))
 var far_same_y: float = float(world.call("_character_depth_multiplier", Vector2(800, 400)))
 if not (far < middle and middle < near and far > 0.80 and near < 1.30):
  _fail("distant/middle/near scaling must increase naturally with foot Y")
  return
 if bridge <= yard_same_y + 0.045 or bridge > 1.3:
  _fail("bottom-right bridge zone correction was lost or exaggerated")
  return
 if absf(no_boost_above - far_same_y) > 0.001:
  _fail("walking sideways in far yard must not trigger bridge scaling")
  return
 # Smooth blending: no abrupt jump when the player enters a scale zone.
 for y in range(370, 820, 8):
  var left: float = float(world.call("_character_depth_multiplier", Vector2(1250, y)))
  var right: float = float(world.call("_character_depth_multiplier", Vector2(1250, y + 1)))
  if absf(right - left) > 0.005:
   _fail("scale snapped at Y " + str(y))
   return
 var original_offset: Vector2 = image.offset
 var original_collision_size: float = (collision.shape as SphereShape3D).radius
 var native_density: float = float(character.get("raster_density"))
 var native_scale: float = float(character.get("character_height_px")) / (640.0 * native_density)
 for foot in [Vector2(800, 380), Vector2(800, 570), Vector2(800, 790), Vector2(1390, 665)]:
  character.global_position = rig.to_global(world.call("_pixel_to_local", foot, -0.10))
  world.call("_sync_projected_player")
  var expected: float = native_scale * float(world.call("_character_depth_multiplier", foot))
  if not image.scale.is_equal_approx(Vector2.ONE * expected):
   _fail("render-only scale does not follow world foot at " + str(foot))
   return
  if not image.offset.is_equal_approx(original_offset) or not is_equal_approx((collision.shape as SphereShape3D).radius, original_collision_size):
   _fail("depth scaling changed character pivot or collision")
   return
 for direction in ["down", "right", "up_left", "down_right"]:
  character.call("set_run_direction", direction)
  world.call("_sync_projected_player")
  if image.animation != driver.animation:
   _fail("RUN8 driver direction lost on " + direction)
   return
  character.call("set_idle_direction", direction)
  world.call("_sync_projected_player")
  if image.animation != driver.animation:
   _fail("IDLE8 direction lost on " + direction)
   return
 print("PSD DEPTH PASS: far=", far, " middle=", middle, " near=", near, " bridge=", bridge, " yard_same_y=", yard_same_y, " smooth Y+X blend, foot pivot/physics and 8-way animations intact")
 world.queue_free()
 quit(0)
