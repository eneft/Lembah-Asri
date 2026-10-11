shader_type canvas_item;
render_mode unshaded;

// Water animation is applied ONLY to the separate RGBA river cutout.
// It uses two visually distinct motions: a traveling river surface and
// downward, foamy waterfall streaks. Rock/bridge alpha stays unchanged.
uniform float flow_speed : hint_range(0.0, 3.0) = 1.45;
uniform float distortion : hint_range(0.0, 0.01) = 0.0035;
uniform float opacity : hint_range(0.0, 1.0) = 0.90;
uniform float ripple_strength : hint_range(0.0, 1.0) = 0.42;
uniform float foam_strength : hint_range(0.0, 1.0) = 0.42;
// Exposed only for deterministic render QA; 0 means regular real-time flow.
uniform float phase_offset = 0.0;

void fragment() {
    vec2 uv = UV;
    vec4 original = texture(TEXTURE, uv);
    float t = TIME * flow_speed + phase_offset;

    // Directional shear: individual ripples glide along the stream and
    // differ in phase with distance, rather than vibrating in place.
    float current = uv.y * 116.0 + uv.x * 58.0 - t * 3.7;
    vec2 drift = distortion * vec2(
        sin(current) + 0.46 * sin(current * 1.8 + t * 0.8),
        cos(uv.x * 142.0 - t * 2.3) * 0.65
    );
    vec4 advected = texture(TEXTURE, clamp(uv + drift, vec2(0.0), vec2(1.0)));

    float ripple = pow(0.5 + 0.5 * sin(current * 0.90), 7.0);
    float ripple2 = pow(0.5 + 0.5 * sin(uv.y * 188.0 - uv.x * 58.0 - t * 4.8), 9.0);
    vec3 liquid = mix(original.rgb, advected.rgb, 0.88);
    liquid += vec3(0.16, 0.21, 0.22)
        * (ripple * 0.65 + ripple2 * 0.35) * ripple_strength;

    // In this cropped river-water atlas the cascade and plunge pool occupy
    // the lower-middle/right region. Soft edges keep foam out of the trees.
    float cascade_x = smoothstep(0.40, 0.51, uv.x)
        * (1.0 - smoothstep(0.77, 0.88, uv.x));
    float cascade_y = smoothstep(0.56, 0.71, uv.y);
    float waterfall_zone = cascade_x * cascade_y;

    // Downward moving streaks and churning white bubbles at the bottom.
    float vertical = pow(0.5 + 0.5 *
        sin(uv.y * 156.0 - t * 9.0 + sin(uv.x * 37.0) * 1.4), 8.0);
    float splashes = pow(0.5 + 0.5 *
        sin(uv.x * 105.0 + uv.y * 93.0 - t * 6.3), 8.0);
    liquid += vec3(0.26, 0.28, 0.27)
        * (vertical * 0.7 + splashes * 0.3)
        * waterfall_zone * foam_strength;

    // Preserve the original static edge mask: animation cannot spill
    // across the rock bank, bridge or foliage even if UV samples move.
    COLOR = vec4(clamp(liquid, vec3(0.0), vec3(1.0)), original.a * opacity);
}
