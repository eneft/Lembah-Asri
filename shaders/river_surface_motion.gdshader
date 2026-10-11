shader_type canvas_item;
render_mode unshaded;
// Provisional river animation from the original picture. Once a clean
// painted river mask exists, swap this chroma mask for real waterfall layers.
uniform float flow_speed : hint_range(0.0, 3.0) = 1.0;
uniform float distortion : hint_range(0.0, 0.005) = 0.00135;
uniform float opacity : hint_range(0.0, 1.0) = 0.64;
void fragment() {
    vec2 uv = UV;
    vec4 still = texture(TEXTURE, uv);
    float cyan = smoothstep(0.025, 0.15, min(still.b - still.r, still.g - still.r));
    float right_channel = smoothstep(0.73, 0.85, uv.x) * smoothstep(0.40, 0.51, uv.y);
    float lower_channel = smoothstep(0.56, 0.71, uv.x) * smoothstep(0.78, 0.91, uv.y);
    float blue_water = cyan * max(right_channel, lower_channel);
    float t = TIME * flow_speed;
    vec2 drift = vec2(
        sin(uv.y * 160.0 + t * 1.75) + sin(uv.y * 290.0 - t * 0.9),
        cos(uv.x * 137.0 - t * 1.5)
    ) * distortion;
    vec4 shifted = texture(TEXTURE, clamp(uv + drift, vec2(0.0), vec2(1.0)));
    float sparkle = 0.5 + 0.5 * sin(uv.x * 265.0 + uv.y * 110.0 + t * 1.8);
    vec3 liquid = mix(still.rgb, shifted.rgb, 0.82);
    liquid += vec3(0.025, 0.035, 0.047) * sparkle * blue_water;
    COLOR = vec4(clamp(liquid, vec3(0.0), vec3(1.0)), still.a * blue_water * opacity);
}
