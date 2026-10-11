shader_type canvas_item;
render_mode unshaded;
// Real alpha-masked surface cut from the painted river/waterfall.
// Mask alpha remains fixed: NO moving trees, rails, stones, or bridges.
uniform float flow_speed : hint_range(0.0, 3.0) = 1.0;
uniform float distortion : hint_range(0.0, 0.01) = 0.002;
uniform float opacity : hint_range(0.0, 1.0) = 0.76;
void fragment() {
    vec2 uv = UV;
    vec4 original = texture(TEXTURE, uv);
    float t = TIME * flow_speed;
    vec2 drift = vec2(
        sin(uv.y * 120.0 - t * 1.6) * distortion,
        (cos(uv.x * 115.0 + t * 2.0) + sin(uv.x * 210.0 - t)) * distortion * 0.6
    );
    vec4 shifted = texture(TEXTURE, clamp(uv + drift, vec2(0.0), vec2(1.0)));
    float spark = pow(0.5 + 0.5 * sin(uv.x * 260.0 + uv.y * 110.0 - t * 2.8), 5.0);
    vec3 moving_water = mix(original.rgb, shifted.rgb, 0.84);
    moving_water += vec3(0.058, 0.068, 0.071) * spark * original.a;
    COLOR = vec4(clamp(moving_water, vec3(0.0), vec3(1.0)), original.a * opacity);
}
