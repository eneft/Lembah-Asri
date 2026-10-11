# New Lembah Asri protagonist: 8-direction still bases

The updated Stage 1 controller auto-activates this folder **only when all eight real PNG files exist**. It retains the current legacy player/animation without interruption otherwise.

Required exact filenames:

- `down.png`
- `down_right.png`
- `right.png`
- `up_right.png`
- `up.png`
- `up_left.png`
- `left.png`
- `down_left.png`

Each file must be a **1152 × 1632 RGBA transparent PNG**, generated from the approved olive-jacket explorer reference and aligned with the bottom-most opaque boot pixel at canvas Y=1585. Full color, no upsampling or lossy compression. Unique art per direction: no horizontal flips.

These are *base / idle forms* only, **not** a finished walk cycle. WASD movement still works; the still base is shown during walking/running, until real frame-by-frame animations have been approved. Old 16-frame animation stays in the repo solely as an automatic fallback when any new base asset is absent.

The asset ZIP supplied in the ChatGPT conversation `Lembah_Asri_Base_Karakter_8_Arah_Godot.zip` contains all eight files. Extract the ZIP contents at the repository root and commit/push the eight PNGs to enable the new art on GitHub Pages.

Godot 4.3+ project: `scenes/house_garden_stage1.tscn`, controller: `scripts/stage1_player.gd`. Ground-based registration uses scale 0.15 and Sprite2D position (0,-115.35), so Y=1585 becomes Y=0. Do not modify collision or walkable polygon while installing these assets.
