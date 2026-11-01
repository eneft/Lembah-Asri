shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

// BASE COLOR: retains the original baked terrain illustration (paths, soil,
// vegetation and color boundaries). Nothing is repainted globally.
uniform sampler2D base_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_disable;
uniform sampler2D base_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_disable;

// MICRODETAIL: two seamless 512px assets; world-space tiling gives ~500+ texels
// per ground meter near the character instead of stretching one island atlas.
uniform sampler2D grass_micro : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D soil_micro : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D micro_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;

uniform float tiles_per_meter : hint_range(0.2, 2.0, 0.05) = 0.72;
uniform float detail_strength : hint_range(0.0, 1.0, 0.05) = 0.82;
uniform float micro_normal_strength : hint_range(0.0, 1.0, 0.05) = 0.48;
uniform float base_normal_strength : hint_range(0.0, 1.0, 0.05) = 0.72;

varying vec3 terrain_world_pos;

void vertex() {
    terrain_world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
    // UV0 is the artist-authored original island color atlas.
    vec3 baked_color = texture(base_albedo, UV).rgb;

    // Landscape color preserved. Green-ish zones receive grass fiber;
    // neutral/brownish paths and rock receive earthy pebbles. Smooth blend
    // avoids hard material boundaries in the original painted landscape.
    float vegetation = smoothstep(-0.014, 0.105, baked_color.g - baked_color.r * 0.92);
    vegetation *= smoothstep(0.07, 0.28, baked_color.g);

    // World coordinates, not source UV: sharply detailed at close camera
    // ranges independent of how little of the 8K atlas covers this region.
    vec2 close_uv = terrain_world_pos.xz * tiles_per_meter;
    vec2 varied_uv = (terrain_world_pos.zx + vec2(12.31, -17.27)) * tiles_per_meter * 1.91;
    vec3 grass = texture(grass_micro, close_uv).rgb * vec3(1.17, 1.13, 1.23);
    vec3 soil = texture(soil_micro, close_uv).rgb * vec3(1.19, 1.22, 1.28);
    vec3 grain = mix(soil, grass, vegetation);

    // Low-strength offset tiling breaks the obvious repeated squares.
    float tiny_variation = texture(soil_micro, varied_uv).r;
    grain *= 1.0 + (tiny_variation - 0.83) * 0.13;
    grain = clamp(grain, vec3(0.76), vec3(1.21));
    ALBEDO = clamp(baked_color * mix(vec3(1.0), grain, detail_strength), vec3(0.0), vec3(1.0));

    vec3 macro_n = texture(base_normal, UV).xyz * 2.0 - 1.0;
    vec3 close_n = texture(micro_normal, close_uv).xyz * 2.0 - 1.0;
    vec3 combined_n = normalize(vec3(
        macro_n.xy * base_normal_strength + close_n.xy * micro_normal_strength,
        max(0.20, macro_n.z)
    ));
    NORMAL_MAP = combined_n * 0.5 + 0.5;
    NORMAL_MAP_DEPTH = 0.88;

    METALLIC = 0.0;
    ROUGHNESS = 0.97;
    SPECULAR = 0.18;
}
