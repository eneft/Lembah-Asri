shader_type spatial;
render_mode unshaded, depth_draw_opaque, cull_disabled;

// Lightweight tropical ocean: no textures, particles, reflections or
// expensive time-dependent noise. One plane extends 180m around the island.
// The cyan shallow sea blends into deeper blue far from the coastline.
varying vec2 ocean_xz;

void vertex() {
    ocean_xz = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
}

void fragment() {
    vec2 island_radius = vec2(75.0, 66.0);
    float coast_distance = length(ocean_xz / island_radius);
    float offshore = smoothstep(0.90, 1.95, coast_distance);

    vec3 lagoon = vec3(0.045, 0.62, 0.76);
    vec3 deep_sea = vec3(0.017, 0.245, 0.65);
    ALBEDO = mix(lagoon, deep_sea, offshore);
    ROUGHNESS = 0.32;
    METALLIC = 0.0;
}
