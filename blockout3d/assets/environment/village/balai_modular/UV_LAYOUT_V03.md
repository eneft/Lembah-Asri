# Balai Desa modular — painted texture + UV plan (V0.3)

**Reference:** Balai Desa / Kantor Desa Lembah Asri, the approved Indonesian rural office illustration. The reference image is a visual guide, not a texture directly stretched across the facade. Keep its roof proportions, wall and column arrangement, windows, double door, stone stair, white sign and Indonesian flag unchanged.

## Authored paint layers

| Module | Godot texture | Source artwork | UV |
| --- | --- | --- | --- |
| Clay limasan / four slopes | `roof_painted.svg` | Weathered handmade terracotta tiles, chalk chips, patchy moss | 4 UV plane islands, repeated at approx. 2.8–2.9 m |
| Plaster wall & columns | `plaster_painted.svg` | Warm ivory plaster, peeling ochre undercoat, hairline cracks and subtle base moss | World-projected X/Y (front/back), Z/Y (sides); 2.4 m per UV tile; shared across cutout panels |
| Masonry foundation, veranda & stairs | `stone_painted.svg` | Irregular grey-brown stones, rough joint lines and small moss clusters | Metre-scaled box UVs |
| Door, windows, roof fascia, wood stool | `wood_painted.svg` | Narrow aged oak planks, directional grain, worn edges and knots | Separate module islands with matching scale |
| Roadside office sign | `white_painted.svg` | Chipped white painted boards with cream undercoat | Box UVs; live `Label3D` black lettering |
| Glazing | `glass_teal.png` | Existing dark teal glass, deliberately subdued | Existing pane UV |
| Preview ground | `earth_path.png` | Existing understated soil | Preview-only ground plane |

The five `*_painted.svg` files are original **drawn vector texture artwork**; Godot converts them to GPU-friendly raster textures at import. They intentionally do not add tile or brick mesh faces, and never generate noisy material colors at runtime. Mipmapped 512×512 imported textures balance painterly detail and iPhone WebGL memory.

## Unwrap rules

1. **Keep geometry unchanged:** the authoritative scene model and main game collision are not swapped. These UV changes apply exclusively to the isolated `/balai-modular/` preview.
2. **Wall origin continuity:** the UV of each wall segment is calculated from its house-local X/Y or Z/Y position. A door or window splits the mesh but never resets the texture coordinates to zero at the cut edge.
3. **Roof separately unwrapped:** four limasan UV planes, overlapping clay ridge-cap geometry for silhouette only. Terracotta tile relief exists in the painted texture and low-strength normal map, not in thousands of geometric tile meshes.
4. **Surface repeat is intentional:** the roof, plaster, stone, wood, and white-wood textures are tileable in 512px import format. The source `*.svg` is editable in Inkscape, Illustrator or Blender’s UV/image workflow.
5. **Consistent local meter scale:** 1 unit = 1 m; hall footprint 9.20 × 7.50 m; ridge height 5.28 m. Six true window openings, a real front doorway, and public sign on the ground remain intact.
6. **Material preservation:** normal maps `roof_normal.png` and `stone_normal.png` continue to supply subtle physical depth, but the details should primarily be read from the hand-painted diffuse art.
7. **Review on mobile:** test front/side/back UV seams, texture bleeding at eaves, distant mip levels, and web rendering. This is a **texture prototype**, not a visually signed-off final replacement.

## Preview

`res://scenes/modular_balai_preview.tscn` launches the independent four-view studio model at `/balai-modular/`. Existing /terrain-test/, gameplay, 17 plots, collision and open-world scene remain unchanged.
