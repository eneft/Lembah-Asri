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
The legacy default main scene and 2D rain/weather were not changed.
