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


## Retextured terrain-only browser preview — one baked atlas, lightweight Web

Playable preview: https://eneft.github.io/Lembah-Asri/terrain-test/

The authoritative user-uploaded terrain source remains
`assets/environment/island/terrain base.glb` (~53 MB) with its original
mesh, UV seams, baked diffuse and historical 4K material maps. It is never
overwritten. `tools/retexture_terrain.py` performs UV-preserving,
photogrammetry-noise cleanup, painterly tropical color grading and baked
subtle grass/earth brush grain directly into one 4096x4096 JPEG atlas.

`tools/optimize_terrain_base.py` embeds that atlas into the derived
`terrain_base_web.glb`, strips the *unused* legacy normal/metallic maps
from its Web material, and leaves the original source asset unchanged.
Godot uses a normal `StandardMaterial3D` with the single atlas,
anisotropic filtering and matte roughness: **no extra shader, no tiled
runtime materials, no giant second normal texture**. The extra shader
and texture generation approach was discontinued due to runtime cost.

The terrain-only preview retains the existing perspective 3/4 camera,
FBX character at 74% scale, animation clips and working terrain
collision. Game route `/blockout3d/` and legacy 2D are untouched.

For local Godot import (Godot 4.3), first generate the Web terrain:

```bash
python3 -m pip install Pillow
python3 blockout3d/tools/optimize_terrain_base.py
```

Then open `blockout3d/project.godot` and run
`scenes/terrain_base_test.tscn`. GitHub Actions performs the same bake
automatically before Godot import and Web export.

A baked retexture improves coherence and draw cost, but cannot completely
repair insufficient original mesh geometry or UV texel density. Further
precision painting can be done on the same UV atlas without changing the
gameplay collision.


## Terrain V2 — broad villages and ocean (separate browser test)

The user's updated island concept calls for **mostly walkable flat land**, not hills
on every square meter. The island is now remodeled at build time from the
original `terrain base.glb` source (which remains unchanged in Git). The derived
`terrain_base_web.glb` gets new Y positions and recalculated normals, while
retaining the island's XZ coastline outline, triangle indices, UVs and approved
single 4K baked hand-painted atlas.

- 70%+ of modeled land (grade below 0.20) is playable broad plains / plateaus.
- Northern mountain landmark peaks around 24m; two small hills remain at the
  northeast/northwest. Most central and southern land is flat.
- Western rice-area plateau and central village plateau use broad flat tops.
- South/east shoreline forms gentle beach transitions; north/west coast
  descends through shorter rocky cliffs.
- A 360x360-meter `TerrainV2Water/OceanSurface` spans beyond the island,
  at sea elevation 0.45m. Its inexpensive shader blends shallow tropical
  turquoise into deeper blue (no heavyweight waves or reflections).
- `TerrainV2Water/RiverSurface` follows a narrow riverbed carved north to
  south. Water is visual-only and adds no extra collision.
- Original 3/4 camera, smaller FBX avatar, animations, correct collision
  layers and gravity verification are preserved.

Build and test locally:

```bash
python3 -m pip install Pillow
python3 blockout3d/tools/optimize_terrain_base.py
godot --headless --path blockout3d --editor --quit
godot --headless --path blockout3d --script res://tests/terrain_base_smoke.gd
```

Play the V2 experiment at https://eneft.github.io/Lembah-Asri/terrain-test/
after a successful deployment. The standard `/blockout3d/` game and 2D
homepage do not load or depend on the new terrain or water.
