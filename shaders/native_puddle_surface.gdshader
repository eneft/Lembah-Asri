shader_type canvas_item;
render_mode blend_mix, unshaded;

// Each MultiMesh instance supplies different shoreline seed, distortion and
// lobe count. One draw batch for every puddle, no extra sprites/nodes.
varying vec4 contour_seed;
varying vec4 puddle_tint;
void vertex() {
 contour_seed = INSTANCE_CUSTOM;
 puddle_tint = COLOR;
}
void fragment() {
 vec2 p = (UV - vec2(0.5)) * 2.0;
 float theta = atan(p.y, p.x);
 float phase = contour_seed.r * 6.2831853;
 float jag = mix(0.075, 0.155, contour_seed.g);
 float lobes = 3.0 + floor(contour_seed.b * 3.01);
 float coast = 1.0 + jag * (
  sin(theta * lobes + phase)
  + 0.70 * sin(theta * (lobes + 2.0) - phase * 1.30)
  + 0.40 * sin(theta * (lobes + 5.0) + phase * 0.80));
 float radius = length(p * vec2(1.36, 1.34)) / coast;
 float coverage = 1.0 - smoothstep(0.79, 1.01, radius);
 float rim = smoothstep(0.70, 0.83, radius) *
  (1.0 - smoothstep(0.91, 1.01, radius));
 // Low moving micro-ripples within a FIXED pool; no global opacity pulse.
 float streak = sin(p.x * 17.0 + p.y * 5.0
  - TIME * 1.10 + phase + sin(p.y * 13.0 + phase));
 float glint = pow(max(streak, 0.0), 8.0)
  * (1.0 - smoothstep(0.15, 0.85, abs(p.y)));
 float depth = 1.0 - smoothstep(0.15, 0.98, radius);
 vec3 wet_earth = mix(vec3(0.27, 0.42, 0.43),
  vec3(0.51, 0.67, 0.66), glint * 0.55 + rim * 0.22);
 float alpha = coverage * (0.27 + depth * 0.08 + rim * 0.10 + glint * 0.10);
 COLOR = vec4(wet_earth * puddle_tint.rgb, alpha * puddle_tint.a);
}
