shader_type canvas_item;
render_mode unshaded;
// Non-destructive scene tuning on the clean paint-only artwork. The hero, UI,
// contact shadow and eventual crops/NPC never get baked into this texture.
uniform float saturation : hint_range(0.5, 1.5) = 0.96;
uniform float contrast : hint_range(0.6, 1.4) = 0.95;
uniform float warmth : hint_range(0.0, 0.20) = 0.035;
void fragment() {
    vec4 texel = texture(TEXTURE, UV);
    float gray = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 result = mix(vec3(gray), texel.rgb, saturation);
    result = (result - vec3(0.5)) * contrast + vec3(0.5);
    result += vec3(0.65, 0.42, 0.14) * warmth * smoothstep(0.35, 0.87, gray);
    COLOR = vec4(clamp(result, vec3(0.0), vec3(1.0)), texel.a);
}