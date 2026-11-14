# Lembah Asri — Three.js Foundation

## Decision
- Target: Windows desktop + browser from one shared TypeScript game runtime.
- Renderer: Three.js, WebGL2 baseline.
- Camera: third-person 3/4 follow camera.
- Physics: Rapier 3D, fixed 60 Hz simulation.
- UI: React; web build: Vite; Windows shell: Electron.
- Asset interchange: GLB/GLTF, meters as world units.
- Character scale: 1.68 m.

## Legacy preservation
The existing Godot project remains untouched on `main`. This branch is additive and starts from `main`. Godot scenes/scripts are migration references until each equivalent system is validated in the new runtime. Do not delete or rewrite legacy assets during foundation work.

## Foundation acceptance criteria
1. Browser app mounts a real Three.js renderer.
2. Windows Electron shell loads the same Vite build.
3. WASD movement and Shift sprint work.
4. Mouse drag rotates the third-person camera; wheel zooms.
5. Rapier capsule collider grounds the player on a fixed floor.
6. Modular village placeholder geometry renders with shadows.
7. Runtime can be disposed without leaving event listeners or animation loops.

## Current scope
This is the engine foundation, not a complete playable game. Placeholder meshes must be replaced by approved Lembah Asri GLB assets and hand-painted materials during subsequent migration stages.
