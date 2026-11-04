# Lembah Asri — Kantor/Balai Desa 2K asset integration

Status on 2026-11-05: **Godot integration is staged; binary transfer remains blocked. Do not deploy as a completed replacement.**

## Authorized optimized source

- File: `LembahAsri_Game_2K.glb`, generated in the user's latest Work session on 2026-11-05 (Jakarta local time).
- Size: **14,404,352 bytes** (14.4 MB decimal).
- Reported topology: **35,826 triangles**.
- Reported textures: albedo/normal 2048px, roughness/metallic 1024px.
- Storage at time of Work handoff: ChatGPT Library / Lembah Asri / `LembahAsri_Game_2K.glb`.
- The finished optimized file was **not** present in the GitHub repository when this branch was authored. Do not substitute a similarly named V1/V2 mesh repair or the damaged `rumah_kepala_desa_clean.glb`.

## Required upload (binary only)

Add the exact, independently reviewed original Work file at:

`blockout3d/assets/environment/houses/village_head/LembahAsri_Game_2K.glb`

Upload to this feature branch. Never overwrite `Meshy_AI_Rumah_Merah_Putih_1104091308_texture.glb` (archival source).

The settlement uses this GLB **only** at the existing `balai_desa` plot (from `settlement_v7.json`) when it imports with valid geometry and albedo textures. If absent, the approved V8.2 authored Balai Desa model remains active; all 17 plots, the player scale (1.68 m), box colliders, terrain and V8 scene streaming remain unchanged. New GLB adds no expensive per-triangle physics.

## Release gate

Before merge or production Pages deploy, confirm:
1. Asset binary exactly matches the intended Work-optimized GLB and is importable by Godot 4.3.
2. `terrain_v7_settlement_smoke.gd` and `terrain_v80_scene_loading_smoke.gd` pass with the binary present.
3. Visually inspect front, sides, back, roof and signboard, especially previous roof holes, side plants, wall textures and glass.
4. In-game check 1.68m character scale, world/isolated Balai Desa area load, collision, FPS and mobile memory.
5. No changes to the other sixteen buildings, terrain, collision, player or camera.

No online deployment claim is valid until the binary, CI and browser validation succeed.
