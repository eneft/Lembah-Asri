shader_type canvas_item;
render_mode blend_mix, unshaded;

// Steady downstream motion with NO wrap/reset/cross-fade of the painted image.
// The earlier fract() samples returned to their origin every few seconds,
// producing a conspicuous brightness pulse on mobile.
// Continuous travelling phase only deforms the river locally (max ~8 pixels).
uniform sampler2D river_behind : hint_screen_texture, repeat_disable, filter_linear;
uniform vec2 flow_direction = vec2(-0.84, 0.54);
uniform float flow_speed : hint_range(0.0, 3.0) = 0.84;
uniform float current_strength : hint_range(0.0, 1.5) = 0.86;
uniform float foam_strength : hint_range(0.0, 1.5) = 0.44;
uniform float phase_offset = 0.0;
uniform float rain_visibility = 0.0;

float is_painted_water(vec3 rgb) {
 float blue = smoothstep(0.050, 0.125, rgb.b - rgb.r);
 float not_green = 1.0 - smoothstep(0.018, 0.105, rgb.g - rgb.b);
 return blue * not_green;
}

void fragment() {
 vec2 direction = normalize(flow_direction);
 vec2 sideways = vec2(-direction.y, direction.x);
 vec3 still = texture(river_behind, SCREEN_UV).rgb;
 float water_mask = is_painted_water(still);
 vec2 world = UV * vec2(1672.0, 941.0);
 float along = dot(world, direction);
 float across = dot(world, sideways);
 float time_flow = TIME * flow_speed + phase_offset;

 // The phase travels downstream with time. There is no fract() discontinuity
 // and no cyclic re-seeding. Small local refraction keeps shoreline detail
 // from jumping while the flowing painted highlights remain recognizable.
 float meander = sin(across * 0.038 + sin(along * 0.011) * 0.90);
 float advect1 = sin(along * 0.035 - time_flow * 1.18 + meander);
 float advect2 = sin(along * 0.072 - time_flow * 1.85 - across * 0.014);
 float skew = sin(along * 0.046 - time_flow * 1.35 + across * 0.031);
 vec2 travel_pixels = direction * (3.2 + 2.8 * advect1 + 1.2 * advect2)
  + sideways * (0.70 * skew);
 vec3 displaced = texture(river_behind, clamp(
  SCREEN_UV - travel_pixels * SCREEN_PIXEL_SIZE,
  vec2(0.001), vec2(0.999))).rgb;
 // Keep the color-key mask stable, and never reveal moving bank/bridge pixels.
 float safe_displacement = is_painted_water(displaced);
 float body_strength = min(current_strength * 0.80, 0.96);
 vec3 moving_water = mix(still, displaced,
  body_strength * safe_displacement);

 // Soft, broad, coherent crest trains: *motion* without isolated strobing.
 float crest_a = 0.5 + 0.5 * sin(
  along * 0.087 - time_flow * 1.72 + meander * 0.85);
 float crest_b = 0.5 + 0.5 * sin(
  along * 0.128 - time_flow * 2.16 + across * 0.019);
 float lane = 0.52 + 0.48 * (0.5 + 0.5 * sin(
  across * 0.051 + sin(along * 0.019 - time_flow * 0.26)));
 float wave = smoothstep(0.44, 0.89, crest_a) * lane;
 float foam = smoothstep(0.60, 0.94, crest_b)
  * (0.42 + 0.58 * lane);
 float crest = clamp(wave * 0.61 + foam * foam_strength * 0.30,
  0.0, 1.0);
 // Keep enough texture contrast in rain, but avoid white flashes.
 float softness = mix(0.34, 0.46, rain_visibility);
 moving_water = mix(moving_water, vec3(0.70, 0.88, 0.91),
  crest * softness);
 // The surface mask/opacity is fixed per pixel throughout the animation.
 COLOR = vec4(moving_water, water_mask * 0.97);
}
