shader_type canvas_item;
render_mode blend_mix, unshaded;

// Water-only channel drawn below the original PSD bridge.
// The authored paint is never displaced: only advected ripples and foam move.
// This prevents the former two-phase sampling reset from dragging wooden planks.
uniform sampler2D river_behind : hint_screen_texture, repeat_disable, filter_linear;
uniform vec2 flow_direction = vec2(-0.84, 0.54);
uniform float flow_speed : hint_range(0.0, 3.0) = 0.84;
uniform float current_strength : hint_range(0.0, 1.5) = 0.86;
uniform float foam_strength : hint_range(0.0, 1.5) = 0.44;
uniform float phase_offset = 0.0;
uniform float rain_visibility = 0.0;

float is_painted_water(vec3 rgb) {
    // Stable painted-water key. NEVER widen it when weather changes:
    // storm grading is composed by a later CanvasLayer.
    float blue = smoothstep(0.050, 0.125, rgb.b - rgb.r);
    float not_green = 1.0 - smoothstep(0.018, 0.105, rgb.g - rgb.b);
    return blue * not_green;
}

void fragment() {
    vec3 painted = texture(river_behind, SCREEN_UV).rgb;
    float water_mask = is_painted_water(painted);

    vec2 downstream = normalize(flow_direction);
    vec2 sideways = vec2(-downstream.y, downstream.x);
    vec2 world = UV * vec2(1672.0, 941.0);
    float along = dot(world, downstream);
    float across = dot(world, sideways);

    // A continuous world-space downstream displacement, with NO fract()
    // phase reset and NO sampling translated shore/bridge screen pixels.
    float travel = along - (TIME * flow_speed + phase_offset) * 24.0;
    float meander = 0.70 * sin(across * 0.035 + sin(along * 0.011));
    float broad = 0.5 + 0.5 * sin(travel * 0.052 + across * 0.016 + meander);
    float fine = 0.5 + 0.5 * sin(travel * 0.113 - across * 0.040);
    float body_gain = 0.945 + 0.085 * broad + 0.021 * fine;
    vec3 moving_water = mix(painted, painted * body_gain,
        clamp(current_strength * 0.88, 0.0, 1.0));

    // Both crest frequencies travel with exactly the SAME velocity, so
    // they remain spatially coherent rather than flashing against each other.
    float crest1 = sin(travel * 0.089 + meander);
    float crest2 = sin(travel * 0.148 + across * 0.025);
    float lane = 0.55 + 0.45 * sin(across * 0.056 - 0.35 * meander);
    float streaks = smoothstep(0.45, 0.96, crest1) * lane;
    float bubbles = smoothstep(0.77, 0.99, crest2) * (1.0 - lane * 0.45);
    float crests = clamp(streaks * 0.62 + bubbles * foam_strength * 0.50, 0.0, 1.0);
    float crest_contrast = mix(0.24, 0.40, clamp(rain_visibility, 0.0, 1.0));
    moving_water = mix(moving_water, vec3(0.70, 0.85, 0.89),
        crests * crest_contrast * clamp(current_strength, 0.0, 1.0));

    // Constant alpha border at each water pixel: riverbanks and bridge
    // never join the animation even during heavy rain or lightning.
    COLOR = vec4(moving_water, water_mask * 0.97);
}
