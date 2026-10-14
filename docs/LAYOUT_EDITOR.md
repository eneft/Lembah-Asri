# Lembah Asri — Editable Stage 1 Layout (Godot 4)

Open `scenes/house_garden_stage1.tscn` in the Godot editor, then select the **2D** tab. The node tree is now serialized to the scene; all the currently available Stage 1 cutout assets are selectable in the editor.

## Editable nodes

- `BackgroundBase` — one continuous, cleaned terrain image. Don't move it independently unless you intend to realign the whole scene.
- `RiverWaterfallSurface` — shader-animated masked river, separate from ground; preserves its existing material and position.
- `HouseCutout` — house group, with `Visual` and `HouseWallsCollision` as children. Select the **parent** to move both house and collision together.
- `CoopCutout` — shed/coop group with its own collision.
- `BananaCutout`, `FrontFenceCutout`, `BridgeRailCutout` — independently movable cutouts, Y-sorted with the player.
- `RiverBankCollision` — existing river barrier; adjust if you edit the riverbank.
- `Player` — existing Godot 4 run/walk/idle 8-direction controller, collision and camera; idle artwork shows in editor.
- `GameplayHUDLayer`, `MobileControlsLayer` — original HUD and mobile touch controls.

The world uses `y_sort_enabled = true` on its root, and Y-anchored cutout parents at the approved foot/depth pivots. Preserve this design when adding buildings and vegetation.

## Editing and testing

1. Open `project.godot` using Godot 4, and double-click `scenes/house_garden_stage1.tscn`.
2. Select a top-level object such as `HouseCutout` in the Scene tree.
3. Press **W** (Move) or edit Transform > Position in the Inspector. Don't grab child `Visual` when moving the whole building.
4. Save (**Ctrl+S**), run the active scene (**F6**) or main scene (**F5**), and verify overlaps and collisions.
5. Commit changed `.tscn` / assets to GitHub using GitHub Desktop.

### Important current limits

The underlying terrain is one art image and some elements, such as individual coconut trees and the complete bridge deck, are still painted into that terrain. They are NOT yet independent image assets. Splitting them requires approved transparent, reconstructed cutouts; do not stretch/crop the original art to pretend they are independent.

The character's walkable footprint `walk_polygon` is currently hard-coded in `scripts/stage1_player.gd`; changing the river, bridge, or map size requires updating that footprint and colliders too. House and coop colliders move with their corresponding parent cutouts. The player's animation logic and camera are unchanged.

For comparison, the original script-generated Stage 1 scene is preserved as `scenes/house_garden_stage1_runtime_legacy.tscn`. Do not rename the script it references.

### Verification

This change is static-checked for scene resource paths, original pivot coordinates, dimensions, and node relationships. It has NOT been tested inside a running Godot editor/headless binary in the patch environment; please run F5/F6 locally before shipping a web build.
