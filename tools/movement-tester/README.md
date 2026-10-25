# Lembah Asri — Movement Tester (Manual FBX)

https://eneft.github.io/Lembah-Asri/movement-tester/

- No default 3D characters and no default FBX animations. Upload FBX manually into the Idle, Walking, Running or Run Anime slot.
- Each FBX **must include a skinned character mesh AND an animation** (e.g. Mixamo FBX "With Skin"). Animation-only FBX is rejected with a useful explanation.
- Each imported asset retains its own geometry, skeleton and original animation. The previous attempt to retarget clips by bone names could wreck proportions even when track names matched.
- WASD or arrows walk; hold Shift for run. Mobile joystick and RUN button.
- Locomotion chooses among slot assets by toggling model visibility — no skeleton retarget and **no crossfade** between different models, by design.
- For a visually consistent character, upload the same model in each FBX; model scale and floor placement are normalized per asset.
- Import accepts files locally from browser; files are not uploaded to GitHub, not saved persistently.
- The atlas at run-tester/assets/basecolor.webp is retained as a texture fallback for FBXs with valid UVs and no embedded texture. NO baked/default FBX models are loaded.
- Movement Tester stays separate from the Godot Lembah Asri game and existing Run Tester.
