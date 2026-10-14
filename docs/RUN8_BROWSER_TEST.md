# Lembah Asri — RUN8 Proportional browser test (approved)

The official, direct browser animation test is:

**https://eneft.github.io/Lembah-Asri/run8/**

This path exports `scenes/run8_proportional_test.tscn`, which instantiates
`assets/characters/run8_proportional/Run8Player.tscn` using the actual
`Run8_SpriteFrames.tres` and both `Run8_Normalized_*.png` atlases.

The former page at the same `/run8/` URL was exported from
`scenes/run8_test.tscn` and incorrectly showed the **old 16-pose WALK**
sheets at running speed. It was NOT a valid demonstration of the approved
proportional RUN. That export mapping has been fixed.

## Prove the correct new source is running

The page displays **"RUN8 PROPORTIONAL (NEW)"** and
**"SOURCE: Run8_Normalized_Base + Mirror | 74 poses"**.
The sprite plays immediately and auto-rotates through 8 directions; mobile
users can also tap the eight direction buttons. WASD/arrow keys select
directions, and the FPS slider changes playback speed for inspection.

The 74 normalized directional pose references are: down 10, down_right 10,
right 8, up_right 10, up 8, up_left 10, left 8, down_left 10.
Frames are normalized to a common 512x768 cell, 640px visible body height,
and foot pivot at (256,708), with baked left-facing orientations.

**Animation tempo:** RUN LEFT and RIGHT play at **8 FPS** (20% slower than
10 FPS). The other six RUN directions remain **10 FPS**. Character travel
speed, WALK, IDLE, frame count, size, and pivot do not change. The preview
speed control is relative to the normal 10-FPS reference.

Web export is verified by loading the **actual preview index.pck** headlessly
and checking for:
`PROPORTIONAL RUN8 PREVIEW ACTIVE: 74 poses`

Additionally `tests/run8_proportional_browser_smoke.gd` asserts the
PNG source, 74 frames, frame timing, 8-way animation playback,
mirroring behavior and pivot. A PASS on the old
`tests/run8_directions_smoke.gd` is only a regression check for the old
WALK preview and must never be described as proof of new RUN.

## Main game is a separate screen

https://eneft.github.io/Lembah-Asri/

The main illustrated house scene retains original IDLE and WALK resources;
the proportional animation is selected **only while RUN is engaged**:

- Desktop: hold Shift while moving with WASD or arrow keys
- Mobile: hold LARI while moving the joystick simultaneously

An old-looking stationary/slow-walking character on the **main scene**
does not mean RUN8 is missing; IDLE and WALK were intentionally preserved.
The dedicated `/run8/` page always displays the new RUN source instead.

If the browser previously visited the old test, hard refresh the browser
or use a cache-busting URL query (e.g., `/run8/?v=approved74`).
