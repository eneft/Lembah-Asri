# Lembah Asri — 3D Village Preview (non-breaking)

This is a first **explorable blockout**, not the approved final art. It was added in a separate branch to preserve the illustrated 2D gameplay, character animations, existing Godot smoke tests, and the published GitHub Pages scene.

## Launch
1. Open the repository in **Godot 4.3** (the version installed in GitHub Actions).
2. Open **res://scenes/village3d_preview.tscn**.
3. Run this scene with **F6** (do not press F5 if you want the 3D test, since F5 still starts the existing Camera2D game).

## Controls
- **WASD** / arrows: move the placeholder player.
- **Mouse wheel**: zoom the orthographic camera.
- **E**: talk to an NPC when nearby.

## Regions
- **RumahMasaKecil:** abandoned Javanese house on its own large plot, away from the settlement.
- **KebunKeluarga:** vegetable plots with space for future farming gameplay.
- **PermukimanDesa:** modest houses with one simple gabled clay-tile roof each, not stacked ornamental roofs.
- **LapanganWarga:** open village gathering space with benches and a shade tree, *no soccer lines or goals*.
- **HutanBambu / Bukit:** tropical forest and green hill silhouettes.
- **Sungai:** river with two bridge crossings and invisible collision barriers between them.
- **Pantai / PelabuhanNelayan:** beach, water, simple jetty, and three fishing-boat placeholders.

## Technical boundaries
- All visuals are intentionally simple generated meshes. Replace meshes with properly authored 3D assets (UVs, texture atlases, hand-painted albedo, and game-friendly material settings), rather than treating the primitives as final quality.
- This preview reuses the existing \`scripts/main.gd\` and \`scenes/player.tscn\` foundations. It does not replace the character model or touch the existing FBX/browser animation tester.
- \`project.godot\`, the main scene, deployment workflow, 2D resources, and approved character source files remain unchanged.
- The current preview is not wired as the default Web build: GitHub Pages remains on the original main game until a later explicit switch.
- This addition needs a Godot engine test / visual review; the companion GitHub Actions workflow performs a headless import and scene smoke check.

## Next build phase
Replace the house with the approved abandoned-home model; separate the forest, trees, roof vegetation and boats into efficient reusable assets; add walkable hills and smarter water boundaries; then integrate the approved protagonist rig with animation states and gamepad/touch input.
