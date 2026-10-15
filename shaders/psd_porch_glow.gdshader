shader_type canvas_item;
render_mode blend_add, unshaded;

// Deliberately restrained simulated porch ambience on the 2.5D plane.
// Not a physically accurate light: the original PSD contains baked shading.
uniform vec2 origin_uv = vec2(0.5, 0.4);
uniform vec2 radius_uv = vec2(0.11, 0.12);
uniform float glow_strength : hint_range(0.0, 0.5) = 0.0;
void fragment() {
 vec2 diff = (UV - origin_uv) / max(radius_uv, vec2(0.001));
 float falloff = exp(-dot(diff, diff) * 2.7);
 COLOR = vec4(vec3(1.0, 0.61, 0.28), glow_strength * falloff);
}
