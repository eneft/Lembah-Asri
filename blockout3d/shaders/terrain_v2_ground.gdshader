shader_type spatial;
render_mode depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

// Single 1K painterly atlas: grass / earth / sand / stone.
// Shore sand and proposed village locations are baked in COLOR_0, not extra
// overlaid geometry. Mobile shader; no triplanar or costly height sampling.
uniform sampler2D biome_atlas : source_color, filter_linear_mipmap_anisotropic, repeat_disable;

varying vec3 terrain_world;
varying vec3 terrain_normal;
varying vec3 landuse_weights; // R = planned building, G = yard, B = paths.
varying float shoreline_sand; // A = distance-aware southern/eastern beach.

float hash12(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smooth_noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash12(cell);
    float b = hash12(cell+vec2(1.0,0.0));
    float c = hash12(cell+vec2(0.0,1.0));
    float d = hash12(cell+vec2(1.0,1.0));
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}

vec2 tile_uv(vec2 world, vec2 tile, float meters_per_tile) {
    // The 496px painted tile is wrapped by eight pixels of its own artwork.
    // Only sample inside the corresponding 512px quadrant of the atlas.
    vec2 uv = fract(world / meters_per_tile);
    return tile*0.5 + vec2(8.0/1024.0) + uv*(496.0/1024.0);
}

void vertex() {
    terrain_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
    terrain_normal = normalize(MODEL_NORMAL_MATRIX * NORMAL);
    landuse_weights = COLOR.rgb;
    shoreline_sand = COLOR.a;
}

void fragment() {
    vec2 pos = terrain_world.xz;
    float height_m = terrain_world.y;
    float tilt = 1.0 - clamp(abs(terrain_normal.y), 0.0, 1.0);
    // Smooth broad-scale variation; no visible hard 11m square grid.
    float macro = smooth_noise(pos/15.0);
    float soft_shift = (macro-0.5)*0.42;

    vec3 grass = texture(biome_atlas, tile_uv(pos,vec2(0.0,0.0),4.2)).rgb;
    vec3 earth = texture(biome_atlas, tile_uv(pos,vec2(1.0,0.0),4.8)).rgb;
    vec3 sand  = texture(biome_atlas, tile_uv(pos,vec2(0.0,1.0),5.3)).rgb;
    vec3 stone = texture(biome_atlas, tile_uv(pos,vec2(1.0,1.0),5.1)).rgb;

    // Beaches follow the actual shore rather than painting a sharp yellow
    // contour wherever a mountain valley happens to be low.
    float shore = clamp(shoreline_sand,0.0,1.0);
    float low_sand = 1.0-smoothstep(0.75,3.6,height_m+soft_shift);
    float beach = max(low_sand*0.30, shore*0.89);
    float soil = smoothstep(0.15,0.45,tilt)*0.30;
    // Mountain and minor hillfaces need visible ILLUSTRATED STONE, not a
    // blanket of grass. Blend sculpted slope plus altitude: highland ridges
    // become rocky while broad northern village plateau stays green.
    float highland = smoothstep(7.0, 15.5, height_m);
    float cliff_rock = smoothstep(0.18,0.48,tilt);
    float ridge_rock = highland * smoothstep(0.07,0.25,tilt) * 0.66;
    float rock = clamp(max(cliff_rock,ridge_rock) * (1.0-shore*0.70),0.0,0.96);

    vec3 color = mix(grass,earth,soil);
    color = mix(color,sand,clamp(beach,0.0,1.0));
    color = mix(color,stone,rock);
    // Incised riverbed: shaded moist soil and river pebbles on both banks.
    // Analytic center follows the same deterministic curve in topography.py.
    float river_x = -5.0*sin((pos.y+55.0)*0.047)
                    + 1.5*sin((pos.y+34.0)*0.13);
    float river_region = smoothstep(-35.0,-28.0,pos.y)
                       * (1.0-smoothstep(44.0,51.0,pos.y));
    float bank_distance = abs(pos.x-river_x);
    float damp_bank = smoothstep(1.4,2.6,bank_distance)
                    * (1.0-smoothstep(4.1,5.7,bank_distance))
                    * river_region;
    vec3 wet_earth = mix(earth,stone,0.30) * 0.81;
    color = mix(color,wet_earth,damp_bank*0.78);
    // A little broad color drift, while retaining the approved hand-painted
    // blade detail. Smooth gradients avoid patterned rectangular grass areas.
    color *= 0.95 + 0.10*macro;

    float yard_weight = clamp(landuse_weights.g,0.0,1.0);
    float path_weight = clamp(landuse_weights.b,0.0,1.0);
    float building_weight = clamp(landuse_weights.r,0.0,1.0);
    vec3 trimmed_lawn = mix(grass,earth,0.17);
    vec3 village_path = mix(earth,grass,0.12);
    vec3 packed_earth = mix(earth,grass,0.17);
    color = mix(color,trimmed_lawn,yard_weight*0.58);
    color = mix(color,village_path,path_weight*0.79);
    color = mix(color,packed_earth,building_weight*0.86);
    ALBEDO = color;
    METALLIC = 0.0;
    ROUGHNESS = 0.97;
}
