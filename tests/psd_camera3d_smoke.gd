extends SceneTree
## Regression: Camera3D real, original PSD order, animated 3D character.
func _initialize() -> void:
 call_deferred("_check")
func _fail(reason: String) -> void:
 push_error("PSD CAMERA3D FAIL: " + reason)
 quit(1)
func _check() -> void:
 var packed: PackedScene = load("res://scenes/rumah_ladang_psd_camera3d.tscn") as PackedScene
 if packed == null:
  _fail("scene cannot load")
  return
 var scene: Node3D = packed.instantiate()
 root.add_child(scene)
 await process_frame
 var camera: Camera3D = scene.get_node("Camera3D") as Camera3D
 var rig: Node3D = scene.get_node_or_null("ArtRig") as Node3D
 var root_nodes: Array[String] = []
 for child in scene.get_children():
  root_nodes.append(str(child.name))
 print("PSD CAMERA3D DEBUG root nodes: " + str(root_nodes))
 if rig == null:
  _fail("ArtRig missing")
  return
 var player: Node3D = scene.get_node_or_null("Run8Player") as Node3D
 if player == null:
  _fail("Run8Player missing below ArtRig")
  return
 var sprite: AnimatedSprite3D = player.get_node_or_null("AnimatedSprite3D") as AnimatedSprite3D
 if sprite == null:
  _fail("AnimatedSprite3D missing below Run8Player")
  return
 if camera == null or camera.projection != Camera3D.PROJECTION_ORTHOGONAL:
  _fail("expected a genuine orthographic Camera3D")
  return
 var names := ["Background", "Run8Player", "PSD_House", "PSD_Banana", "PSD_ForegroundTree"]
 var depths := [-0.20, -0.10, -0.04, 0.04, 0.12]
 for i in range(names.size()):
  var node: Node3D = scene.get_node(names[i]) as Node3D
  if str(node.name) != names[i] or absf(art_to_local_z(rig, node) - depths[i]) > 0.001:
   _fail("wrong PSD bottom-up layer order/depth: " + names[i])
   return
 if sprite == null or not sprite.sprite_frames.has_animation("idle_down") or not sprite.sprite_frames.has_animation("run_down"):
  _fail("approved RUN8/IDLE8 not attached to AnimatedSprite3D")
  return
 player.call("set_run_direction", "up_left")
 if sprite.animation != &"run_up_left" or not sprite.is_playing():
  _fail("RUN8 in 3D broken")
  return
 player.call("set_idle_direction", "up_left")
 if sprite.animation != &"idle_up_left" or sprite.is_playing():
  _fail("IDLE8 in 3D broken")
  return
 print("PSD CAMERA3D PASS: real Camera3D, 4 independently editable Sprite3D PSD planes, player between layer 1 and 2")
 quit(0)

func art_to_local_z(rig: Node3D, item: Node3D) -> float:
 return rig.to_local(item.global_position).z
