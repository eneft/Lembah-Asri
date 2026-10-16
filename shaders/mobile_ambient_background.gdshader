shader_type canvas_item;
render_mode unshaded;

// Only the side margins use this enlarged, soft copy of the existing PSD.
// Nine samples (rather than a large Gaussian kernel) keep WebGL mobile light.
uniform float blur_spread : hint_range(0.0, 0.04) = 0.012;
uniform float dim_strength : hint_range(0.0, 1.0) = 0.24;

void fragment() {
 vec2 d = vec2(blur_spread);
 vec3 blur = texture(TEXTURE, UV).rgb * 0.20;
 blur += texture(TEXTURE, clamp(UV + vec2(d.x, 0.0), vec2(0.0), vec2(1.0))).rgb * 0.12;
 blur += texture(TEXTURE, clamp(UV - vec2(d.x, 0.0), vec2(0.0), vec2(1.0))).rgb * 0.12;
 blur += texture(TEXTURE, clamp(UV + vec2(0.0, d.y), vec2(0.0), vec2(1.0))).rgb * 0.12;
 blur += texture(TEXTURE, clamp(UV - vec2(0.0, d.y), vec2(0.0), vec2(1.0))).rgb * 0.12;
 blur += texture(TEXTURE, clamp(UV + d, vec2(0.0), vec2(1.0))).rgb * 0.08;
 blur += texture(TEXTURE, clamp(UV - d, vec2(0.0), vec2(1.0))).rgb * 0.08;
 blur += texture(TEXTURE, clamp(UV + vec2(d.x, -d.y), vec2(0.0), vec2(1.0))).rgb * 0.08;
 blur += texture(TEXTURE, clamp(UV + vec2(-d.x, d.y), vec2(0.0), vec2(1.0))).rgb * 0.08;
 vec3 muted = mix(blur, vec3(0.13, 0.17, 0.16), dim_strength);
 COLOR = vec4(muted, 1.0);
}
