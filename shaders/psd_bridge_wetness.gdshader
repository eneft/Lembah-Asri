shader_type canvas_item;
render_mode blend_mix, unshaded;

// Applied ONLY to the authentic 05_bridge.png Sprite2D. The bridge remains
// immobile; separate world-space water/current shaders run beneath it.
uniform float wetness : hint_range(0.0, 1.0) = 0.0;
uniform float rain_intensity : hint_range(0.0, 1.0) = 0.0;

float bridge_hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void fragment() {
    vec4 wood = texture(TEXTURE, UV);
    float amount = clamp(wetness, 0.0, 1.0);
    // Dampened, slightly darker wood with restrained cool-sky sheen.
    vec3 soaked = wood.rgb * vec3(0.51, 0.59, 0.68) + vec3(0.015, 0.019, 0.025);
    vec3 result = mix(wood.rgb, soaked, amount * 0.95);
    // Restrained sky sheen across wet wood, no vertex movement.
    float sheen = pow(max(0.0,sin(UV.y*95.0 + UV.x*10.0)),14.0);
    result += vec3(0.035,0.046,0.057)*sheen*amount;

    // Sparse short-lived rain contact rings ON bridge pixels, never below.
    // UV-anchored pattern stays stable when Camera2D pans or zooms.
    vec2 point = UV * vec2(30.0, 19.0);
    vec2 cell = floor(point);
    vec2 local = (fract(point) - vec2(0.5)) * vec2(1.0, 1.45);
    float seed = bridge_hash(cell);
    float age = fract(TIME * 0.86 + seed);
    float radius = mix(0.025, 0.21, age);
    float ring = 1.0 - smoothstep(0.025, 0.067, abs(length(local) - radius));
    float contact = ring * (1.0 - age) * step(0.77, seed) * rain_intensity;
    result += vec3(0.075, 0.088, 0.10) * contact * wood.a;
    COLOR = vec4(result, wood.a);
}
