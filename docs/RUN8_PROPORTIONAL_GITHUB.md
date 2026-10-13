# Lembah Asri — proportional 8-direction RUN

## Integration status

The `main` scene player (`scripts/stage1_player.gd`) now **optionally** loads
`res://assets/characters/run8_proportional/Run8_SpriteFrames.tres` when all
required files have been installed. Until that pack is available, the *existing*
run animation remains active. This prevents broken startup or invisible players.

**Note:** An installer/script commit does not mean the binary atlas has been
uploaded. The two normalized PNG atlas files must exist at the paths below for
the new animation to appear. Never describe the new art as deployed while
those binaries are missing.

## Source / proportions

Source: `LembahAsri_Run8_Proportional_Godot4.zip`, made from `New_run_godot4.zip`.

- 8 directional cycles: down 10, down_right 10, right 8, up_right 10,
  up 8, up_left 10, left 8, down_left 10.
- Total: 74 directional pose references (46 original + 28 mirrored).
- Every pose uses canonical 512x768 canvas, median body height ~640px,
  foot pivot (256,708), and uniform X/Y scale.
- Main scene display target remains **112 world pixels high**.
- Existing walk/idle resources are **not replaced**.
- Side and rear-diagonal original legacy cycles remain the fallback.

## Install the approved pack

From the repository root:

```bash
python tools/install_run8_proportional.py /path/to/LembahAsri_Run8_Proportional_Godot4.zip
```

Or extract the prebuilt `LembahAsri_Run8_GitHub_Assets_Patch.zip` directly
at the repository root, preserving directory paths. Do not overwrite
`project.godot` with the standalone test project's file.

The installed files are:

```
assets/characters/run8_proportional/Run8_Normalized_Base.png
assets/characters/run8_proportional/Run8_Normalized_Mirror.png
assets/characters/run8_proportional/Run8_SpriteFrames.tres
assets/characters/run8_proportional/Run8Player.gd
assets/characters/run8_proportional/Run8Player.tscn
scripts/run8_proportional_test.gd
scenes/run8_proportional_test.tscn
docs/run8_proportional_scale_audit.json
```

Commit and push the added files to GitHub.

## Verify

1. Godot 4: open `scenes/run8_proportional_test.tscn` and run current scene (F6).
2. Verify eight directions via arrows/WASD and mobile buttons; compare figure
   height and foot anchoring across turns.
3. Run the existing startup scene `scenes/house_garden_stage1.tscn` (F5).
4. Main scene: press **Shift + a direction** to use the new run cycles.
   Releasing Shift falls back to existing walk; stopping uses existing idle.
5. Confirm boundaries, bridges, camera zoom, controls, and background art
   remain unchanged.

No GitHub connector operation can read ZIP/PNG bytes directly from a
conversation-local sandbox path. Commit status of the source code and asset
binaries must therefore be checked separately.
