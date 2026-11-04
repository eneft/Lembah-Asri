# Rumah kepala desa — original Meshy asset (protected)

## Status: original only, cleaning V1/V2 withdrawn (visual regression)

- **Valid source:** `Meshy_AI_Rumah_Merah_Putih_1104091308_texture.glb`
- Original size: **18,709,472 bytes**; SHA-256: `858e5b0161c23a9481a28e6a41c9377ca037e7ff7283d585cc996fbfa6c77707`.
- Contains the source roof tiles, walls, entrance, Indonesian red-white flag, UVs and all original PBR textures.
- Do **not** use or regenerate `rumah_kepala_desa_clean.glb` from the former 2026-11-04 face-culling script. Both were withdrawn after user reported broken roof/walls. Historical failed versions are available in Git history, **not** as production-ready assets.

### What went wrong

The Meshy GLB is exported as **one combined mesh** with foliage merged near/into roof tiles and walls. Previous green-pixel/connected-component classifiers deleted **22k–25k triangles**, including parts of the roof tile surface, leaving holes and discolored faces. Retexturing fragments made it worse.

### Safe next procedure

1. Import **only the original GLB** into Blender or a validated mesh-editing pipeline.
2. Build a separate foliage mask using **connected face islands, mesh normals, geometric depth against actual roof tiles and manual visual checks**. Do not select by green pixel alone.
3. Hide (non-destructively) candidate plant islands; visually inspect every side and top. Avoid hiding roof tiles, ridge tiles, eaves, flags, door, windows, wooden wall/pillars, and potted garden shrubs.
4. Repair any genuinely missing roof tile regions **with modeled tile patches** matching the terracotta roof surface and same atlas; never cover holes with untextured slabs.
5. Preserve original material/UV/normal data and provide front, left, right, back and top renders for user approval before calling the asset clean.
6. Save a separate version with a **new unambiguous filename** (e.g. `rumah_kepala_desa_roof_repaired_v3.glb`), validate GLB and regression tests, and only then consider integrating into the game. Do not overwrite the original.

**Production safety:** The source asset was never integrated into the terrain/gameplay scene and deleting the broken cleaned variant must not modify the active 17 building placements, camera, player or collision.
