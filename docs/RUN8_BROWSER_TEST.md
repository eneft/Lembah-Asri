# Uji 8 Arah di Browser (isolated)

Main game: https://eneft.github.io/Lembah-Asri/

Eight-direction test: https://eneft.github.io/Lembah-Asri/run8/

The root `project.godot` and the house garden main scene are not changed. The Pages deployment temporarily exports `scenes/run8_test.tscn` as a second Web build in `/run8/` and restores the original project configuration before exiting.

**Asset provenance:** This browser test currently uses the existing 16-frame directional walk atlases in `assets/characters/player_hd/walk16/`, displayed at running speed. It does **not** yet use the eight new run spritesheets from the user's locally uploaded ZIP; those binaries have not been uploaded to this repository. Five views are native, and three are mirrored. Do not claim these are the user's new run frames.

Controls: WASD/arrow keys; Shift to move faster; 8 direction touch pad for mobile. `LARI` checkbox controls travel speed, and the frame clock stays at 16 FPS to preserve the source poses. Direction names are screen-based (down = toward bottom).

Smoke test: `godot --headless --path . --script res://tests/run8_directions_smoke.gd` after running `godot --headless --path . --editor --quit`.

No gameplay, storage, or house scene logic was changed.
