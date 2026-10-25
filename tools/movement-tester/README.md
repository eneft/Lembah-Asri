# Lembah Asri — Movement Tester (Manual FBX)

https://eneft.github.io/Lembah-Asri/movement-tester/

- No default 3D characters and no default FBX animations. Upload FBX manually into the Idle, Walking, Running, Run Anime, or Jump slot.
- Each FBX **must include a skinned character mesh AND an animation** (e.g. Mixamo FBX "With Skin"). Animation-only FBX is rejected with a useful explanation.
- Each imported asset retains its own geometry, skeleton and original animation. The previous attempt to retarget clips by bone names could wreck proportions even when track names matched.
- WASD or arrows walk; hold Shift to run or press R to toggle run. Press Space to jump. Mobile joystick, hold RUN and tap JUMP.
- Jump includes independent vertical gravity/landing physics and works even without a Jump FBX. An optional Jump FBX plays once with its original mesh and skeleton during the jump; on landing it returns to the active locomotion slot.
- Locomotion chooses among slot assets by toggling model visibility — no skeleton retarget and **no crossfade** between different models, by design.
- For a visually consistent character, upload the same model in each FBX; model scale and floor placement are normalized per asset.
- Import accepts files locally from browser; files are not uploaded to GitHub, not saved persistently.
- The atlas at run-tester/assets/basecolor.webp is retained as a texture fallback for FBXs with valid UVs and no embedded texture. NO baked/default FBX models are loaded.
- Movement Tester stays separate from the Godot Lembah Asri game and existing Run Tester.

- Jump physics uses a slower 1.18–1.45 second arc (~0.62m apex) and never speeds a source FBX faster than 1× to fit the flight; imported FBX Hips Y root translation is suppressed to prevent double jumping.
- FBX avatar scale and floor alignment are calculated from the original skeleton bind pose before animation begins, to avoid enlarging a crouched Jump frame.
