# Lembah Asri 2D — camera 3/4 in a 2D scene

**Official direction:** pure Godot 2D is acceptable. The illustration itself already encodes a three-quarter camera, so a 2D Camera2D should pan/zoom across the artwork, not try to reproject it with 3D meshes.

Scene entry: `scenes/world_2d.tscn`, scripts `world_2d.gd` and `player_2d.gd`.
Source of truth art file: `assets/art/concept_farm.png` from the approved user image.
Initial map size: 1650 x 928 virtual pixels; stage 1 uses a single flattened illustration,
which **cannot** provide true foreground occlusion or animation until split into layers.

Stage 2: split ground / buildings / vegetation-front / people / UI, remove baked-in
player, baked-in dialog/HUD, and replace the player with genuine transparent animation
sprites. Add 2D CollisionPolygon2D to house, fences, river and stable. Preserve camera
angle, original protagonist identity, tropical architecture, and coherent scale.

Stage 3: implement till / plant / water / harvest, NPC schedules, markets, dialogue,
animals, and layered parallax scenery. Keep Web export from main branch working.
