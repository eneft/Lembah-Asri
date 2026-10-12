# RUN 8 arah: kalibrasi proporsi dan pivot karakter

Scope: **isolated** `scenes/run8_uploaded.tscn` only. Main scene, `project.godot`, gameplay, and uploaded source textures remain unchanged.

## Why equal canvases are not equal visual sizes

The Godot `.tres` frames across all five native sources have the same **768×1168** frame canvas. Their **visible character silhouettes** differ substantially. Fixed `scale=(0.23,0.23)` causes a 988-pixel-high side-view body to appear noticeably smaller than the 1101-pixel-high front-view body.

To calibrate, measure all atlas-frame alpha bounding boxes with threshold **alpha ≥25**. For each directional source, use the median of visible character heights, and use the median visible lowest foot position. Retain all individual frames, motion/bounce, aspect ratio, colors, sprite resolution and 12 FPS.

| Source directions | Median visible height | Median foot Y | Uniform X/Y scale | Expected visible body height |
|---|---:|---:|---:|---:|
| Right / Left (mirrored) | 988 px | 1081 px | 0.25631 | 253.23 screen px |
| Down Right / Down Left (mirrored) | 1076.5 px | 1097.5 px | 0.23523 | 253.23 screen px |
| Down (front) | 1101 px | 1126 px | 0.23000 | 253.23 screen px |
| Up Right / Up Left (edited back diagonal) | 1048 px | 1073 px | 0.24163 | 253.23 screen px |
| Up (back) | 1081 px | 1120 px | 0.23425 | 253.23 screen px |

Calibration formula:

```text
screen-height-target = 0.23 × 1101 = 253.23 px
direction-scale = 0.23 × 1101 / median-visible-height(direction)
actor.scale = Vector2(direction-scale, direction-scale)
actor.offset = Vector2(-384, -median-foot-y(direction))
```

`AnimatedSprite2D.centered` remains false, `texture_filter` remains nearest, and actor world position still denotes the anchored foot/pivot. Each original animation frame remains unresized; only the whole animation's per-direction transform is adjusted. This avoids frame-by-frame pumping and makes natural step-bounce remain visible.

**Unchanged:** every animation is 12 FPS (one new frame per 1/12 sec), the moving actor travels at 160 px/s across all eight directions with diagonals normalized, and phase is maintained when turning mid-run. Loop durations are not forced to match because frame counts differ.

**Verification:** CI runs `tests/run8_uploaded_smoke.gd`, which checks each of the eight calibrated visible heights, matching mirrored size and foot pivots, uniform X/Y scale, 12 FPS, equal movement speed, and nonresetting stride phases. Values are tied to the currently approved art assets; any future replacement spritesheet needs a new measurement/calibration, not recycled old factors.
