shader_type canvas_item;
render_mode blend_mix, unshaded;

// Transparent moving highlights over the *single painted background*.
// Mesh is restricted to water-only polygons, away from bridge and buildings.
// Unlike a duplicated alpha water atlas, the base RGB remains untouched.
uniform float flow_speed : hint_range(0.0, 3.0) = 0.65;
uniform float current_strength : hint_range(0.0, 0.6) = 0.26;
uniform float foam_strength : hint_range(0.0, 0.6) = 0.15;
uniform float phase_offset = 0.0;
void fragment() {
 vec2 world = UV * vec2(1672.0, 941.0);
 float tick = TIME * flow_speed + phase_offset;
 float lane = world.x * 0.078 + world.y * 0.045 - tick * 2.7;
 float ripple1 = pow(max(0.0, sin(lane + 0.43 * sin(world.y * 0.031 - tick))), 12.0);
 float ripple2 = pow(max(0.0, sin(world.x * 0.037 - world.y * 0.064 - tick * 1.25)), 16.0);
 float foam = pow(max(0.0, sin(world.x * 0.105 + world.y * 0.093 - tick * 4.1)), 23.0);
 float alpha = (ripple1 * 0.58 + ripple2 * 0.42) * current_strength;
 alpha += foam * foam_strength * 0.35;
 float cool = 0.7 + 0.3 * sin(tick * 0.7 + world.x * 0.012);
 COLOR = vec4(vec3(0.66, 0.89, 1.0) * cool, clamp(alpha, 0.0, 0.40));
}
