# Original Photoshop input for Camera3D

Copy the ORIGINAL Photoshop source file into this directory using the exact
filename **background.psd** (or **background** if it has no file extension).

Then commit and push it with GitHub Desktop. GitHub Actions workflow
import-psd-camera3d.yml will export the four actual PSD layers as full RGBA
PNGs to assets/art/psd_background/ and commit those generated files.

Do not put a screenshot or an earlier reconstructed image here:
the exporter validates the 1672x941 PSD canvas and exact layer offsets
required by scenes/rumah_ladang_psd_camera3d.tscn.

The four files will NOT exist on GitHub until the original PSD source is
committed and the automated import workflow succeeds.
