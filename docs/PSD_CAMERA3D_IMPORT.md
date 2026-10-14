# Lembah Asri — Photoshop layers and Camera3D

Open scenes/rumah_ladang_psd_camera3d.tscn in Godot 4.3, then press **F6**. This isolated test scene uses actual Node3D, **orthographic Camera3D**, four separate Sprite3D planes, and RUN8 + IDLE8 character animations.

Bottom-to-top layer order: **01_background → character → 02_house → 03_banana → 04_foreground_tree**.

## Import the actual Photoshop PSD (without screenshot crops)

The four PNG files are **not yet committed**. Until all four exist, the scene displays the old flattened test image as a fallback; that fallback is NOT proof the Photoshop layer import was completed.

From the repository root, on a computer containing the original Photoshop file named 'background' (even if its .psd extension is omitted), run:

1. Install Python packages: python -m pip install psd-tools Pillow
2. Export: python tools/export_psd_camera3d.py "C:\path\to\background"
3. Inspect four PNG files and manifest.json under assets/art/psd_background/.
4. Stage the generated assets using GitHub Desktop (or git add assets/art/psd_background/), commit and push to main.

This exporter reads the **actual PSD layer pixels**, including their transparency, rather than cropping the screenshot or substituting earlier reconstructed images. To protect scene composition, it verifies the approved 1672 × 941 canvas and layer bounds:

- 01_background.png: (0, 0, 1672, 941)
- 02_house.png: (157, -107, 988, 517)
- 03_banana.png: (63, 217, 358, 577)
- 04_foreground_tree.png: (-468, 341, 448, 1234)

The script refuses a PSD with mismatched bounds or a missing layer. Fix the asset source instead of forcing unmatched artwork into the game.

Controls: WASD/arrows on desktop, Shift to run, joystick and run button on mobile. The Camera3D follows the 112px-high character using smooth movement.

This remains a **separate test scene**. The previous main scene, 2D weather effects, rain and existing gameplay were not replaced. Switching project.godot to the new main scene should wait until four actual layer PNGs are available and visually verified.
