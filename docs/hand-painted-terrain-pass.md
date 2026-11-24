# Unified terrain paint — 24 November 2026

This pass replaces seven terrain images with one coordinated gouache treatment:

- village_grass_painted.webp and creek_meadow.webp share identical meadow pigment.
- soil_handpainted.webp uses warm muted tan courtyard earth.
- creek_bank_painted.webp uses sandy taupe with sparse embedded pebbles.
- home_garden_soil.webp uses medium warm umber.
- home_courtyard.webp and home_garden_rows.webp were repainted against that same palette, retaining the clearing/path composition and four vertical bed layout.

UV coordinates, mesh geometry, collision, crop state masks, and water remain unchanged. Mirrored texture addressing avoids hard opposite-edge seams for the new earth tiles. Existing grass grading and shoreline blending still run.

## Artwork provenance

Generated with the built-in image generation tool. Master prompt: production top-down terrain albedo atlas, four equal panels (short olive/sage meadow; compacted warm tan earth; medium umber cultivated soil; sandy taupe bank with tiny pebbles), soft gouache, shared brush scale, medium-low contrast, flat diffuse lighting; no text, borders, vignette, plants, rows, cast shadows, photographic noise or neon color.

Courtyard edit prompt: preserve clearing outline and path exits exactly; repaint pigments and brushwork using the master atlas. Garden edit prompt: preserve exactly four vertical rounded beds at their original locations; match meadow, tan paths and umber soil to the master; no plants or wooden borders. Runtime images were cropped/resized and encoded to WebP after generation.

## Scope

This is the terrain foundation of the wider art consistency work. Embedded house, character, tree, fence and rock atlases have not been repainted by this change. Those assets need separate UV-aware reviews; this pass does not claim the entire game has been retextured.

## Validation

Production build and 15 existing terrain/material/grass/farming tests pass. Production browser captures of the home and river views are in art-review/terrain-nov24. The development build encountered a Rapier aliasing error; the production build rendered the player and both views successfully. Full gameplay regression is not claimed by these visual checks.
