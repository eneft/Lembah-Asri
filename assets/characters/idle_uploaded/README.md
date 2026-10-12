# Latest Lembah Asri idle poses (October 2026)

These are the **five recently uploaded user-selected transparent 1024x1536 idle sprites**, not the historical 8-direction assets under `player_base_8dir`.

Copy the **five original PNGs** into this folder exactly:
- `front.png`: idle down
- `front_right.png`: idle down-right
- `right.png`: idle right
- `back_right.png`: idle up-right
- `back.png`: idle up

Other three directions use horizontal mirroring at runtime:
- left: mirror `right.png`
- down-left: mirror `front_right.png`
- up-left: mirror `back_right.png`

`scripts/run8_uploaded.gd` automatically detects all five new PNGs and switches the whole isolated RUN8 scene to them, preserving native transparency and colors, calibrating the visible character height and foot baseline. If even one image is absent, the scene explicitly reports `IDLE LEGACY — NEW PNGs NOT UPLOADED` instead of pretending the new assets are installed. `tests/run8_uploaded_smoke.gd` checks the selected source and mirror behavior.

**Keep unchanged:** main scene, original RUN textures, 12 frames at 12 FPS, speed, foot calibration. This folder only holds the new IDLE source.
