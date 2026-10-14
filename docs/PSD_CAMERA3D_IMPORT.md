# Lembah Asri — layered Photoshop scene and genuine Camera3D

Choose `scenes/rumah_ladang_psd_camera3d.tscn` in Godot 4.3 and press **F6**.

This isolated scene uses actual **Node3D, Camera3D and Sprite3D**, not Camera2D. Camera3D looks at the image planes from an angle and uses orthographic projection. The art rig faces Camera3D so Photoshop's existing pseudo-isometric perspective remains visually correct. All four transparent layer textures remain independently selectable in Godot's 3D scene editor.

The exact bottom-to-top order is: **Background (layer 1) → 8-direction AnimatedSprite3D protagonist → House (layer 2) → Banana (layer 3) → Foreground tree (layer 4)**. The original Photoshop image offsets (including portions outside the canvas) are retained. Camera uses stable world-space smoothing without updating the 2D environment, preserving previous RUN8/IDLE8 resource files, gameplay source, and scenes.

**Binary PNG assets:** Extract the accompanying [PSD Camera3D asset ZIP] from ChatGPT directly into the **root of the Lembah-Asri project**, next to `project.godot`. Only the PSD PNG files are not uploaded to GitHub by the GitHub text connector; until copied, this new scene shows the previous flattened test image as a fallback, but the layers and 3D code are present. Stage `assets/art/psd_background/*.png` in GitHub Desktop to publish the exact editable art.

**Controls:** WASD/arrows and Shift (fast movement) on desktop, touch joystick and run button on mobile. Camera3D follows the player, maintains orthographic pseudo-isometric appearance, and uses the original character's 112px world height.

This Camera3D preview intentionally does **not** convert existing 2D CanvasItem rain/impact effects into 3D particles. Original rain/weather test and game main scenes remain intact. The PSD 3D scene is a separate experiment for layering/camera before optional 3D collisions and 3D rain are added.
