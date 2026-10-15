extends SceneTree
## Migration gate: verify the proposed native-2D scene without touching main.
func _initialize() -> void:
 call_deferred("_check")

func _fail(reason: String) -> void:
 push_error("PSD NATIVE2D FAIL: " + reason)
 quit(1)

func _check() -> void:
 if str(ProjectSettings.get_setting("application/run/main_scene")) != "res://scenes/rumah_ladang_psd_camera3d.tscn":
  _fail("production main scene was switched before approval")
  return
 var packed: PackedScene = load("res://scenes/rumah_ladang_psd_camera2d.tscn") as PackedScene
 if packed == null:
  _fail("new 2D scene missing")
  return
 var stage: Node2D = packed.instantiate()
 root.add_child(stage)
 await process_frame
 var cam: Camera2D = stage.get_node_or_null("Camera2D") as Camera2D
 var hero: CharacterBody2D = stage.get_node_or_null("Run8Player") as CharacterBody2D
 var sprite: AnimatedSprite2D = stage.get_node_or_null("Run8Player/AnimatedSprite2D") as AnimatedSprite2D
 var shadow: AnimatedSprite2D = stage.get_node_or_null("ProjectedShadow") as AnimatedSprite2D
 if cam == null or hero == null or sprite == null or shadow == null:
  _fail("native 2D camera, CharacterBody2D or live animated shadow missing")
  return
 if stage.get_node_or_null("Camera3D") != null or stage.get_node_or_null("ArtRig") != null:
  _fail("old Camera3D conversion is still in the proposed native scene")
  return
 if not bool(stage.get("psd_ready")):
  _fail("original PSD assets did not load")
  return
 if not hero.position.is_equal_approx(Vector2(820, 565)):
  _fail("original physical spawn was changed")
  return
 if absf(cam.zoom.y - 720.0 / 941.0) > 0.005:
  _fail("Camera2D zoom no longer fits the original canvas")
  return
 var points := ["Background", "PSD_House", "PSD_Banana", "PSD_ForegroundTree"]
 var sizes := [Vector2i(1672, 941), Vector2i(831, 624), Vector2i(295, 360), Vector2i(916, 893)]
 var origins := [Vector2.ZERO, Vector2(157,-107), Vector2(63,217), Vector2(-468,341)]
 for i in range(points.size()):
  var image: Sprite2D = stage.get_node(points[i]) as Sprite2D
  if image.texture == null or Vector2i(image.texture.get_size()) != sizes[i] or image.position != origins[i] or image.centered:
   _fail("migrated PSD art mismatch: " + points[i])
   return
 for direction in ["down", "down_right", "right", "up_right", "up", "up_left", "left", "down_left"]:
  for state in ["run_", "idle_"]:
   if sprite.sprite_frames == null or not sprite.sprite_frames.has_animation(state + direction):
    _fail("RUN8/IDLE8 lost animation " + state + direction)
    return
 hero.call("set_run_direction", "down_left")
 if sprite.animation != &"run_down_left" or not sprite.is_playing():
  _fail("native RUN8 not playing")
  return
 hero.call("set_idle_direction", "up_right")
 if sprite.animation != &"idle_up_right" or sprite.is_playing():
  _fail("native IDLE8 not holding")
  return
 if shadow.sprite_frames != sprite.sprite_frames or shadow.material == null:
  _fail("silhouette shadow not attached to actual sprite frames")
  return
 var shape: CollisionShape2D = hero.get_node("CollisionShape2D") as CollisionShape2D
 if not (shape.shape is CircleShape2D) or absf((shape.shape as CircleShape2D).radius-9.0)>0.001:
  _fail("native circular physical foot radius lost")
  return
 var container: Node2D = stage.get_node("CollisionBodies") as Node2D
 var native_edges: int = 0
 for child in container.get_children():
  if child is StaticBody2D:
   var border: CollisionPolygon2D = child.get_node_or_null("WalkableEdge") as CollisionPolygon2D
   if border != null and border.build_mode == CollisionPolygon2D.BUILD_SEGMENTS and child.collision_layer == 2:
    native_edges += 1
 if native_edges < 1 or native_edges > 3:
  _fail("walk regions did not generate merged native 2D collision bodies; got " + str(native_edges))
  return
 for safe in [Vector2(700, 530), Vector2(820,565), Vector2(1120,605), Vector2(1320,680), Vector2(1460,739)]:
  if not bool(stage.call("_is_walkable_foot", safe)):
   _fail("walkable grass/bridge denied " + str(safe))
   return
 for forbidden in [Vector2(600,290),Vector2(840,735),Vector2(1020,860),Vector2(1340,833),Vector2(1540,626)]:
  if bool(stage.call("_is_walkable_foot", forbidden)):
   _fail("house or river leak " + str(forbidden))
   return
 if stage.get_node_or_null("RainWeather/GroundPuddles") == null or stage.get_node_or_null("TouchOverlay/TouchControls") == null:
  _fail("weather and mobile input weren't migrated")
  return
 stage.call("_set_lighting_preset",3,true)
 if not stage.get_node("LightingOverlay/PorchGlow").visible:
  _fail("night lighting / porch shader not working")
  return
 print("PSD NATIVE2D PASS: genuine Camera2D and CharacterBody2D, pixel-exact PSD layers, merged physics collision, bridge, RUN8/IDLE8, weather and lighting")
 stage.queue_free()
 quit(0)
