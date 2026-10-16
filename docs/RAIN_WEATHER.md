# Lembah Asri — Hujan dan Percikan Air (Godot 4.3)

Efek reusable: `res://scenes/weather/rain_weather.tscn`, instanced pada scene utama dan `scenes/rumah_ladang_run8_test.tscn`.

- **RainBack**: streak rintik ringan di belakang avatar, z=-5.
- **RainFront**: rintik lebih dekat, z=12.
- **GroundSplashes**: crown splash dua semburan kecil dan ring yang memudar di jalur/halaman terbuka, bukan atap bangunan, z=14.
- **RiverRipples**: ring dan percikan hujan di atas air, diposisikan dengan sampling alpha **aset sungai yang asli** `assets/art/separated/river_water.webp` pada (1058,288), z=15.
- **Perbaikan lag Oktober 2026:** render tidak lagi menggambar ratusan `draw_arc` dan `draw_line` setiap frame. Empat layer memakai masing-masing satu `MultiMeshInstance2D` (GPU instancing), sprite kecil dibuat hanya saat pertama dimuat. Hujan diperbarui maksimal **30 FPS**, percikan/ripple maksimal **20 FPS** (tidak mengubah kecepatan karakter/kamera). Jumlah partikel dasar sekarang 165 + 145 hujan dan 75 + 65 splash, dan browser menjalankan 75% jumlah itu. Saat hujan OFF, layer dan proses update dimatikan. Tidak mengubah shader air, collision, background, pivot karakter, ukuran sprite, HUD utama, scene/atlas RUN8 dan IDLE8.
- Default hujan **aktif**. Preview Rumah-Ladang memiliki checkbox **Hujan + percikan air** untuk pengguna mobile/desktop. Scene utama bisa toggle dengan tombol R.
- `RainWeather.intensity` adalah pilihan untuk tingkat hujan; untuk scene baru drag/instance `scenes/weather/rain_weather.tscn`.
- Smoke khusus pada `tests/rain_weather_smoke.gd` menguji kedua scene, empat layer, seed percikan air, kontrol toggle, player idle dan main collision. Dipasang pada Godot CI dan Web export.

Browser: https://eneft.github.io/Lembah-Asri/rumah-ladang-test/

- Test validasi render GPU: `tests/rain_render_smoke.gd` mengambil hasil gambar sebenarnya pada renderer Compatibility, lalu membandingkan sebelum/sesudah hujan OFF.


## Kalibrasi hujan tampak lebih deras (14 Oktober 2026)

Karena user menilai optimasi awal tampak seperti gerimis, density visual dikalibrasi tanpa kembali ke per-particle `_draw`: RainBack **230** dan RainFront **220** instance (browser **90%**, yaitu ±207 + 198 rintik). Tebal streak **2.8 px** dan panjang **27 px** pada mesh sumber, opacity/ramp meningkat dan arah angin sedikit lebih jelas. Splash di halaman (**75**) dan riak sungai (**65**) tidak diubah. Semua tetap hanya **empat draw batch** dan update cap **30/20 Hz**, sehingga tidak menambah node/physics, tidak menyentuh kamera, karakter, atau background. CI visual mengetes agar area hujan di frame benar-benar tampak lebih padat (bukan sekadar sukses memuat scene).

**Pengukuran visual:** pembanding render versi ringan sebelumnya menghasilkan 101 piksel hujan terdeteksi pada viewport 640×360. Tes revisi membutuhkan minimal 145 piksel di viewport yang sama; performa FPS nyata tetap perlu divalidasi di perangkat pengguna.


## Genangan, pantulan dan footstep splash (14 Oktober 2026)

Scene utama dan Rumah-Ladang test: **12 genangan** berbentuk elips pseudo-isometrik di jalur halaman. Tekstur dibuat prosedural sekali saja, dengan tepi lembut dan highlight refleksi langit; update kilau 12 Hz. Percikan hujan di tanah kini dibuat lebih terang dan besar (125 native / 103 Web) agar tampak jelas di atas latar hijau, tetap menggunakan satu GPU MultiMesh batch pada 20 Hz. Efek injakan muncul **hanya ketika kaki karakter masuk area genangan sambil berjalan atau berlari** (trigger posisi kaki + cooldown 0,16 detik + jarak minimum 8 px). Ring-buffer 10 efek injakan, satu batch GPU, tidak menambah physics/collision/perhitungan berat. Total enam layer GPU batched, bukan ratusan node/DrawCalls. Saat toggle cuaca mati, animasi dan permukaan genangan disembunyikan bersamaan. Tes `tests/puddle_render_smoke.gd` memeriksa piksel hasil render asli pada renderer Compatibility, termasuk 3 efek independen.


## Dynamic ground rain impacts

GroundSplashes now recycles each pooled impact at a different random ground coordinate after a short independent lifetime. Three size categories (micro 65%, medium 25%, accent 10%) and independent fade timing create natural non-repeating rainfall. GPU MultiMesh instancing and the 20 Hz effect update remain unchanged. Roof exclusions use the existing exposed-soil polygon. River ripples, puddles and footstep splashes are unchanged. CI checks position recycling and real rendered-frame differences.


## Single-background Camera2D: weather and river pass (15 October 2026)
Only the `/camera2d/` preview opts into this weather system; legacy scenes
still keep their original GPU-batched rainfall and twelve puddle sites.
Use the top-right WEATHER control or keyboard **T** to switch CERAH,
MENDUNG, HUJAN RINGAN, HUJAN DERAS, BADAI. **R** toggles clear/heavy rain.
The new Camera2D default is HUJAN DERAS. Weather cloud grading stacks with
the existing manually selected time of day: overcast has a visibly darker
blue-grey tint, heavy rain is darker still and storm deepest. Storm adds
slowly varying gusts to the diagonal rain, faint wind trails and occasional
double-pulse lightning with a brief screen flash; no new audio assets.

Because the landscape is now **one baked sprite**, random reflections over
objects were unacceptable. `native_surface_zones.gd` defines small safe
bare-earth polygons, **eight** new puddle sites and three separate water
corridors. `rain_weather.configure_native2d_surfaces()` opts in only from
the 2D scene and re-seeds batched raindrop impacts inside the appropriate
region. Every puddle is validated across its FULL elliptical footprint,
not merely at its center. The old wall-side coordinates are not used for
native footstep detection. The open courtyard's painted rock, bridge,
roof and walls are excluded. These shapes are conservative artist-pass
estimates and should be checked in gameplay against the original image.

`AnimatedRiverCurrent` is a shader-driven polygon overlay: low-alpha
moving current lines/foam on three water-only regions, independent from
hujan and active even when sky is clear. Since the backdrop is a single
flattened image, this is animated **specular/current detail**, not physically
warping or reflowing the original painted water beneath every rock.
Mask corners can be adjusted by editing `native_surface_zones.gd` later.
The original Camera3D and all source PSD layers remain unchanged.


## Natural, collision-safe puddles in layered Camera2D (October 2026)
The first wetland pass mistakenly hardcoded eight nearly identical circles
in rows. Native Camera2D now chooses **7–11 different irregular puddles**
from polygon-constrained open soil on **each new rain episode**, not every
frame. `native_puddle_layout.gd` tests 48 probes per ellipse, rejects any
intersections with the 8 Photoshop-authored red collision obstacle zones,
and enforces loose separation. Width, height, rotation, reflection brightness,
phase, and position vary. Same-rain light/heavy/storm changes keep the exact
positions; returning from clear/mendung to rain creates a fresh layout.
Pools start at 66% size and grow slowly, staying stationary once placed.
`rain_layer.gd` still renders all pools in one GPU MultiMesh and preserves
the old static Camera3D layout. The native footstep splash now uses the
actual rotated variable ellipse rather than a hardcoded 29×11 oval.
Physical player movement, rain particle count, PSD layer order, bridge
collision, and other weather states are unchanged. Soil masks are
conservative estimates: they require visual verification against the art.
`tests/psd_native_weather_smoke.gd` tests area containment, seed stability,
weather lifecycle and variable dimensions, while
`tests/psd_native_puddle_render.gd` checks distinct rendered GPU pixels.

## Irregular puddle profiles and directional river current (16 October 2026)
The PSD Camera2D preview now selects varying small/medium/large puddle sizes,
random positions including occasional loose groups, unequal spacing and a
**different shader-driven shoreline contour for each pool**. Each MultiMesh
instance carries its own seed, coastline jaggedness and lobe count, so these
are no longer identical ovals with different transforms. The GPU still renders
all pools in one batch. Footstep water contact uses the same irregular
contour formula. A rainfall episode keeps its puddles stationary, with subtle
ripple motion inside the surfaces rather than blinking the whole pool.

The 3 Photoshop-aligned river polygons now have their own fixed downstream
directions. Two moving wave systems and drifting foam are **spatially advected**
continuously through the water, instead of globally oscillating brightness.
Rain raises the wave/foam visibility and downstream speed; shore and bridge
masks, PSD layering, collision and legacy Camera3D remain untouched. The
painted background river underneath is still a static source image; this
effect animates surface detail without physically distorting the original
painting. CI checks randomized contour/gap profiles, real rendered motion in
clear and heavy-rain lighting, and exact fixed water-region boundaries.

## Visibility hotfix — stronger puddles and continuously moving river
Puddles on the native PSD Camera2D preview now have distinct dark wet-earth
centers, clear soft reflective rims, and subtle traveling internal ripples.
They keep independent randomized silhouettes and positions, do not overlap
Photoshop collision masks, and do not globally pulse in opacity. Their initial
growth starts at 82% of full width to reduce the long barely-visible onset.
The original Camera3D weather and player collision remain unchanged.

The native river combines camera-scale screen-image refraction with strong
continuous downstream wave streaks and moving foam. Rain increases current
strength, flow speed, and bright foam, with 110 batched rain-on-river splashes.
The original water-only polygons, rocks, bridge, layered Photoshop scene and
underlying painting remain unchanged. The shader is confined to the three
approved water masks, so water outside those masks is still static painted art.

Render tests now require visibility against the original dirt background and
motion under rainy darkening, instead of only checking that shaders compile.

## River continuity correction after mobile screenshot (16 October 2026)
The previous PSD Camera2D implementation drew three *small* clipped flow
polygons while most visible blue river pixels were part of the static
background, so the player mainly saw occasional shimmering/flicker.
The old shader also displaced the painting by only about 1 screen pixel.

The replacement uses ONE continuous downstream channel polygon and a
blue/cyan color gate against the authentic background, protecting brown
bridge planks, bank vegetation, rocks and soil without changing their art.
It samples two different downstream-translated positions of the original
painted water (up to 46 screen pixels), cross-fades the phases to hide wrap,
and adds slender foam trails that *travel*, rather than pulsating the opacity
of an otherwise static surface. The effect works under CERAH as well as
rain; rain raises travel speed and foam intensity. All this remains one
Polygon2D/ShaderMaterial pass without CPU water simulation.

The original three precise river-water masks remain unchanged for actual
raindrop contacts (and are NOT used as the broad current visibility mask).
Smoke tests explicitly verify the continuous-channel coverage, and GPU
render regression now fails for a too-small animated or flickering area.
The default Camera3D and every Photoshop source asset stay untouched.

## Smooth continuous downstream motion — 16 October 2026
A mobile playtest confirmed the stream is now visibly flowing but its bright
shimmer pulses too strongly. Root cause: the animated river shader blended two
`fract()`-reset texture translations over each time cycle, making an obvious
repeating intensity change in the moving water. The new native Camera2D shader
does not reset or wrap the painted-water scroll sample. Instead it uses a
bounded, traveling downstream refraction field and softer foam crests, so water
detail moves continuously without a repeated snap or stark flashes. Heavy-rain
foam amplitude is reduced while its downstream speed remains clearly visible.
Water-only pixel gating, PSD collision masks, character ordering, the bridge,
the original artwork and the Camera3D version remain unchanged. GPU rendering
and Web export checks are still authoritative; the final iPhone impression
should be reviewed after publishing.

## Preferred current restored; loop-seam flicker fix (16 October 2026)
Mobile visual feedback confirmed that the long traveling current in the
previous shader looked better than the later short oscillating displacement.
The stronger downstream texture scroll has therefore been restored from
the previously approved commit. Only its cycle blending was changed:
the triangular mixing weight at the two offset reset points is replaced
with smoothstep easing to remove visible abrupt transitions. The moving
foam retains the same downstream patterns, but the brightest foam threshold
is widened and rain glints toned down to avoid white blinking.

The collision, PSD layers, player, river coverage/color gate, weather
selection and legacy Camera3D remain unchanged. Native GPU regression
now samples both sides of BOTH seam points while the shader clock is
frozen; ordinary movement and rainy-weather visibility tests still run.

## Sparse puddles, storm-water stability and mobile contain (16 October 2026)
The single-PSD Camera2D preview now has **3–4 visible puddles** chosen
from eight approved soil pockets, with small location/size/shape variation.
The collision validator rejects full footprints hitting wall, stones, house,
bridge or river. Each rainy episode randomly reshuffles the pockets (with
seeded deterministic tests); switching from rain to heavy rain or storm
does not relocate an existing pool. If a Photoshop collision edit blocks
a pocket, rejection sampling on the current soil mask fills remaining slots.
Legacy 3D weather and existing PSD layer/collision geometry are unchanged.

The preferred long downstream river motion is kept, but texture travel
is limited to 28 rather than 46 screen pixels per scroll pass, bright foam
is softer, and storm uses its own subdued foam/highlight parameters. Rain
remains flowing, not strobing. Existing seam, rendered water-motion, storm
visibility and GPU-batched weather tests remain in place.

For mobile/touch screens **only**, the native PSD Camera2D preview expands
the Godot logical viewport to the device aspect then fits the ENTIRE
original 1672×941 artwork with uniform camera scaling (contain, zoom 1.0
relative to full scene). Desktop retains its existing 1.45× follow zoom,
and main Camera3D project settings are not changed. The image is never
cropped, stretched non-uniformly, reflowed or edited. On portrait phones
the unavoidable unused area outside the landscape artwork remains visible;
turning the phone landscape makes the artwork significantly larger.
The touch UI remains anchored to the real viewport.

### Storm visibility CI calibration
Regression testing revealed that excessively damping both flow and foam in
heavy rain could make the rendered current disappear while it remained visible
in sunshine. The native water now retains 28px sample travel, but has stronger
body/crest contrast for normal and heavy rain. BADAI explicitly lowers
foam intensity relative to heavy rain, without switching off the current.
CI checks this relative foam setting, the randomized 3–4 puddle count,
seeded rerolls, water-only masks and mobile no-crop camera zoom.
