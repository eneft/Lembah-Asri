# Lembah Asri — Island Blockout v01

Environment aktif sekarang memakai `assets/environment/island/island_blockout.glb` (180 mesh terpisah). Dunia prosedural lama tidak dibuat lagi. GLB sumber Z-up diputar -90 derajat pada X untuk Godot Y-up.

Karakter tes, empat FBX Idle/Walk/Run/Jump, kontrol WASD/Shift/Space, tombol sentuh, dan kamera low angle/isometrik tetap sama. Spawn di lapangan desa `(6, 6.2, 15)`. Terrain, jalan, bangunan, sawah, gardu dan dermaga mempunyai collision mesh. Jika jatuh di bawah pulau, karakter kembali ke lapangan.

Buka `blockout3d/project.godot`, tunggu impor aset, lalu F6/F5. Tes: `tests/smoke.gd` memeriksa terrain, spawn dan gerak; `tests/fbx_character_smoke.gd` memeriksa empat animasi asli.

Ini terrain blockout untuk uji skala dan eksplorasi; belum material dan environment final.

---

# Lembah Asri — NEW Godot 3D Blockout (standalone)

**This is NOT the existing illustrated 2D Godot game.** This subproject has its own \`project.godot\` and its own main 3D scene. The legacy root game and its GitHub Pages homepage are deliberately preserved.

## Open the correct project
In Godot 4.3, select **Import**, then open:
\`Lembah-Asri/blockout3d/project.godot\` (NOT the root \`Lembah-Asri/project.godot\`).
Press **F5** — this new project's default scene is \`res://scenes/world.tscn\`.

## Gameplay test
**Desktop:** WASD / arrow keys to move, Shift to run, Space to jump, scroll to zoom. Press **C** to toggle between camera modes. **Q/E** orbit the camera in 30-degree steps, **R** resets orbit, or hold the **right mouse button** and drag. On touch screens, drag on the game background horizontally or use the top-right **Putar / Reset** buttons.

**Phone/tablet:** a responsive left **four-way D-pad** and right **LARI / LOMPAT** touch buttons appear automatically on touch screens. These use Godot `TouchScreenButton` and support **multiple simultaneous fingers** (for example, move + sprint + jump). Swiping the upper play area still rotates the camera; swiping the bottom control zone does not. The keyboard controls stay unchanged on desktop.

**Default: Low Angle** — lower, closer and more front-facing to see the protagonist's face (orthographic size 16, offset `Vector3(8,10,18)`). **Isometric** — original elevated view (size 22, offset `Vector3(26,31,26)`). Scroll zoom remains available with the existing bounds 9–65; changing camera modes resets zoom to that mode's preset. Transitions between camera positions are smoothed.
The character uses the four original FBX animation clips when available. The environment now has a **first textured stylized art pass** (houses and tropical foliage), while the remaining terrain, rice fields, dock and other scene components are still blockout geometry.

## World layout
- Isolated childhood Javanese house, neglected for years, with large vegetable garden.
- Village with modest single-gable terracotta roofs, NOT roof tiers or Japanese/European structures.
- Open ground where villagers gather (not a football pitch).
- Tropical woods, hills, river with two crossing bridges, rice paddies.
- Sandy beach, sea, fishing pier and fishing boats.

## Web
Target after merge and successful main deploy:
**https://eneft.github.io/Lembah-Asri/blockout3d/**

## Original Meshy childhood house GLB

The user's textured house asset replaces only the **childhood house** at `01_RumahTerpisahDanKebun` when `res://assets/environment/houses/main_house/rumah_utama.glb` is present. It is scaled by mesh bounds with preserved materials/UVs, aligned to the ground and provided with a solid collision volume. Other village homes are unchanged.

When the source binary has not yet been uploaded into GitHub, the old procedural home is shown as an explicit temporary fallback; build success does not imply that the user's GLB was deployed. See `assets/environment/houses/main_house/README.md` for the exact file/path and audit details. The HUD reports whether the original asset is active.

## Stylized Javanese environment art — first pass
`scripts/village_art.gd` is a **reusable Godot 4.3 art kit**. It generates lightweight authored UV meshes with cached, deterministic painterly albedo and subtle normal-map textures (192px, no network dependency): clay-tile pitched roofs with visible rows, gable plaster and weathering, textured teak-style frames/doors, porch structures, tropical trees with branches, curved coconut fronds, and broad banana leaves. Childhood home has a different weathered finish and shrubs. Ground paths receive painted earth. Building collision remains in place.

The art kit is still **not final hand-painted commissioned assets** or a fully modeled 3D world. Additional sculpted unique meshes, atlased textures and environmental optimization are future iterations. The existing player rig, animations, controls, camera and legacy 2D game remain untouched.
