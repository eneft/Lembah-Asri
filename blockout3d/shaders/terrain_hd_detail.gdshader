shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

// WEB-LITE: TWO texture reads near the player (4K baked color + packed RGBA
// grain/normal). Only the original color is fetched at longer distances.
// Previous shader fetched 5+ textures/pixel including an expensive 4K normal.
uniform sampler2D base_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_disable;
uniform sampler2D packed_detail : filter_linear_mipmap_anisotropic, repeat_enable;

uniform float tiles_per_meter : hint_range(0.2, 2.0, 0.05) = 0.72;
uniform float detail_strength : hint_range(0.0, 1.0, 0.05) = 0.76;
uniform float micro_normal_strength : hint_range(0.0, 1.0, 0.05) = 0.42;

varying vec3 terrain_world_pos;

void vertex() {
    terrain_world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
    vec3 baked_color = texture(base_albedo, UV).rgb;
    ALBEDO = baked_color; // Keep the user's original path/grass/rock colors.

    // Fragment VERTEX is in view space. Faraway terrain does not need a
    // second texture lookup: seamless microdetail is only visible close-up.
    float camera_distance = length(VERTEX);
    float near_factor = 1.0 - smoothstep(10.0, 23.0, camera_distance);
    NORMAL_MAP = vec3(0.5, 0.5, 1.0);
    NORMAL_MAP_DEPTH = 0.75;
    if (near_factor > 0.005 && detail_strength > 0.005) {
        vec4 fine = texture(packed_detail, terrain_world_pos.xz * tiles_per_meter);
        float vegetation = smoothstep(-0.01, 0.11, baked_color.g - baked_color.r * 0.92);
        float material_mix = mix(0.48, 1.0, vegetation);
        float grain = (fine.a - 0.5) * 0.55 * detail_strength * near_factor * material_mix;
        ALBEDO = clamp(baked_color * (1.0 + grain), vec3(0.0), vec3(1.0));
        NORMAL_MAP = mix(vec3(0.5, 0.5, 1.0), fine.rgb, micro_normal_strength * near_factor);
    }

    METALLIC = 0.0;
    ROUGHNESS = 0.97;
    SPECULAR = 0.16;
}
