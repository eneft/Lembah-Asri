shader_type canvas_item;
render_mode blend_mix, unshaded;
// Real downstream translation instead of uniformly flashing brightness.
// Sample and slightly refract the painted river within fixed water polygons.
uniform sampler2D river_behind : hint_screen_texture, repeat_disable, filter_linear;
uniform vec2 flow_direction = vec2(-0.82, 0.57);
uniform float flow_speed : hint_range(0.0, 4.0) = 1.15;
uniform float current_strength : hint_range(0.0, 1.5) = 0.95;
uniform float foam_strength : hint_range(0.0, 1.5) = 0.42;
uniform float phase_offset = 0.0;
void fragment() {
 vec2 world = UV * vec2(1672.0, 941.0);
 vec2 dir = normalize(flow_direction);
 vec2 perpendicular = vec2(-dir.y, dir.x);
 float along = dot(world, dir);
 float across = dot(world, perpendicular);
 float tick = TIME * flow_speed + phase_offset;
 float bend = sin(across * 0.06 + sin(along * 0.021) * 0.90);
 float band1 = sin(along * 0.135 - tick * 4.2 + bend * 1.2);
 float band2 = sin(along * 0.082 - tick * 2.6 - across * 0.03);
 float band3 = sin(along * 0.19 - tick * 5.6 + sin(across * 0.15) * 1.4);
 float wave = smoothstep(0.55, 0.98, band1);
 float broad = smoothstep(0.45, 0.95, band2) * 0.6;
 float foam = smoothstep(0.80, 0.995, band3);
 float lane = 0.65 + 0.35 * sin(across * 0.09
  + sin(along * 0.025 - tick * 0.5));
 float moving = (wave * 0.85 + broad * 0.55) * lane;
 float froth = foam * (0.35 + 0.65 * lane);
 float wobble = sin(across * 0.07 + along * 0.023 - tick * 1.8) * 0.55;
 vec2 offset_px = dir * (0.85 + wobble) * min(current_strength, 1.25);
 vec3 painted = texture(river_behind,
  SCREEN_UV - offset_px * SCREEN_PIXEL_SIZE).rgb;
 vec3 streaks = mix(vec3(0.21, 0.47, 0.53),
  vec3(0.78, 0.95, 0.98), clamp(moving, 0.0, 1.0));
 streaks = mix(streaks, vec3(0.94, 0.99, 1.0), froth * 0.76);
 float blend = clamp(0.10 + moving * current_strength * 0.42
  + froth * foam_strength * 0.24, 0.0, 0.78);
 COLOR = vec4(mix(painted, streaks, blend), 1.0);
}
