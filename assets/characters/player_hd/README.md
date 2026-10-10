# Lembah Asri — 16-frame walk per direction, 8 directions

This folder contains five source pose directions, each as a 4x4 frame atlas (2048x2560 pixels): `up`, `up_right`, `right`, `down_right`, `down`. Each frame has an identical 512x640 transparent canvas and foot baseline. Three left directions mirror the corresponding right view in `AnimatedSprite2D`.

## Visual damage repair, October 2026
Previous atlas generation mistakenly removed **brown pixels** (hair, trousers, boots) with a broad red-color removal predicate. The new atlases use connected-component foreground segmentation, a narrow bright-red-only threshold, a small halo exclusion, and a crop extending 24 source pixels below each original sheet cell so boot toes are retained. No anatomy has been re-generated. The canonical full RGBA (lossless) output is kept as the downloadable repaired asset pack.

Godot Web uses optimized RGBA-to-256-color **indexed PNG** versions of the repaired sprites to keep repository file sizes manageable. This quantizes color (it is **not mathematically lossless color**), but it maintains the 2048x2560 atlas dimensions, alpha transparency, 512x640 frame bounds and the figure silhouette. Do not run aggressive RGB deletion or resize any individual axis.

Idle uses pose 16 from the same atlas for each direction to avoid a jarring art-style switch on stopping; the original master idle files remain present and unmodified in this repository. Walk is 12 FPS, and run plays the walk poses at 16 FPS (run is not yet an independently drawn animation). Sides left are mirrored.

The smoke test checks all eight directions, frame count, source image dimensions, playable scale, interactions, and now critical **hair/body opacity** on the opening frames. These are regression checks, not a substitute for watching all 16 poses in gameplay. The user-approved turnaround remains the artistic source of truth.
