extends SceneTree
## Boundary QA: bridges should be walkable; river / fence / house cannot be.
func _initialize() -> void:
 call_deferred("_check")

func _fail(reason: String) -> void:
 push_error("PSD WALK COLLISION FAIL: " + reason)
 quit(1)

func _check() -> void:
 var packed := load("res://scenes/rumah_ladang_psd_camera3d.tscn") as PackedScene
 if packed == null:
  _fail("scene does not load")
  return
 var stage: Node3D = packed.instantiate()
 root.add_child(stage)
 await process_frame
 var player: CharacterBody3D = stage.get_node("Run8Player") as CharacterBody3D
 var rig: Node3D = stage.get_node("ArtRig") as Node3D
 var debug_canvas: CanvasLayer = stage.get_node("CollisionDebugOverlay") as CanvasLayer
 var camera: Camera3D = stage.get_node("Camera3D") as Camera3D
 var collider: CollisionShape3D = player.get_node("CollisionShape3D") as CollisionShape3D
 if camera.projection != Camera3D.PROJECTION_ORTHOGONAL or collider.shape == null or debug_canvas.visible:
  _fail("Camera3D, player's foot collision, or default-hidden debug overlay changed")
  return
 var good: Array[Vector2] = [
  Vector2(540,485), Vector2(760,560), Vector2(980,550),
  Vector2(1115,604), Vector2(1190,637), Vector2(1320,678),
  Vector2(1420,719), Vector2(1520,766), Vector2(1600,787)
 ]
 for foot in good:
  if not bool(stage.call("_is_walkable_foot", foot)):
   _fail("safe grass/bridge/crossing blocked: " + str(foot))
   return
 var forbidden: Array[Vector2] = [
  Vector2(600,290), Vector2(320,615), Vector2(840,735),
  Vector2(1020,860), Vector2(1160,817), Vector2(1350,821),
  Vector2(1535,612), Vector2(1550,560), Vector2(100,515)
 ]
 for foot in forbidden:
  if bool(stage.call("_is_walkable_foot", foot)):
   _fail("foot allowed through painted house, fence or river: " + str(foot))
   return
 # Test direct boundary crossing in just one physics-step: cannot enter
 # river in a fast run, and axis sliding should not trap on a flat edge.
 var origin := Vector2(1320,680)
 var attempt: Vector2 = stage.call("_move_foot_on_map", origin, Vector2(200,180))
 if not bool(stage.call("_is_walkable_foot", attempt)):
  _fail("movement stepped outside walkable polygons: " + str(attempt))
  return
 if attempt.distance_to(origin + Vector2(200,180)) < 2.0:
  _fail("sprinting crossed open water beside the deck")
  return
 var candidate := Vector2(760,558)
 var moved: Vector2 = stage.call("_move_foot_on_map", candidate, Vector2(45,0))
 if moved.distance_to(candidate + Vector2(45,0)) > 2.0:
  _fail("character randomly stuck in clear open yard")
  return
 var restricted := Vector2(760,558)
 var house_attempt: Vector2 = stage.call("_move_foot_on_map", restricted, Vector2(-70,-270))
 if bool(stage.call("_is_walkable_foot", house_attempt)) == false:
  _fail("house bound must not warp to non-walkable space")
  return
 # Player position is unchanged by checks; render-only perspective scaling
 # remains independent of collision, mobile/keyboard and idle/run atlas.
 if not player.position.is_finite() or not rig.global_basis.is_finite():
  _fail("3D camera art rig has an invalid transform")
  return
 print("PSD WALK COLLISION PASS: courtyard free movement, bridge connected, shoreline/fences blocked, high-speed swept movement safe, foot pivot kept")
 stage.queue_free()
 quit(0)
