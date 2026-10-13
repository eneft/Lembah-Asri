# Lembah Asri — New_run_godot4 native RUN mapping

The user-approved source is **New_run_godot4.zip**. It contains one lossless RGBA atlas (`New_run.png`, 2382 × 3638, 8,393,505 bytes, SHA-256 `26fd9280798147a53ec0089df08dd1d39e4bed4c5f614d513f6eb5df1f940f0f`) and `New_run.tres` (46 original frame references).

## Installation (exact paths)

The repository already contains a functionally equivalent `New_run.tres` file with the exact 46 original AtlasTexture regions, 10 row animations, and native 10 FPS timing. To **activate it**, upload only the unchanged PNG from the original archive to:
- `assets/characters/new_run/New_run.png`

The `.tres` references that PNG by relative path, so **do not rename** it. The original archive also contains optional generator metadata; the game's 8-way playback does not need that metadata. The project automatically detects both at startup and prefers them to the legacy proportional RUN8 atlas. If either file is missing, the existing normalized RUN8 is kept and the main game remains playable. The program never changes existing WALK or IDLE resources.

## Native mapping (original order retained; 10 FPS)

| Godot run direction | Source rows | Total frames | Horizontal mirror |
|---|---|---:|---|
| down | row_2 (7) + row_3_2 (3) | 10 | no |
| down_right | row_3 (7) + row_4 (3) | 10 | no |
| right | row_5 (7) + row_6 (1) | 8 | no |
| up_right | row_4_3 (5) + row_5_3 (5) | 10 | no |
| up | row_4_2 (1) + row_5_2 (7) | 8 | no |
| down_left | down_right | 10 | yes |
| left | right | 8 | yes |
| up_left | up_right | 10 | yes |

Source frames are unmodified. World-visible character height remains **112 scene pixels**, calibrated per base direction using source alpha bounds. Per-direction original foot pivots:

| Source direction | Source pivot (x, y) | Native alpha silhouette height |
|---|---|---:|
| down | (208, 704) | 668 |
| down_right | (232, 688) | 656 |
| right | (232, 688) | 589 |
| up_right | (232, 640) | 596 |
| up | (232, 656) | 575 |

This is deliberately **not** the previous `run8_proportional/Run8_Normalized_*.png` atlas. The original RUN source is preserved, and that atlas remains as fallback.

## Verification

After uploading source files to the repository, GitHub Actions should log:

`LEMBAH ASRI MAIN: NEW_RUN_GODOT4 active: true; 46 native poses mapped to 8 directions; world_height=112px`

The main-scene integration smoke must also log `MAIN RUN8 SOURCE PASS: native New_run_godot4.zip`. Without the PNG, a passing workflow proves **only fallback**; it must not be reported as a new-source activation. No changes are made to the stage, camera, river, colliders, HUD, or mobile controls.
