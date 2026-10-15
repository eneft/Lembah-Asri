shader_type canvas_item;
render_mode blend_mul, unshaded;

// Multiplicative full-screen atmosphere. A neutral no-op in daytime, applied
// AFTER Camera3D, PSD CanvasLayers and existing low-overhead rain.
// Avoids double-lighting the painted highlights with real 3D lights.
uniform vec3 scene_tint : source_color = vec3(1.0, 1.0, 1.0);
uniform float atmosphere : hint_range(0.0, 1.0) = 0.0;
uniform float vignette : hint_range(0.0, 0.12) = 0.04;
void fragment() {
 vec2 q = UV - vec2(0.5);
 float edge = smoothstep(0.1, 0.7, dot(q, q));
 vec3 grade = mix(vec3(1.0), scene_tint, atmosphere);
 grade *= 1.0 - (vignette * atmosphere) * edge;
 COLOR = vec4(grade, 1.0);
}
