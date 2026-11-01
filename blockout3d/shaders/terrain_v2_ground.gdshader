shader_type spatial;
render_mode depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

// Terrain V2: world-space painterly material. Old photogrammetry UV paint is
// deliberately not sampled because it belongs to the pre-flattened island.
varying vec3 terrain_world;
varying vec3 terrain_normal;

float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float value_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x),
        mix(hash21(i + vec2(0., 1.)), hash21(i + vec2(1., 1.)), f.x), f.y);
}
void vertex() {
    terrain_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
    terrain_normal = normalize(MODEL_NORMAL_MATRIX * NORMAL);
}
void fragment() {
    float h = terrain_world.y;
    float steep = 1.0 - clamp(abs(terrain_normal.y), 0.0, 1.0);
    float n = value_noise(terrain_world.xz * 0.22);
    float fine = value_noise(terrain_world.xz * 1.3);
    vec3 grass = mix(vec3(0.31,0.51,0.22), vec3(0.43,0.59,0.27), n);
    vec3 sand = mix(vec3(0.69,0.54,0.34), vec3(0.82,0.70,0.48), n);
    vec3 stone = mix(vec3(0.36,0.34,0.29), vec3(0.49,0.46,0.38), n);
    float beach = 1.0 - smoothstep(0.60, 2.4, h + (n - 0.5) * 0.55);
    float cliff = smoothstep(0.28, 0.65, steep);
    vec3 base = mix(grass, sand, beach);
    base = mix(base, stone, cliff * (1.0 - beach * 0.35));
    base *= 0.94 + fine * 0.12;
    ALBEDO = base;
    ROUGHNESS = 0.96;
    METALLIC = 0.0;
}
