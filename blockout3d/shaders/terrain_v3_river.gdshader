shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_opaque;

// Fast illustrated river current. Single opaque river mesh, no particle
// textures, screen-space reflections or transparency sort.
varying vec2 flow_coord;

void vertex() {
    flow_coord = UV;
}

void fragment() {
    float across = abs(flow_coord.x * 2.0 - 1.0);
    float current = sin(flow_coord.y * 2.6 - TIME * 1.40
                      + sin(flow_coord.x * 8.0 + flow_coord.y * 0.53) * 0.6);
    float ripples = sin(flow_coord.y * 5.3 - TIME * 2.1 + flow_coord.x * 13.0);
    vec3 deep = vec3(0.095, 0.36, 0.42);
    vec3 shallow = vec3(0.19, 0.53, 0.52);
    float edge = smoothstep(0.25, 0.95, across);
    vec3 water = mix(deep, shallow, edge * 0.61);
    water += vec3(0.040,0.066,0.050) * (0.5 + 0.5 * current) * 0.65;
    // Long broken glints that move downstream; avoid high-contrast flicker.
    float glint = smoothstep(0.74, 0.96,
                           current * 0.55 + ripples * 0.17 + 0.40);
    water += vec3(0.10,0.14,0.12) * glint * (1.0-edge*0.55) * 0.28;
    ALBEDO = water;
    ROUGHNESS = 0.40;
    METALLIC = 0.0;
}
