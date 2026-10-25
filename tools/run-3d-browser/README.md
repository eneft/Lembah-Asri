# Lembah Asri · FBX 3D Run Tester (Browser)
Independent 3D preview at https://eneft.github.io/Lembah-Asri/run-tester/ deployed as a **separate static subpath** by the existing Godot Pages action.

## Usage
Click the file picker and choose both original animation files `Running_Textured.fbx` and `Run_Textured.fbx` at once (optionally the five texture PNG files).
- **01 Running Normal** loads the real animation in Running_Textured.fbx
- **02 Run Anime** loads the real animation in Run_Textured.fbx
- Play/Pause, playback speed (0.25–2x), orbit camera, zoom and reset camera

**Important limitation:** The GitHub source stores the viewer code only; the FBX binary files are **not hosted** because they originated as private conversation uploads. The viewer asks the user to select the files locally; they remain in the browser and are not uploaded to a server. If the FBX's embedded texture does not render, select the BaseColor PNG together with the two FBX files. Once the 3D binaries are hosted, the file chooser may be removed and the existing code can load them automatically.

Uses Three.js 0.168.0 over jsDelivr. This is a WebGL tester for existing Godot FBX assets; it is **not a Godot HTML5 engine export**. It is isolated from the game's project.godot.
