shader_type canvas_item;
render_mode unshaded;

// Eight original 512x640 RGBA PNGs remain authoritative.
// This shader adds a light 2D walk/run gait without replacing the approved art.
// It is procedural motion, not an authored animation frame set.
uniform float phase = 0.0;
uniform float strength : hint_range(0.0, 1.0) = 0.0;
uniform float profile : hint_range(0.0, 1.0) = 0.0;
uniform float direction_sign = 1.0;

void fragment() {
    vec2 source_px = UV / TEXTURE_PIXEL_SIZE;
    vec2 target_px = source_px;

    // Opposing leg swings. Keep the hips anchored; leave the painted ground
    // shadow below the boots static instead of bobbing the entire artwork.
    float split = 256.0;
    float side = step(split, source_px.x) * 2.0 - 1.0;
    float split_fade = smoothstep(4.0, 24.0, abs(source_px.x - split));
    float leg_y = smoothstep(375.0, 427.0, source_px.y)
        * (1.0 - smoothstep(582.0, 604.0, source_px.y));
    float shin = smoothstep(388.0, 530.0, source_px.y);
    float step_cycle = sin(phase) * direction_sign;
    float swing = step_cycle * side * strength * split_fade * leg_y * shin;
    target_px.x -= swing * mix(18.0, 25.0, profile);

    // The advancing boot lifts slightly while the trailing boot stays planted.
    float boot = smoothstep(492.0, 540.0, source_px.y)
        * (1.0 - smoothstep(582.0, 608.0, source_px.y));
    target_px.y += max(0.0, step_cycle * side) * boot
        * split_fade * strength * mix(7.0, 10.0, profile);

    // Very small opposing hand swing: sleeves, backpack and torso do not
    // rotate or get rescaled, avoiding changes to the locked silhouette.
    float forearm_y = smoothstep(337.0, 388.0, source_px.y)
        * (1.0 - smoothstep(441.0, 469.0, source_px.y));
    float left_arm = smoothstep(157.0, 183.0, source_px.x)
        * (1.0 - smoothstep(202.0, 228.0, source_px.x));
    float right_arm = smoothstep(301.0, 321.0, source_px.x)
        * (1.0 - smoothstep(340.0, 366.0, source_px.x));
    float side_arm = smoothstep(220.0, 248.0, source_px.x)
        * (1.0 - smoothstep(276.0, 300.0, source_px.x));
    float arm_area = forearm_y
        * mix(max(left_arm, right_arm), side_arm, profile);
    target_px.y -= cos(phase) * direction_sign * strength * arm_area * 4.0;

    // Head/torso vertical settle, max 2 original pixels. The ground shadow
    // and texture resolution are untouched.
    float body = 1.0 - smoothstep(562.0, 600.0, source_px.y);
    target_px.y += (0.5 - 0.5 * cos(2.0 * phase))
        * body * strength * 2.0;

    vec4 texel = texture(TEXTURE, clamp(target_px * TEXTURE_PIXEL_SIZE, vec2(0.0), vec2(1.0)));
    // Canonical turnaround includes a painted, near-white floor stroke below
    // the boots. It is not part of the protagonist; reject that stroke at
    // render time, retaining the original PNGs bit-for-bit.
    // Restrict to the footwear baseline, never the shirt/skin/hair.
    float neutral = 1.0 - smoothstep(0.10, 0.25,
        max(texel.r, max(texel.g, texel.b)) - min(texel.r, min(texel.g, texel.b)));
    float near_white = smoothstep(0.72, 0.91, min(texel.r, min(texel.g, texel.b)));
    float floor_band = smoothstep(572.0, 594.0, source_px.y);
    float unwanted_floor = floor_band * near_white * neutral;
    texel.a *= 1.0 - unwanted_floor;
    COLOR = texel;
}
