shader_type spatial;
render_mode unshaded, depth_draw_opaque, cull_disabled;

// Low-cost tropical ocean. Coastal water color is aligned with the ACTUAL
// 260m island footprint (including the fishing cove), not a circular radius.
uniform sampler2D coastal_proximity : source_color, filter_linear_mipmap_anisotropic, repeat_disable;
varying vec2 ocean_xz;

void vertex() {
    ocean_xz = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
}

void fragment() {
    // The same physical occupied-land mask is baked alongside the GLB.
    // White = land/nearshore; black = deep water > ~35m from shore.
    vec2 mask_uv = clamp((ocean_xz + vec2(180.0)) / 360.0,vec2(0.0),vec2(1.0));
    float nearshore = texture(coastal_proximity,mask_uv).r;
    vec3 lagoon = vec3(0.045,0.57,0.67);
    vec3 deep_sea = vec3(0.025,0.245,0.51);

    float long_wave = sin(ocean_xz.x*0.19 + ocean_xz.y*0.13 - TIME*0.42);
    float crossing = sin(ocean_xz.x*0.08 - ocean_xz.y*0.22 - TIME*0.31);
    float wave_shimmer = 0.5 + 0.5*(long_wave*0.65 + crossing*0.35);
    vec3 water = mix(deep_sea,lagoon,nearshore * 0.92);
    water *= 0.965 + 0.055*wave_shimmer;
    // A faint coastal light band, not a solid white foam ring.
    float shallows = smoothstep(0.35,0.95,nearshore);
    water += vec3(0.025,0.050,0.044)*shallows*wave_shimmer;
    ALBEDO = water;
    ROUGHNESS = 0.32;
    METALLIC = 0.0;
}
