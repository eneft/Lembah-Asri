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
 var authored_collision: Dictionary = JSON.parse_string(
  FileAccess.get_file_as_string("res://assets/art/psd_layered_scene/collision_polygons.json"))
 var marker: Array = authored_collision.get("hero_spawn_foot", [])
 if marker.size() != 2 or not hero.position.is_equal_approx(Vector2(float(marker[0]), float(marker[1]))):
  _fail("character must spawn at current Photoshop marker, not a stale fixed coordinate")
  return
 var full_fit: float = minf(1280.0 / 1672.0, 720.0 / 941.0)
 var expected_zoom: float = full_fit * float(stage.get("camera_follow_zoom"))
 if absf(cam.zoom.y - expected_zoom) > 0.005 or cam.zoom.y < full_fit * 1.20:
  _fail("Camera2D does not crop enough to follow the character")
  return
 # The camera target must actually move when the avatar walks; a fit-all
 # camera's clamping used to lock this position at world center.
 var base_position: Vector2 = hero.position
 hero.position = Vector2(610, 465)
 stage.call("_move_camera_to_player", true)
 var first_camera: Vector2 = cam.position
 hero.position = Vector2(1100, 615)
 stage.call("_move_camera_to_player", true)
 var second_camera: Vector2 = cam.position
 hero.position = base_position
 stage.call("_move_camera_to_player", true)
 if second_camera.x - first_camera.x < 150.0 or second_camera.y - first_camera.y < 30.0:
  _fail("Camera2D still locked to center instead of following movement")
  return
 var background: Sprite2D = stage.get_node("Background") as Sprite2D
 if background.texture == null or background.texture.get_size() != Vector2(1672, 941):
  _fail("original 1672x941 PSD Background missing")
  return
 if background.texture.resource_path != "res://assets/art/psd_layered_scene/00_background.png":
  _fail("scene did not load latest authored Background")
  return
 var stack: Node2D = stage.get_node_or_null("PSDLayerStack") as Node2D
 if stack == null or stack.get_child_count() != 11:
  _fail("not all ten individually editable PSD overlays imported")
  return
 var psd_manifest: Dictionary = JSON.parse_string(
  FileAccess.get_file_as_string("res://assets/art/psd_layered_scene/manifest.json"))
 var layers: Array = psd_manifest.get("layers", [])
 if layers.size() != stack.get_child_count() + 1:
  _fail("PSDs and Godot scene missing authentic layers")
  return
 var drawn_files: Dictionary = {}
 for node in stack.get_children():
  var art: Sprite2D = node as Sprite2D
  if art == null or art.texture == null or art.centered:
   _fail("missing real PSD layer image")
   return
  drawn_files[art.texture.resource_path.get_file()] = art
 for info in layers:
  var bounds: Array = info["bbox"]
  var filename: String = str(info["filename"])
  var original_order: int = int(info["source_order"])
  var item: Sprite2D = background if filename == "00_background.png" else drawn_files.get(filename) as Sprite2D
  if item == null or item.texture == null:
   _fail("Photoshop source layer missing: " + filename)
   return
  if item.position != Vector2(float(bounds[0]),float(bounds[1])):
   _fail("Photoshop world coordinate drift: " + filename)
   return
  if item.z_index != original_order * 2:
   _fail("Photoshop layer order lost: " + filename)
   return
  if item.texture.get_size() != Vector2(float(bounds[2]) - float(bounds[0]),float(bounds[3]) - float(bounds[1])):
   _fail("Photoshop pixel dimensions changed: " + filename)
   return
 if background.z_index != 0:
  _fail("Background must be the bottom-most layer")
  return
 var foreground: Sprite2D = stack.get_node_or_null("Foreground") as Sprite2D
 if foreground == null or foreground.texture == null:
  _fail("User-authored forground is missing from Camera2D scene")
  return
 var authored_foreground: Dictionary
 for info in layers:
  if str(info["name"]) == "forground":
   authored_foreground = info
 if authored_foreground.is_empty():
  _fail("User-authored forground was silently dropped from PSD manifest")
  return
 if foreground.texture.resource_path != "res://assets/art/psd_layered_scene/11_foreground.png":
  _fail("Foreground must use authentic exported Photoshop pixels")
  return
 var hero_order: int = int(psd_manifest.get("hero_marker_source_order", -1))
 if foreground.z_index <= hero_order * 2:
  _fail("Foreground must overlap the character from its exact PSD source order")
  return
 if hero_order < 1 or hero.z_index != hero_order * 2 or shadow.z_index != hero.z_index - 1:
  _fail("original Photoshop placeholder z order not applied to RUN8/IDLE8")
  return
 if stage.get_node_or_null("Collision") != null:
  _fail("Photoshop red collision paint was rendered as actual scenery")
  return
 var contact: Node2D = stage.get_node_or_null("FootContactShadow") as Node2D
 if contact == null or not contact.has_method("_sync_contact"):
  _fail("grounded foot contact shadow missing")
  return
 contact.call("_sync_contact", true)
 if not contact.position.is_equal_approx(hero.position + Vector2(0, 1)):
  _fail("contact shadow must meet the moving avatar foot, not float away")
  return
 for direction in ["down", "down_right", "right", "up_right", "up", "up_left", "left", "down_left"]:
  for state in ["run_", "idle_"]:
   if sprite.sprite_frames == null or not sprite.sprite_frames.has_animation(state + direction):
    _fail("RUN8/IDLE8 lost animation " + state + direction)
    return
 var sprite_atlas: Texture2D = sprite.sprite_frames.get_frame_texture("run_down", 0)
 if not (sprite_atlas is AtlasTexture):
  _fail("GPU-costly single-frame textures returned: 2D must share atlases")
  return
 if int(hero.get("generated_atlas_count")) != 3:
  _fail("RUN8/IDLE8 must use the same three reduced shared atlases")
  return
 var original_offset: Vector2 = sprite.offset
 hero.call("set_run_direction", "down")
 sprite.set_frame_and_progress(3, 0.0)
 await process_frame
 if not sprite.offset.is_equal_approx(original_offset):
  _fail("per-frame foot offset jumps remain and cause RUN stutter")
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
 var authored_shapes: Array = authored_collision.get("polygons", [])
 if authored_shapes.is_empty() or authored_shapes.size() > 128:
  _fail("source PSD collision contours missing")
  return
 var solid_count: int = 0
 var boundary_count: int = 0
 for child in container.get_children():
  if not (child is StaticBody2D) or child.collision_layer != 2:
   _fail("invalid collision body found")
   return
  var solid: CollisionPolygon2D = child.get_node_or_null("PSD_RedBlockedArea") as CollisionPolygon2D
  var border: CollisionPolygon2D = child.get_node_or_null("CanvasEdge") as CollisionPolygon2D
  if solid != null:
   if solid.build_mode != CollisionPolygon2D.BUILD_SOLIDS or solid_count >= authored_shapes.size():
    _fail("collision body shape mismatch")
    return
   var points: PackedVector2Array = PackedVector2Array()
   for pair in authored_shapes[solid_count]:
    points.append(Vector2(float(pair[0]),float(pair[1])))
   if solid.polygon != points:
    _fail("Godot polygon differs from exact authored PSD collision contour")
    return
   solid_count += 1
  if border != null and border.build_mode == CollisionPolygon2D.BUILD_SEGMENTS:
   boundary_count += 1
 if solid_count != authored_shapes.size() or boundary_count != 1:
  _fail("Godot collision count stale: got %d, expected %d" % [solid_count, authored_shapes.size()])
  return
 if not bool(stage.call("_is_walkable_foot",hero.position)):
  _fail("Photoshop character marker collides with newly painted obstacles")
  return
 # Exact authored red obstacles stay unchanged; also block explicit water
 # regions, without sacrificing the crossing on the wooden bridge.
 for blocked_water in [Vector2(1100, 820), Vector2(1610, 615)]:
  if bool(stage.call("_is_walkable_foot",blocked_water)):
   _fail("native character can stand in river away from bridge: " + str(blocked_water))
   return
 for bridge_foot in [Vector2(1320, 678), Vector2(1400, 711)]:
  if not bool(stage.call("_is_walkable_foot",bridge_foot)):
   _fail("river guard incorrectly blocked the wooden crossing: " + str(bridge_foot))
   return
 if not bool(stage.call("_is_walkable_foot",Vector2(1618,872))):
  _fail("far-bank rain path became an impassable water zone")
  return
 if stage.get_node_or_null("RainWeather/GroundPuddles") == null or stage.get_node_or_null("TouchOverlay/TouchControls") == null:
  _fail("weather and mobile input weren't migrated")
  return
 stage.call("_set_lighting_preset",3,true)
 if not stage.get_node("LightingOverlay/PorchGlow").visible:
  _fail("night lighting / porch shader not working")
  return
 print("PSD NATIVE2D PASS: %d original PSD art layers, %d hand-painted collision solids, hero at current marker, Camera2D, native RUN8/IDLE8 and weather" % [layers.size(),solid_count])
 stage.queue_free()
 quit(0)
