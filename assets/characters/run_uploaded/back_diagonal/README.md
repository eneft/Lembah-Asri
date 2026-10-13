# Rear-diagonal RUN — Lembah Asri

## Revised 12-frame source (priority)

User's original **49-frame** transparent art has now been audited and a **12-frame native rear-diagonal RUN** has been prepared from original source-grid indices:

`[24, 27, 30, 31, 34, 35, 38, 39, 41, 44, 45, 47]`

Required files in this directory:
- `back_diagonal_run12.png` — full-resolution transparent atlas **3072 × 3504**, 4 columns × 3 rows, 768 × 1168 per sprite.
- `back_diagonal_run12.tres` — original-pixel Godot 4 SpriteFrames resource `run_back_right`, 12 frames at 12 FPS.

`scripts/run8_uploaded.gd` automatically prioritizes the revised `.tres`. `up_left`/Back Left mirrors `up_right`/Back Right. The script aligns proportions and foot pivots against other RUN and IDLE directions. **Do not replace the original PNGs or main scene.**

The corrected PNG/TRES are prepared in the companion `Lembah_Asri_Back_Diagonal12_Godot4.zip` game asset package shared in the conversation. **A GitHub commit that changes only script files cannot move those binary files from the conversation; they must also be present in this directory before the revised animation will render online.**

## Legacy fallback

Until those two files exist, the isolated scene uses `back_left_right.tres` and its two atlas pages `back_left_right-0.png`, `back_left_right-1.png`. Those three files constitute the previous edited 21-pose turning sequence in order `row_1 → row_2 → row_3`. They have been preserved unmodified for traceability.

The build test distinguishes new and legacy modes, and must never describe a resource-load PASS as proof that the old 21-frame visual loop is seamlessly animated.
