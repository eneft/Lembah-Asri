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

vec2 walk_sample_uv(vec2 uv) {
    // The original idle sprite has approximately two boots in the lower
    // quarter. All positions are normalized on each 1152x1632 base image.
    // At the game's 0.105 sprite scale, small UV shifts are invisible:
    // here a full stride displaces shoes by about 7-10 screen pixels.
    float stride = sin(gait_phase) * gait_sign;
    float crossing = cos(gait_phase);
    float left = 1.0 - smoothstep(0.465, 0.515, uv.x);
    float right = smoothstep(0.485, 0.535, uv.x);
    float opposite = left - right;

    // Pinned hips; the deformation increases gradually into the shins.
    float leg = smoothstep(0.595, 0.69, uv.y);
    float calf = smoothstep(0.725, 0.87, uv.y);
    float boot = smoothstep(0.845, 0.925, uv.y)
        * (1.0 - smoothstep(0.973, 0.998, uv.y));
    float bottom_fade = 1.0 - smoothstep(0.972, 0.998, uv.y);

    // Opposing planted and passing legs. Wider forward-back excursion
    // than the original shader, but torso/head and backpack are stable.
    float swing_x = opposite * stride * gait_strength;
    float lateral = mix(0.040, 0.070, gait_profile);
    uv.x -= swing_x * (0.018 * leg + lateral * calf)
        * bottom_fade;

    // Leg near camera swings forward; another trails. Swinging shoe
    // rises during passing phase while the planted boot remains grounded.
    float lift_left = max(0.0, stride) * left;
    float lift_right = max(0.0, -stride) * right;
    float clearance = (lift_left + lift_right) * gait_strength;
    uv.y += clearance * (0.058 + gait_profile * 0.008) * boot;

    // Front/back angles show the depth motion mainly as vertical steps.
    uv.y -= swing_x * (1.0 - gait_profile) * calf
        * boot * 0.022 * gait_strength;
    uv.y += opposite * crossing * calf * 0.004 * gait_strength;

    // Opposite arm swing: masks avoid jacket torso and backpack.
    float forearm = smoothstep(0.315, 0.39, uv.y)
        * (1.0 - smoothstep(0.59, 0.66, uv.y));
    float arm_l = 1.0 - smoothstep(0.265, 0.39, uv.x);
    float arm_r = smoothstep(0.61, 0.75, uv.x);
    float arm_swing = stride * (arm_r - arm_l) * forearm * gait_strength;
    uv.y += arm_swing * 0.024;
    uv.x += arm_swing * (0.004 + gait_profile * 0.014);

    // Minimal elastic settling, not a bounce of the whole PNG.
    float shirt = smoothstep(0.22, 0.34, uv.y)
        * (1.0 - smoothstep(0.54, 0.67, uv.y));
    uv.y += shirt * (1.0 - cos(2.0 * gait_phase)) * 0.0020
        * gait_strength;
    return clamp(uv, vec2(0.0), vec2(1.0));
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
