shader_type canvas_item;
render_mode blend_mix, unshaded;

// Continuous painted-water translation, NOT a stationary image with flicker.
// A broad polygon covers the river; cyan-pixel gating protects stone/wood/soil.
uniform sampler2D river_behind : hint_screen_texture, repeat_disable, filter_linear;
uniform vec2 flow_direction = vec2(-0.84, 0.54);
uniform float flow_speed : hint_range(0.0, 3.0) = 0.84;
uniform float current_strength : hint_range(0.0, 1.5) = 0.86;
uniform float foam_strength : hint_range(0.0, 1.5) = 0.44;
uniform float phase_offset = 0.0;
uniform float rain_visibility = 0.0;

float is_painted_water(vec3 rgb) {
 // Painted water is cyan/blue: B is clearly above R and near G.
 // Warm soil, grey rocks, grass and wooden bridge fail this test.
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
 // Restore the approved long-distance downstream travel. Smooth the
 // two sampling phases around both reset points so the texture does not pop.
 float cycle = fract(time_flow * 0.23);
 float cycle_alt = fract(cycle + 0.5);
 float blend_alt = smoothstep(0.0, 1.0, abs(cycle * 2.0 - 1.0));
 vec2 offset_a = direction * (cycle * 46.0) * SCREEN_PIXEL_SIZE;
 vec2 offset_b = direction * (cycle_alt * 46.0) * SCREEN_PIXEL_SIZE;
 vec3 sample_a = texture(river_behind, clamp(
  SCREEN_UV - offset_a, vec2(0.001), vec2(0.999))).rgb;
 vec3 sample_b = texture(river_behind, clamp(
  SCREEN_UV - offset_b, vec2(0.001), vec2(0.999))).rgb;
 // Prevent pulling riverbank colors into the flowing surface at mask edges.
 sample_a = mix(still, sample_a, is_painted_water(sample_a));
 sample_b = mix(still, sample_b, is_painted_water(sample_b));
 vec3 traveling_paint = mix(sample_a, sample_b, blend_alt);
 float flow_mix = clamp(current_strength * 0.88, 0.0, 0.98);
 vec3 moving_water = mix(still, traveling_paint, flow_mix);

 // Narrow, advected whitewater veins move DOWNSTREAM on the same vector.
 // Constant speed and high spatial persistence prevent all-over blinking.
 float meander = sin(across * 0.046 + sin(along * 0.011) * 1.1);
 float crest1 = sin(along * 0.089 - time_flow * 2.25 + meander);
 float crest2 = sin(along * 0.148 - time_flow * 3.25 + across * 0.025);
 float lane = 0.55 + 0.45 * sin(across * 0.056 - 0.35 * meander);
 float streaks = smoothstep(0.30, 0.90, crest1) * lane;
 float bubbles = smoothstep(0.56, 0.98, crest2) * (1.0 - lane * 0.45);
 float crests = clamp(streaks * 0.65 + bubbles * foam_strength * 0.62, 0.0, 1.0);
 vec3 foam_tint = vec3(0.74, 0.89, 0.92);
 // Brighter traveling water streaks survive the heavy-rain darkening pass.
 float crest_contrast = mix(0.43, 0.62, rain_visibility);
 moving_water = mix(moving_water, foam_tint, crests * crest_contrast);
 // Alpha is FIXED at each water-colored pixel; only texture travels.
 COLOR = vec4(moving_water, water_mask * 0.97);
}
