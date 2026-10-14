# Lembah Asri — New_run_godot4 native RUN mapping

This document describes an **optional alternate RUN source**, not the currently approved main-game RUN. As of the RUN8 Proportional selection, the shipped game uses **LembahAsri_Run8_Proportional_Godot4(1).zip** (74 normalized poses). The alternate source is **New_run_godot4.zip**. It contains one lossless RGBA atlas (`New_run.png`, 2382 × 3638, 8,393,505 bytes, SHA-256 `26fd9280798147a53ec0089df08dd1d39e4bed4c5f614d513f6eb5df1f940f0f`) and `New_run.tres` (46 original frame references).

## Installation (exact paths)

The repository already contains a functionally equivalent `New_run.tres` file with the exact 46 original AtlasTexture regions, 10 row animations, and native 10 FPS timing. To **make the optional asset available**, upload only the unchanged PNG from the original archive to:
- `assets/characters/new_run/New_run.png`

The `.tres` references that PNG by relative path, so **do not rename** it. The original archive also contains optional generator metadata; the game's 8-way playback does not need that metadata. The main protagonist explicitly selects `RUN8 Proportional (approved)` by default (`run_source = 0` in `scripts/stage1_player.gd`). Uploading this alternate PNG does **not** automatically replace the approved RUN8 atlas. To intentionally test the alternate native source in the future, select `New_run_godot4 (optional)` (`run_source = 1`) and provide both files. If the alternate resource is missing, the normalized RUN8 continues to work. The program never changes existing WALK or IDLE resources.

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

These native 46-frame poses are **not** the approved `run8_proportional/Run8_Normalized_*.png` atlas. The original native source is preserved as an opt-in alternative; the proportional 74-frame atlas remains the default in the main game.

## Verification

GitHub Actions for the shipping main scene must log:

`LEMBAH ASRI MAIN: approved RUN source=RUN8_PROPORTIONAL`

The main-scene smoke test asserts `using_proportional_run = true` and `using_new_run = false`. Loading the optional native source requires a separate, deliberate choice and dedicated validation; simply uploading a PNG must never silently change the main game. No changes are made to the stage, camera, river, colliders, HUD, or mobile controls.
