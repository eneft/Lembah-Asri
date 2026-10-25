# Lembah Asri · FBX 3D Run Tester (Browser)
Independent 3D preview at https://eneft.github.io/Lembah-Asri/run-tester/ deployed as a **separate static subpath** by the existing Godot Pages action.

## Usage
Open the hosted tester: both running animations load automatically. To compare another FBX version, optionally choose two FBX files through the upload control.
- **01 Running Normal** loads the real animation in Running_Textured.fbx
- **02 Run Anime** loads the real animation in Run_Textured.fbx
- Play/Pause, playback speed (0.25–2x), orbit camera, zoom and reset camera

**Important limitation:** `assets.zip` contains the two UV-restored FBX animations and optimized color/normal/PBR image maps from the uploaded files. The existing Pages workflow extracts that ZIP under `/run-tester/assets/`. Both animations load automatically. The file picker remains optional for overriding these assets with local FBX files and texture images. Files selected in the browser remain local and are not uploaded to a server.

Uses Three.js 0.168.0 over jsDelivr. This is a WebGL tester for existing Godot FBX assets; it is **not a Godot HTML5 engine export**. It is isolated from the game's project.godot.
