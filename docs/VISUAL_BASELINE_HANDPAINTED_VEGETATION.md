# Lembah Asri Visual Baseline — Hand-Painted Vegetation

**Baseline established:** 16 November 2026  
**Reference:** user-approved in-game screenshot after PR #49 (unlit hand-painted tree material).  
**Status:** approved visual direction; preserve unless the project owner explicitly requests a change.

## Core visual direction

Lembah Asri vegetation uses a hand-painted, illustration-like surface appearance. The authored albedo/base-color texture must remain visually dominant and must not be re-shaded by real-time PBR lighting. The target is the appearance of the source painted texture, while retaining the existing 3D mesh silhouette and game-world placement.

This is a hybrid presentation: **3D geometry with a 2D-painted surface treatment**. Do not describe or implement it as a flat 2D sprite replacement.

## Approved tree material treatment

For the imported hand-painted tree GLB:

- Preserve the original base-color/albedo texture and UV mapping.
- Set the albedo texture to `THREE.SRGBColorSpace`.
- Use anisotropic filtering up to 8x, limited by device capability.
- Render the painted albedo with `THREE.MeshBasicMaterial` (unlit).
- Preserve relevant alpha/opacity, alpha map/test, sidedness, vertex-color, depth and transparency properties when converting the material.
- Do not apply directional/hemisphere shading, normal-map shading, metallic/roughness response, or environment reflections to the painted tree surface.
- Keep the tree mesh silhouette and cast shadows. The tree itself should not receive scene shadows that re-shade its painted surface.

## Scene and gameplay invariants

Unless explicitly requested, visual refinements must not alter:

- Gameplay, movement, jump behavior, or input.
- Collision and physics.
- Camera controls, camera framing behavior, or camera angle.
- Player scale standard (168 cm), rig, or animations.
- Tree positions, scale/placement, or level layout.

The outdoor sky/environment and world lighting may continue to affect the ground, character, and other scene elements, but must not override the approved unlit albedo treatment on painted vegetation.

## Extension to other assets

Apply this treatment selectively to other hand-painted vegetation (bushes, crops, flowers, and similar assets) only when their source textures are authored with painted highlights/shadows. Inspect each asset first; do not blindly convert every material in the project to unlit. Preserve each asset's original albedo and alpha details.

Buildings, props, terrain, water, characters, and UI are **not automatically covered** by this vegetation baseline.

## Acceptance checks

A change is acceptable when:

1. Painted color variation, brushwork, highlights, and shadows remain visible as authored in the source texture.
2. Real-time lights and normal maps do not add a second, visibly 3D shading pass to the tree surface.
3. The tree remains correctly depth-tested, silhouetted, placed, and casts a ground shadow.
4. No gameplay, collision, camera, character scale, animation, or level-layout regressions are introduced.
5. The result remains readable on desktop and mobile.

## Change control

Treat the approved in-game screenshot and this document as the visual regression baseline. Any change that makes the painted vegetation glossy, strongly PBR-shaded, washed out, or materially different from the approved appearance should be rejected or revised. Change this baseline only after explicit approval from the project owner.
