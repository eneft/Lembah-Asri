# Rear-diagonal RUN — edited Godot 4 source

Authoritative user-approved asset: **back_left_right_godot4.zip**.

Copy the **three resource files** directly into this directory:

- `back_left_right.tres`
- `back_left_right-0.png`
- `back_left_right-1.png`

Godot's `back_left_right.tres` references the two PNG pages **relatively**, so keep these names intact. The archive contains three seven-frame rows (`row_1`, `row_2`, `row_3`), which form **one sequential 21-frame run**; do not use each row as a different direction.

Isolated test mappings:
- `up_right` (Back Right): native 21-frame edited resource.
- `up_left` (Back Left): horizontal mirror of the same 21 frames.

`run8_uploaded.gd` normalizes all run-loop durations across all eight directions without degrading the images. The previous temporary rear-diagonal source is used only until these files arrive. `tests/run8_uploaded_smoke.gd` checks the frame count, 768x1168 canvas, and mirroring once they exist.

Main-game scene, project.godot, and gameplay remain unchanged. Test only at `/run8-uploaded/`.
