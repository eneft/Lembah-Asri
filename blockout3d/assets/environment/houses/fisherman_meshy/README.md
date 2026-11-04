## Meshy fisherman cottage · Lembah Asri V7.8

Original user upload: `Meshy_AI_Lembah_Asri_Fisherman_1103160840_texture.glb` (102,364,648 bytes). The playable `fisherman_meshy_web.glb` here is a derivative of that exact model, not a procedurally drawn house. The game asset preserves its 3D mesh silhouette while reducing ~95,121 triangles to 1,800. The 8192×8192 original pigment texture was sampled and baked into vertex colors to avoid loading 98 MB in mobile WebGL. No raw 98 MB texture is bundled.

The asset replaces **only** `rumah_nelayan_01`; `rumah_nelayan_02` remains a distinct stylized house. Slot positions and rotations, terrain, bridges, character height 1.68m, and all camera/gameplay behavior stay unchanged. Single BoxShape3D continues handling physics. The source model is normalized to 5.20m width × 5.33m depth × 3.85m height within the original 8m × 6.5m plot.

Source conversion: VTK quadric mesh decimation with baked original albedo, exported as glTF 2.0 vertex colors; 922 vertices, 1,800 triangles; optimized file 37,872 bytes, SHA-256 `d68d2cbcc6bfbc3cf2ccf9ecff144f6d6c70bb1128a3afc22b6f16a603833036`.

Note: this is an aggressively optimized mobile LOD. For high-fidelity desktop shots, retain the original GLB separately; high-resolution texture detail is intentionally not preserved in the Web version.
