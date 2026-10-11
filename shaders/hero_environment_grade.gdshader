shader_type canvas_item;
render_mode unshaded;

// Lembah Asri: non-destructive environmental color grading for the 2D hero.
// Matches the warm, softly painted tropical morning backdrop.
// All eight original lossless RGBA sprite textures stay untouched.
// The grading only affects RGB; the original texture alpha is preserved.
uniform float saturation : hint_range(0.0, 1.4) = 0.87;
uniform float contrast : hint_range(0.5, 1.5) = 0.88;
uniform float shadow_fill : hint_range(0.0, 0.2) = 0.05;
uniform float sun_warmth : hint_range(0.0, 0.3) = 0.075;
uniform float green_bounce : hint_range(0.0, 0.15) = 0.03;

void fragment() {
    vec4 original = texture(TEXTURE, UV);
    float luma = dot(original.rgb, vec3(0.2126, 0.7152, 0.0722));

    // Tame the illustration's punchy chroma and dark outlines.
    vec3 graded = mix(vec3(luma), original.rgb, saturation);
    graded = (graded - vec3(0.5)) * contrast + vec3(0.5);

    // Soft ochre fill lifts painted shadows, rather than crushing blacks.
    float dark_area = 1.0 - smoothstep(0.12, 0.65, luma);
    graded += vec3(0.52, 0.43, 0.29) * shadow_fill * dark_area;

    // Gentle warm daylight from upper left, common to the painted scenery.
    float upper_left = 0.5 * (1.0 - UV.x) + 0.5 * (1.0 - UV.y);
    float lit_surface = smoothstep(0.03, 0.72, luma);
    graded += vec3(1.0, 0.76, 0.47) * sun_warmth
        * (0.4 + 0.6 * upper_left) * lit_surface;

    // Subtle grassy reflected light near the trousers and boots.
    float lower_body = smoothstep(0.45, 0.95, UV.y);
    graded += vec3(0.31, 0.49, 0.24) * green_bounce
        * lower_body * (0.75 - 0.45 * luma);

    graded *= vec3(1.0, 0.995, 0.976);
    COLOR = vec4(clamp(graded, vec3(0.0), vec3(1.0)), original.a);
}
