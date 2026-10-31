# 4 original Mixamo FBX files for the new Godot 3D blockout

The user provided four FBX files, audited on 2026-10-31. Their **geometry is byte-identical**, they share 66 skeleton nodes and 315 animation curves each. These clips target one rig and can be combined.

| Filename (exact) | State | Duration | Loop |
| --- | --- | ---: | --- |
| `Orc Idle.fbx` | idle | 7.367s | yes |
| `Walking.fbx` | walk | 1.033s | yes |
| `Running (3).fbx` | run | 0.700s | yes |
| `Jump Over.fbx` | jump | 1.933s | no, sped up to match physical jump |

**Upload verified on GitHub (2026-10-31):** all four original FBX binary files are now present in this directory on `main`. They still require a Godot 4.3 import, animation-state smoke test and successful Pages deployment before the website can be considered validated.

File names and capitalization must remain exact. Do not add duplicate model instances or rename source files. The independent 3D level must load the single rig from `Orc Idle.fbx` and import the other clips onto it.

Once the files are committed:
- GitHub Actions imports them with Godot 4.3's built-in **ufbx** importer.
- `scripts/fbx_character.gd` instantiates **one idle model** with a fixed calibrated mesh scale and copies four imported animation clips onto one `AnimationPlayer`.
- `scripts/player.gd` switches `idle/walk/run/jump` on WASD / Shift / Space; `Jump Over` is one-shot.
- `tests/fbx_character_smoke.gd` requires **all four** clips to load when binary files are present.
- The 3D game is published to `https://eneft.github.io/Lembah-Asri/blockout3d/` once the main Pages workflow succeeds.

This is technical animation integration, not animation retouching. The long `Orc Idle` clip and root-motion on `Jump Over` need visual review. The original FBXs together are ~98 MB, so we should later convert to a shared low-size `.glb` model and animation-only clips to improve web download size without changing UVs or rigging.
