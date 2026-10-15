# Lembah Asri — original four Photoshop layers, Camera3D
The original supplied `background.psd` has **four** real layers, canvas 1672 × 941.
Each exported layer has its exact Photoshop dimensions, transparency, and placement:
- `01_background.png`: 1672x941, bbox (0,0,1672,941)
- `02_house.png`: 831x624, bbox (157,-107,988,517)
- `03_banana.png`: 295x360, bbox (63,217,358,577)
- `04_foreground_tree.png`: 916x893, bbox (-468,341,448,1234)

The three smaller PNG files are committed directly. To avoid GitHub's large-request transport rejection, the full background is also committed as `01_background_lossless.webp` (RGBA verified pixel-for-pixel equal to PNG), and an automated GitHub Actions workflow materializes `01_background.png` on push. The Camera3D script can load the WebP while waiting for the PNG; **the scene is functional with either format**. The layers are **not** cropped screenshots or fabricated reconstructions.

Open `scenes/rumah_ladang_psd_camera3d.tscn` in Godot 4.3 and press F6. Order back to front: background -> player -> house -> banana -> foreground tree. Desktop controls WASD/arrow, Shift; touch controls mobile.

The uploaded original PSD is preserved separately in `LembahAsri_PSD_Camera3D_Original_Layers.zip` in this conversation, including the four PNGs. The large binary PSD itself is **not stored in this Git repository** as part of this asset commit.
The former main scene and original 2D rain/weather scripts are preserved; the PSD scene is now the game's default entry.


## Godot main scene and collision integration (15 October 2026)
- Run F5 to open the four-layer PSD scene. Each Sprite3D has an assigned PNG texture so it can be moved in the Godot editor.
- Camera3D is orthographic. Camera bounds keep the source canvas in view, while RUN8+IDLE8 remains visually between background and house layers.
- Physical character movement uses a CharacterBody3D with a SphereShape3D centered on the foot contact point. StaticBody3D colliders under ArtRig/CollisionGeometry block the house walls, extension, banana trunk, foreground trunk, and lower river bank. The upper bridge corridor is not blocked.
- These collision dimensions are conservative editable proxies, not pixel-perfect shoreline tracing. Adjust them in the Godot editor after reviewing the exact art.
- Existing GPU-batched six-layer rainfall, puddles and footstep splashes are reused in an orthographically aligned CanvasLayer. Press R to toggle the rain; mobile controls remain enabled on touch devices.
- The legacy Stage 1, rain scripts and separate RUN8 scenes remain unchanged for regression tests.
- CI verifies the playable default scene, Photoshop layer dimensions, z-order, 3D physics blockers, open bridge route, RUN8/IDLE8 and the weather overlay. Deployment checks that the exported main Web pack starts this PSD scene, not the legacy one.


## Character perspective on painted 3/4 art (15 October 2026)
The **world feet** of the avatar remain at their true Camera3D/CharacterBody3D location.
Only `CharacterOverlay/ProjectedPlayer.scale` changes, with uniform x/y scale to
preserve all RUN8/IDLE8 anatomy and the unmodified source atlas/pivot. The curve
uses the source PSD foot **Y**, not viewport Y, preventing camera-follow pulsing:
far at Y=360: 0.88×; yard middle at Y=570: 1.00×; near at Y=810: 1.18×.
Two smoothstep segments make transitions continuous. A maximum +0.07 additional
scale is blended only approaching the lower-right bridge (X=1070→1320,
Y=480→625). Calibration parameters are exposed under `Character Painted Perspective`
in the main scene's Inspector; collision size, sprite offsets, layer order,
physical speed, and camera zoom are unchanged.
A new Godot CI + Web-export smoke test checks far/middle/near, same-height yard
vs bridge, smooth transitions, RUN8/IDLE8 direction inheritance, and stable foot
pivot/physics collider.


## Collision rebuild — mapped foot terrain, not rectangular bounding boxes
The old oversized rectangle collisions (particularly RiverBankCollision blocking
real bridge planks) were deliberately removed. Collision is now enforced by
`scripts/psd_collision_layout.gd`: **three walkable polygons** in original PSD
coordinates, covering (1) fenced home courtyard, (2) the narrow diagonal
bridge crossing, and (3) the opposite bank exit. All other locations (the
house/building footprint, fences, tree trunks and river) are off-limits.
The active CharacterBody3D retains its foot SphereShape3D for later features,
but the **authoritative static environment collision** is determined by the
painted 2D walkable regions: a 9-pixel foot-radius neighborhood and swept
6-pixel movement steps with axis sliding, preserving RUN8/IDLE8 animation,
Camera3D, dynamic perspective scaling, original PSD layer order and weather.

**C** toggles a calibrated collision overlay (green yard, blue bridge/bank,
red player foot circle). The overlay is hidden for normal gameplay and
follows Camera3D projection. Adjust polygon vertices in
`scripts/psd_collision_layout.gd` when improving terrain visuals; avoid a
new large river rectangle. Geometry is estimated from the painted stage
and should be checked at the fence/gate/bridge junction during live gameplay.
Dedicated smoke tests verify that the real bridge deck is walkable, running
cannot hop across water/fence, grass does not cause invisible collisions, and
old river-blocking StaticBody3D shapes do not return.


## Manual light atmosphere (15 October 2026)
The main PSD scene now uses a **hybrid painted-2.5D lighting pass**, not real
DirectionalLight3D (which would not affect the source 2D CanvasLayers and
unshaded Sprite3D). `LightingOverlay/Atmosphere` composites a light-weight
multiplicative grade across Camera3D, house/trees, RUN8/IDLE8 and rain; a
second optional, low-strength radial shader follows the porch in world-source
PSD pixel coordinates, shown only at 17:00 and 21:00. The original noon grade
has **zero modification** to the supplied art. No texture or collision, camera,
player scaling, animated sprites, weather effects or current deployment workflow
is replaced.

Choose a preset with the top-right arrow buttons (also touch-friendly) or
press **L** for next / **Shift+L** for previous. Slots: 06:00 PAGI,
12:00 SIANG (original), 17:00 SORE, 21:00 MALAM. Smooth fades are
visual only. The manual preset is exported as `start_lighting_preset` (default
1/siang) and `lighting_transition_speed` on the Godot main scene.
No automatic in-game time progression has been activated yet. The ambient tint
is not physically accurate cast shadows; those would require custom masks or
separated 2D geometry with directional normals in a future step.

## Avatar moving silhouette projection
`CharacterOverlay/ProjectedShadow` uses a shader sampled from the exact
RUN8/IDLE8 alpha frame active on the visible hero, then flattens the image
into a slightly soft ground-plane cast silhouette. Its foot anchor stays at
the physical 3D CharacterBody3D foot. Pagi, siang, sore and malam change its
length, horizontal lean and intensity with the existing manual lighting.
No change is made to player controls, camera, movement physics, collision,
source PSD layers, body proportions or rain. This is a painted 2.5D visual
shadow rather than a physical 3D cast shadow.

## Native Camera2D migration preview (not yet production)
The proposed scene `scenes/rumah_ladang_psd_camera2d.tscn` now uses only
`Node2D`, `Camera2D`, `CharacterBody2D` / `AnimatedSprite2D`,
four original PSD `Sprite2D` images with their exact 1672x941 Photoshop
pixel coordinates, and native `StaticBody2D` + `CollisionPolygon2D`
terrain boundaries. The collision shapes are built from the merged, original
yard / bridge / exit polygons so the junction cannot act as an invisible wall.
The original foot-circle sweeper is retained as a second high-speed safety
check. This is a playable **parallel preview**, not a replacement for the
Camera3D production scene: `project.godot` still uses Camera3D until review.

Native RUN8 + IDLE8 uses the existing proportional art bank with unchanged
foot pivot (112px height, original 8 directions), smooth Y-depth and special
bridge scaling. A native-2D animated silhouette shadow follows the sprite's
frame and morning/day/evening/night direction. Original weather, river ripple,
puddles, touch joystick, and shader atmosphere are loaded directly without
rebuilding textures. Desktop: WASD/arrows, Shift run, R rain, L lighting,
C walkable polygon debug; the lighting UI and touch controls remain.

After a successful build, the **preview** is available at
`https://eneft.github.io/Lembah-Asri/camera2d/` while the published root
remains the Camera3D comparison. Run
`tests/psd_native2d_smoke.gd` for scene/physics migration validation,
and `tests/psd_native2d_render_smoke.gd` to check GPU hero, moving
silhouette, and day/night grade. Only switch `run/main_scene` when both
tests, Web export, and hands-on walk/bridge comparison are accepted.

## Native Camera2D simplification — single older background (15 October 2026)
The `/camera2d/` preview now deliberately contains just **one** scenery
`Sprite2D`, loading the previously approved complete character-free
`assets/art/scenes/rumah_ladang_empty.png` (1672×941). All split house,
banana and foreground tree nodes have been removed **from the preview scene**,
not deleted from the repository or legacy 3D scenes, so they can be assembled
by hand later. A pure Camera2D/CharacterBody2D setup remains.

The former long projected silhouette caused the running character to *appear*
to hover above the ground even though its physical foot was anchored.
A short subtle body cast remains, but a new three-ring soft
`FootContactShadow` now sits at the actual CharacterBody2D foot on every
RUN8 frame. The native animation controller also applies a capped,
cached per-frame bottom-of-shoe correction (maximum 8 world pixels)
for source RUN8 bobbing; the character position and collision never move.
Manual lighting, rain and mobile input remain available.

Legacy `/rumah-ladang-test/`, `/camera2d/`, the original main Camera3D
scene and source PSD layers remain independent. Validate with
`tests/psd_native2d_smoke.gd` and `tests/psd_native2d_render_smoke.gd`.
