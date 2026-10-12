# Lembah Asri – Godot 4 RUN Test from uploaded ZIPs

Patch, not a replacement whole project. Copy `assets/`, `scenes/`, and `scripts/` into the root of `eneft/Lembah-Asri`; then open `res://scenes/run8_uploaded.tscn` in Godot 4.

Input: WASD / arrows or touch direction buttons. Real uploaded source: Front 12-frame, Front Left 12-frame, Left 49-frame (arranged in rows), Back 12-frame, Back Left screenshot-based 6x6 sequence (first artifact cell skipped). Three opposite views are mirrored. Nothing is downsampled; Godot scales assets for on-screen viewing.

Important: source ZIPs include assets with different character designs and frame layouts. Back-left PNG is a sprite montage with a visibly abnormal first frame. This patch is a technical audition, not validated polished final animation. The current GitHub main game scene is NOT changed. The current Pages deployment does not include these files until the PNG binary assets are uploaded into GitHub.
