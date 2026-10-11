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

These are *base / idle forms* only, not hand-authored walk frames. The Godot gameplay controller now animates all eight real bases with 12-phase procedural leg/arm movement in its shader. This is a prototype, not a finished anatomical sprite sheet; see `docs/WALK_8_DIRECTION.md`. Legacy walk16 sources stay as a fallback.

The eight native base poses were installed in `main` from the original user-uploaded transparent PNGs. Each direction was identified by exact matching to the approved visual fingerprint; images were padded to the canonical canvas without stretching/resizing/upscaling the original artwork. See `manifest.json` for per-direction origin and SHA-256. No manual ZIP installation is now needed. The original uploaded files remain recoverable from Git history.

Godot 4.3+ project: `scenes/house_garden_stage1.tscn`, controller: `scripts/stage1_player.gd`. Ground-based registration uses scale 0.105 and Sprite2D position (0,-80.745), so Y=1585 becomes Y=0. Do not modify collision or walkable polygon while installing these assets.
