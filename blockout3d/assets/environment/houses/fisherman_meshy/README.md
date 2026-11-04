# Lembah Asri — original fisherman house (UV-preserving repair)

The screenshot with a crumpled triangular/tent-shaped house was caused by the
previous **1,800-face vertex-color simplification**, which discarded the
original UV-mapped 95,121-triangle Meshy source. Do not reuse that 37 KB asset
in the playable village.

Source provided by user: `Meshy_AI_Lembah_Asri_Fisherman_1103160840_texture.glb`.

The original model geometry and UVs are retained exactly. Only the 8192px
painted diffuse map was resampled to 2048px (JPEG, quality 92), the normal map
to 1024px, and the metallic map removed in favor of non-metal matte shading.

Reconstructed GLB: 8,355,972 bytes; original supplied GLB: 102,364,648
bytes. The transport-safe compressed version is stored in eight Git blobs
(`*.glb.gz.partXX`) with integrity hashes checked at preparation time.

Before opening `blockout3d` in Godot locally, run once from repository root:

```bash
python3 blockout3d/tools/restore_fisherman_uv_glb.py
```

GitHub Actions restores this automatically **before** Godot import,
test, and Web export. The generated `.glb` is gitignored to avoid
accidentally checking in a second copy.

Only `rumah_nelayan_01` uses this unique source. The second fisherman house,
warung, 17-building layout, road/bridge access, and hero height 1.68m stay
unchanged. The cottage is uniformly fitted to its original plot and retains
a cheap single box collider, not per-triangle physics.
