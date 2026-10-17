extends SceneTree
## Migration gate: verify the proposed native-2D scene without touching main.
func _initialize() -> void:
 call_deferred("_check")

func _fail(reason: String) -> void:
 push_error("PSD NATIVE2D FAIL: " + reason)
 quit(1)

func _check() -> void:
 if str(ProjectSettings.get_setting("application/run/main_scene")) != "res://scenes/rumah_ladang_psd_camera2d.tscn":
  _fail("published main scene must run the approved mobile-follow Camera2D")
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
 var banana_guard_count: int = 0
 for child in container.get_children():
  if not (child is StaticBody2D) or child.collision_layer != 2:
   _fail("invalid collision body found")
   return
  var solid: CollisionPolygon2D = child.get_node_or_null("PSD_RedBlockedArea") as CollisionPolygon2D
  var border: CollisionPolygon2D = child.get_node_or_null("CanvasEdge") as CollisionPolygon2D
  var guard: CollisionPolygon2D = child.get_node_or_null("SupplementalFenceFootprint") as CollisionPolygon2D
  if guard != null:
   if child.name != "LeftBananaFenceGuard" or guard.build_mode != CollisionPolygon2D.BUILD_SOLIDS:
    _fail("supplementary banana-fence collision shape invalid")
    return
   var guard_regions: Array = stage.get("supplemental_barriers")
   if guard_regions.size() != 1 or guard.polygon != guard_regions[0]:
    _fail("banana-fence physics shape does not match swept-foot barrier")
    return
   banana_guard_count += 1
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
 if solid_count != authored_shapes.size() or boundary_count != 1 or banana_guard_count != 1:
  _fail("Godot collision count stale: got %d PSD solids, %d border, %d banana-fence guard" % [
   solid_count, boundary_count, banana_guard_count])
  return
 if not bool(stage.call("_is_walkable_foot",hero.position)):
  _fail("Photoshop character marker collides with newly painted obstacles")
  return
 # Banana fence, near the left banana trees: these points used to be
 # WALKABLE despite appearing directly in the wooden rail/wall footprint.
 # Verify both sides of the unpainted gap and verify the main yard remains free.
 for fence_foot in [Vector2(100, 525), Vector2(175, 570), Vector2(220, 608), Vector2(256, 625)]:
  if bool(stage.call("_is_walkable_foot",fence_foot)):
   _fail("character can still pass through banana-tree wooden fence: " + str(fence_foot))
   return
 for open_foot in [Vector2(190, 665), Vector2(350, 680), Vector2(630, 570)]:
  if not bool(stage.call("_is_walkable_foot",open_foot)):
   _fail("banana-fence fix blocked legitimate nearby footpath/yard: " + str(open_foot))
   return
 var left_fence_origin := Vector2(175, 605)
 if not bool(stage.call("_is_walkable_foot",left_fence_origin)):
  _fail("clear path just south of fence guard became blocked")
  return
 var blocked_move: Vector2 = stage.call("_move_foot_on_map",left_fence_origin,Vector2(0,-65))
 if blocked_move.y < 595.0:
  _fail("a run still crosses the banana fence, despite swept collision: " + str(blocked_move))
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
 # Door is a separate painted world overlay, never a 12th authored PSD
 # layer or a new house collider; mobile button works only when near.
 var front_door: Node2D = stage.get_node_or_null("HouseFrontDoor") as Node2D
 var touch: Control = stage.get_node("TouchOverlay/TouchControls") as Control
 if front_door == null or bool(front_door.get("is_open")):
  _fail("house entrance must start with the wooden leaves closed")
  return
 if not front_door.has_method("toggle") or front_door.get_child_count() != 4:
  _fail("house door texture hinges missing or not animated")
  return
 hero.position = Vector2(645.0, 460.0)
 stage.call("_update_door_action_ui")
 if not bool(touch.get("action_enabled")):
  _fail("Action button must appear near the house entrance")
  return
 touch.emit_signal("interact_requested")
 if not bool(front_door.get("is_open")):
  _fail("pressing mobile Action must open the actual house door")
  return
 front_door.call("_process",0.22)
 if float(front_door.get("open_progress")) <= 0.1:
  _fail("door state changes but planks do not swing open")
  return
 touch.emit_signal("interact_requested")
 if bool(front_door.get("is_open")):
  _fail("second Action must close the same door")
  return
 hero.position = Vector2(1000.0, 600.0)
 stage.call("_update_door_action_ui")
 if bool(touch.get("action_enabled")):
  _fail("mobile Action must hide out of interaction range")
  return
 touch.emit_signal("interact_requested")
 if bool(front_door.get("is_open")):
  _fail("door must not open when player is far from entrance")
  return
 hero.position = Vector2(float(marker[0]),float(marker[1]))
 # RPG HUD: actual scene-bound character, weather/time, six-slot hotbar,
 # functional journal/inventory/map/menu and mobile input modal isolation.
 var hud: Control = stage.get_node_or_null("RPGHUD/HUDCanvas") as Control
 if hud == null:
  _fail("RPG HUD V1 missing from live Camera2D scene")
  return
 if hud.get("hero") != hero or str(hud.get("weather_label")) != "HUJAN DERAS":
  _fail("RPG HUD not bound to real hero/current weather")
  return
 if str(hud.get("phase_label")) != "SIANG":
  _fail("RPG HUD not bound to actual lighting preset")
  return
 if int(hud.get("health")) >= 0 or int(hud.get("level")) >= 0:
  _fail("HUD may not invent an active HP/level system")
  return
 # Force the actual touch UI on (CI simulates desktop) to catch lost
 # joystick/LARI/AKSI when switching RPG tabs before closing the modal.
 touch.call("set_test_visible",true)
 hud.call("select_slot",1)
 if str(hud.get("open_panel")) != "":
  _fail("tool hotbar must not open RPG menu")
  return
 if int(hud.get("selected_slot")) != 1 or not touch.visible:
  _fail("tool hotbar fails to select without hiding joystick")
  return
 hud.call("toggle_panel","Jurnal")
 if str(hud.get("open_panel")) != "Jurnal":
  _fail("separate journal shortcut failed")
  return
 if touch.visible:
  _fail("touch controls must not collide with an opened RPG modal")
  return
 hud.call("toggle_panel","Inventori")
 if str(hud.get("open_panel")) != "Inventori":
  _fail("inventory panel does not open")
  return
 hud.call("toggle_panel","Peta")
 if str(hud.get("open_panel")) != "Peta":
  _fail("RPG atlas map does not open")
  return
 hud.call("close_panel")
 if bool(hud.call("is_modal_open")):
  _fail("RPG panels cannot be closed")
  return
 if not touch.visible:
  _fail("mobile joystick/LARI/AKSI not restored after switching HUD tabs")
  return
 touch.call("set_test_visible",false)
 hud.emit_signal("weather_delta",1)
 if str(hud.get("weather_label")) != "BADAI":
  _fail("RPG weather control does not change real game state")
  return
 hud.emit_signal("lighting_delta",1)
 if str(hud.get("phase_label")) != "SORE":
  _fail("RPG time control does not change real lighting")
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
