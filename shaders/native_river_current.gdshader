shader_type canvas_item;
render_mode blend_mix, unshaded;

// Flow runs along the water course, not a single time-based flicker.
// Water stays confined to the original shoreline polygons / bridge cutout.
uniform vec2 flow_direction = vec2(-0.82, 0.57);
uniform float flow_speed : hint_range(0.0, 3.0) = 0.95;
uniform float current_strength : hint_range(0.0, 1.0) = 0.48;
uniform float foam_strength : hint_range(0.0, 1.0) = 0.28;
uniform float phase_offset = 0.0;
void fragment() {
 vec2 world = UV * vec2(1672.0, 941.0);
 vec2 dir = normalize(flow_direction);
 vec2 cross_dir = vec2(-dir.y, dir.x);
 float along = dot(world, dir);
 float across = dot(world, cross_dir);
 float tick = TIME * flow_speed + phase_offset;
 // Three advected patterns: continuously traveling wave crests, parallel
 // slow water lanes, and small drifting foam flecks.
 float bend = sin(across * 0.055 + sin(along * 0.022) * 0.7);
 float crest = sin(along * 0.116 - tick * 3.80 + bend * 0.95);
 float wave = smoothstep(0.65, 0.96, crest);
 float lane = sin(across * 0.074 + 0.8 * sin(along * 0.032 - tick * 1.15));
 float threading = smoothstep(0.35, 0.92, lane);
 float fleck = sin(along * 0.185 - tick * 5.1 + sin(across * 0.14) * 2.0);
 float foam = smoothstep(0.80, 0.99, fleck) * threading;
 float trail = wave * (0.55 + 0.45 * threading);
 float alpha = 0.018 + trail * current_strength * 0.31
  + threading * current_strength * 0.075
  + foam * foam_strength * 0.22;
 vec3 color = mix(vec3(0.38, 0.66, 0.71),
  vec3(0.79, 0.95, 0.97), clamp(trail * 0.65 + foam * 0.45, 0.0, 1.0));
 COLOR = vec4(color, clamp(alpha, 0.0, 0.56));
}
