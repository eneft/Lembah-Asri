shader_type canvas_item;
render_mode blend_mix, unshaded;
// GPU-batched per-instance shoreline; no repeated oval or whole-pool blinking.
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
 float jag = mix(0.085, 0.18, contour_seed.g);
 float lobes = 3.0 + floor(contour_seed.b * 3.01);
 float coast = 1.0 + jag * (
  sin(theta * lobes + phase)
  + 0.72 * sin(theta * (lobes + 2.0) - phase * 1.25)
  + 0.45 * sin(theta * (lobes + 5.0) + phase * 0.80));
 float radius = length(p * vec2(1.34, 1.28)) / coast;
 float coverage = 1.0 - smoothstep(0.78, 1.03, radius);
 float rim = smoothstep(0.68, 0.83, radius)
  * (1.0 - smoothstep(0.88, 1.02, radius));
 float depth = 1.0 - smoothstep(0.10, 0.95, radius);
 float wave_a = sin(p.x * 15.0 + p.y * 4.0 - TIME * 1.05 + phase);
 float wave_b = sin(p.x * 9.0 - p.y * 7.0 - TIME * 0.72 - phase * 0.7);
 float glint = pow(max(wave_a, 0.0), 7.0) * 0.55
  + pow(max(wave_b, 0.0), 8.0) * 0.35;
 glint *= 1.0 - smoothstep(0.25, 0.92, abs(p.y));
 vec3 pool = mix(vec3(0.18, 0.29, 0.30),
  vec3(0.36, 0.54, 0.58), depth);
 vec3 color = mix(pool, vec3(0.48, 0.66, 0.68), rim * 0.70);
 color = mix(color, vec3(0.88, 0.96, 0.98), glint * 0.65);
 float alpha = coverage * (0.42 + depth * 0.16
  + rim * 0.18 + glint * 0.12);
 COLOR = vec4(color * puddle_tint.rgb,
  clamp(alpha, 0.0, 0.88) * puddle_tint.a);
}
