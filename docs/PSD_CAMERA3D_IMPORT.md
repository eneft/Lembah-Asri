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
