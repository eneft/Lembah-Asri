shader_type canvas_item;
render_mode unshaded;
// RGB-only environment grade. The old procedural walk shader is retired.
// All animation poses come from the uploaded real SpriteFrames.
uniform float saturation : hint_range(0.0, 1.4) = 0.87;
uniform float contrast : hint_range(0.5, 1.5) = 0.88;
uniform float shadow_fill : hint_range(0.0, 0.2) = 0.05;
uniform float sun_warmth : hint_range(0.0, 0.3) = 0.075;
uniform float green_bounce : hint_range(0.0, 0.15) = 0.03;
void fragment() {
    vec4 original = texture(TEXTURE, UV);
    float luma = dot(original.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 graded = mix(vec3(luma), original.rgb, saturation);
    graded = (graded - vec3(0.5)) * contrast + vec3(0.5);
    float dark_area = 1.0 - smoothstep(0.12, 0.65, luma);
    graded += vec3(0.52, 0.43, 0.29) * shadow_fill * dark_area;
    float upper_left = 0.5 * (1.0 - UV.x) + 0.5 * (1.0 - UV.y);
    float lit_surface = smoothstep(0.03, 0.72, luma);
    graded += vec3(1.0, 0.76, 0.47) * sun_warmth * (0.4 + 0.6 * upper_left) * lit_surface;
    float lower_body = smoothstep(0.45, 0.95, UV.y);
    graded += vec3(0.31, 0.49, 0.24) * green_bounce
        * lower_body * (0.75 - 0.45 * luma);
    graded *= vec3(1.0, 0.995, 0.976);
    COLOR = vec4(clamp(graded, vec3(0.0), vec3(1.0)), original.a);
}
