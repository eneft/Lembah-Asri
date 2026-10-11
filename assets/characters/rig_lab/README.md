# Lembah Asri: experimental Bone2D walk-cycle

Open `res://scenes/character_rig_lab_2d.tscn` in Godot 4.3+ and press **F6** (run current scene).
**SPACE** starts/pauses. **1–6** inspects 6 key poses. **R** restarts.

The left character is an original static image. The right one is the same original PNG mapped to 10 cutout `Polygon2D` parts and several `Skeleton2D/Bone2D` joints. Legs pivot at hip and knee, arms counter-swing, and torso/head bob slightly. The character's face, hair, colors and backpack are never regenerated or horizontally flipped.

**Prototype limitations:** Original artwork was flattened, so covered pixels (behind hands, elbows and knees) do not exist. Rotating cutouts can visibly duplicate hands, tear seams and slide feet. This is NOT a production-ready walk cycle, a true deforming skin, or 8-direction gait. High-quality final rig needs separately painted transparent limb/torso layers, occluded texture restoration, and foot IK.

This branch intentionally does **not** modify the Stage 1 game scene, player controller, collisions, camera, existing 8-way pose artwork, or current deploy.
