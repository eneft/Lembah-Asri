# Lembah Asri — Movement Tester (WebGL)

Standalone prototype: https://eneft.github.io/Lembah-Asri/movement-tester/

- Keyboard WASD/arrow movement; hold Shift to run.
- Mobile joystick and hold-to-run button.
- One mesh/rig, multiple AnimationClips with 0.2-second crossfade.
- Local FBX uploads per Idle/Walking/Running/Run Anime slot, using browser file picker.
- Compares clip bone track names to the base Mixamo skeleton, rejects obviously incompatible rigs.
- Only two Running FBXs currently ship as assets; Idle/Walking are **not** present as FBX and are not claimed to exist.
- Run Normal baked into base FBX; Run Anime lazily loaded from original Run_Web_UV.fbx.
- No remote upload or persistence of locally supplied FBX.
- Test is not Godot gameplay and does not replace main Lembah Asri game.
- Files live under tools/movement-tester, 3D files are reused from run-tester/assets.
