# Original user's childhood house — Meshy GLB

This folder is reserved for the original textured 3D house the user supplied to ChatGPT.

**Required filename (case-sensitive):** `rumah_utama.glb`

Original attachment: `Meshy_AI_Rumah_Tropis_Beratap__1031114937_texture.glb` (4,981,448 bytes; 1 mesh, 26,747 vertices, 1 material and 1 embedded PNG texture).

Source SHA-256: `248d412f4de2842dd864cc79135d4ba3168fa377ae206ac2a894855950431c3b`.

## Upload / activation

Upload **the binary file**, renamed `rumah_utama.glb`, into this GitHub folder on `main`. Do not upload a ZIP, markdown link or placeholder text.

The independent Godot 3D project (`blockout3d`) checks for this path on load and will automatically replace the old **childhood house** in `01_RumahTerpisahDanKebun`. It preserves the other Javanese village houses, creates solid collision, scales the small Meshy export to a 7.8m footprint, raises the bottom to ground level, and preserves original mesh/UV/material/texture. No procedural rooftop is rendered over the imported model. The scene smoke fails if the GLB exists but cannot load.

**Until the binary is actually uploaded to GitHub**, the original painted placeholder is kept for safety, and the scene's HUD explicitly identifies it as a placeholder. Successful Godot CI on a branch without the binary does NOT mean the original Meshy house is live.

The user's GLB is an authored/AI-generated 3D model, not a screenshot or concept image. Its front orientation is not automatically verifiable from glTF bounds alone; adjust `HOUSE_YAW_DEGREES` in `scripts/house_glb_asset.gd` after an in-game visual check, if needed.
