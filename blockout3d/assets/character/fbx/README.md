# 4 original Mixamo FBX files for the new Godot 3D blockout

The user provided four FBX files, audited on 2026-10-31. Their **geometry is byte-identical**, they share 66 skeleton nodes and 315 animation curves each. These clips target one rig and can be combined.

| Filename (exact) | State | Duration | Loop |
| --- | --- | ---: | --- |
| `Orc Idle.fbx` | idle | 7.367s | yes |
| `Walking.fbx` | walk | 1.033s | yes |
| `Running (3).fbx` | run | 0.700s | yes |
| `Jump Over.fbx` | jump | 1.933s | no, sped up to match physical jump |

**Important: the FBX binaries uploaded to ChatGPT are NOT automatically committed to GitHub.** Until the binaries exist in the Git repository, the independent 3D game correctly shows a placeholder (it must not pretend the character is live).

Place exactly these original files in **`blockout3d/assets/character/fbx/`** (case-sensitive and including spaces), committing four actual binary files, not links or renamed text files. They can be uploaded through GitHub's Add file -> Upload files flow; each original FBX is smaller than 25 MB.

Once the files are committed:
- GitHub Actions imports them with Godot 4.3's built-in **ufbx** importer.
- `scripts/fbx_character.gd` instantiates **one idle model** with a fixed calibrated mesh scale and copies four imported animation clips onto one `AnimationPlayer`.
- `scripts/player.gd` switches `idle/walk/run/jump` on WASD / Shift / Space; `Jump Over` is one-shot.
- `tests/fbx_character_smoke.gd` requires **all four** clips to load when binary files are present.
- The 3D game is published to `https://eneft.github.io/Lembah-Asri/blockout3d/` once the main Pages workflow succeeds.

This is technical animation integration, not animation retouching. The long `Orc Idle` clip and root-motion on `Jump Over` need visual review. The original FBXs together are ~98 MB, so we should later convert to a shared low-size `.glb` model and animation-only clips to improve web download size without changing UVs or rigging.
