shader_type spatial;
render_mode unshaded, depth_draw_opaque, cull_disabled;

// Low-cost tropical ocean. Two gentle wave bands add life without animated
// vertices, reflections, particles or harsh repeating white noise.
varying vec2 ocean_xz;

void vertex() {
    ocean_xz = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
}

void fragment() {
    float radial = length(ocean_xz / vec2(75.0,66.0));
    float offshore = smoothstep(0.90,1.95,radial);
    vec3 lagoon = vec3(0.045,0.57,0.67);
    vec3 deep_sea = vec3(0.025,0.245,0.51);

    float long_wave = sin(ocean_xz.x*0.19 + ocean_xz.y*0.13 - TIME*0.42);
    float crossing = sin(ocean_xz.x*0.08 - ocean_xz.y*0.22 - TIME*0.31);
    float wave_shimmer = 0.5 + 0.5*(long_wave*0.65 + crossing*0.35);
    vec3 water = mix(lagoon,deep_sea,offshore);
    water *= 0.965 + 0.055*wave_shimmer;
    // A faint coastal light band, not a solid white foam ring.
    float shallows = 1.0-smoothstep(0.78,1.10,radial);
    water += vec3(0.025,0.050,0.044)*shallows*wave_shimmer;
    ALBEDO = water;
    ROUGHNESS = 0.32;
    METALLIC = 0.0;
}
