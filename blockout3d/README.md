# Lembah Asri — NEW Godot 3D Blockout (standalone)

**This is NOT the existing illustrated 2D Godot game.** This subproject has its own \`project.godot\` and its own main 3D scene. The legacy root game and its GitHub Pages homepage are deliberately preserved.

## Open the correct project
In Godot 4.3, select **Import**, then open:
\`Lembah-Asri/blockout3d/project.godot\` (NOT the root \`Lembah-Asri/project.godot\`).
Press **F5** — this new project's default scene is \`res://scenes/world.tscn\`.

## Gameplay test
WASD / arrow keys to move, Shift to run, Space to jump, scroll to zoom. Press **C** to toggle between camera modes. **Q/E** orbit the camera in 30-degree steps, **R** resets orbit, or hold the **right mouse button** and drag. On touch screens, drag on the game background horizontally or use the top-right **Putar / Reset** buttons.

**Default: Low Angle** — lower, closer and more front-facing to see the protagonist's face (orthographic size 16, offset `Vector3(8,10,18)`). **Isometric** — original elevated view (size 22, offset `Vector3(26,31,26)`). Scroll zoom remains available with the existing bounds 9–65; changing camera modes resets zoom to that mode's preset. Transitions between camera positions are smoothed.
The protagonist is a **temporary 3D blockout**; no final rig or hand-painted textures have been substituted.

## World layout
- Isolated childhood Javanese house, neglected for years, with large vegetable garden.
- Village with modest single-gable terracotta roofs, NOT roof tiers or Japanese/European structures.
- Open ground where villagers gather (not a football pitch).
- Tropical woods, hills, river with two crossing bridges, rice paddies.
- Sandy beach, sea, fishing pier and fishing boats.

## Web
Target after merge and successful main deploy:
**https://eneft.github.io/Lembah-Asri/blockout3d/**

This scene is intentionally **geometry blockout**, not polished art, and should be iteratively replaced with independent Meshy assets (UVs, hand-painted albedo textures, material atlas, appropriate collision).
