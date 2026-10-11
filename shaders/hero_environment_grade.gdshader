shader_type canvas_item;
render_mode unshaded;

// Lembah Asri: non-destructive environmental color grading for the 2D hero.
// Matches the warm, softly painted tropical morning backdrop.
// All eight original lossless RGBA sprite textures stay untouched.
// The grade affects RGB, and the 12-pose walk samples the original RGBA.
uniform float gait_phase = 0.0;
uniform float gait_strength : hint_range(0.0, 1.5) = 0.0;
uniform float gait_profile : hint_range(0.0, 1.0) = 0.0;
uniform float gait_sign = 1.0;

vec2 walk_sample_uv(vec2 coord) {
    // Original PNG canvas: 1152 x 1632. Hip is about Y=0.59;
    // knees about 0.77, boots about 0.92. Smooth falloffs prevent seams.
    float c = sin(gait_phase) * gait_sign;
    float opposing = -c;
    float left_side = 1.0 - smoothstep(0.465, 0.515, coord.x);
    float right_side = smoothstep(0.485, 0.535, coord.x);

    float thighs = smoothstep(0.585, 0.705, coord.y);
    float shins = smoothstep(0.72, 0.905, coord.y);
    float boot = smoothstep(0.84, 0.925, coord.y)
        * (1.0 - smoothstep(0.965, 0.998, coord.y));
    float leg = thighs * (1.0 - smoothstep(0.975, 0.998, coord.y));

    // Contact -> down -> passing -> up -> contact; legs alternate by PI.
    // Sweep the shin/boot more than the thigh; keep pelvis fixed.
    float left_swing = c * left_side;
    float right_swing = opposing * right_side;
    float swing = left_swing + right_swing;
    float rearward = mix(0.022, 0.030, gait_profile);
    coord.x -= swing * (0.012 * thighs + rearward * shins)
        * leg * gait_strength;

    // Swinging foot clears the floor. The stance foot stays at baseline.
    float left_lift = max(0.0, c) * left_side;
    float right_lift = max(0.0, opposing) * right_side;
    float lift = left_lift + right_lift;
    coord.y += (0.022 + gait_profile * 0.006) * lift * boot * gait_strength;

    // Modest knee bend in the passing phase, not whole-image bouncing.
    coord.y -= 0.005 * abs(c) * shins * (1.0 - boot) * gait_strength;

    // Front/back and diagonal views: arms swing opposite their legs.
    float arms_y = smoothstep(0.32, 0.43, coord.y)
        * (1.0 - smoothstep(0.565, 0.66, coord.y));
    float left_arm = 1.0 - smoothstep(0.265, 0.41, coord.x);
    float right_arm = smoothstep(0.59, 0.725, coord.x);
    float arm_shift = (-c * left_arm + c * right_arm) * arms_y;
    coord.y += arm_shift * 0.008 * gait_strength;
    coord.x += arm_shift * 0.006 * gait_profile * gait_strength;

    // Very subtle settling (under one pixel at in-game scale).
    float torso = smoothstep(0.16, 0.33, coord.y)
        * (1.0 - smoothstep(0.54, 0.70, coord.y));
    coord.y += (1.0 - cos(2.0 * gait_phase)) * torso * 0.0015 * gait_strength;
    return clamp(coord, vec2(0.0), vec2(1.0));
}

uniform float saturation : hint_range(0.0, 1.4) = 0.87;
uniform float contrast : hint_range(0.5, 1.5) = 0.88;
uniform float shadow_fill : hint_range(0.0, 0.2) = 0.05;
uniform float sun_warmth : hint_range(0.0, 0.3) = 0.075;
uniform float green_bounce : hint_range(0.0, 0.15) = 0.03;

void fragment() {
    vec2 source_uv = UV;
    if (gait_strength > 0.001) {
        source_uv = walk_sample_uv(UV);
    }
    vec4 original = texture(TEXTURE, source_uv);
    float luma = dot(original.rgb, vec3(0.2126, 0.7152, 0.0722));

    // Tame the illustration's punchy chroma and dark outlines.
    vec3 graded = mix(vec3(luma), original.rgb, saturation);
    graded = (graded - vec3(0.5)) * contrast + vec3(0.5);

    // Soft ochre fill lifts painted shadows, rather than crushing blacks.
    float dark_area = 1.0 - smoothstep(0.12, 0.65, luma);
    graded += vec3(0.52, 0.43, 0.29) * shadow_fill * dark_area;

    // Gentle warm daylight from upper left, common to the painted scenery.
    float upper_left = 0.5 * (1.0 - source_uv.x) + 0.5 * (1.0 - source_uv.y);
    float lit_surface = smoothstep(0.03, 0.72, luma);
    graded += vec3(1.0, 0.76, 0.47) * sun_warmth
        * (0.4 + 0.6 * upper_left) * lit_surface;

    // Subtle grassy reflected light near the trousers and boots.
    float lower_body = smoothstep(0.45, 0.95, source_uv.y);
    graded += vec3(0.31, 0.49, 0.24) * green_bounce
        * lower_body * (0.75 - 0.45 * luma);

    graded *= vec3(1.0, 0.995, 0.976);
    COLOR = vec4(clamp(graded, vec3(0.0), vec3(1.0)), original.a);
}
