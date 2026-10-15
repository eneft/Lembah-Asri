shader_type canvas_item;
render_mode blend_mix, unshaded;
uniform vec4 shadow_tint : source_color = vec4(0.055, 0.060, 0.064, 1.0);
uniform float shadow_opacity : hint_range(0.0, 0.7) = 0.22;
uniform float blur_texels : hint_range(0.0, 4.0) = 1.5;
void fragment() {
 vec2 px = TEXTURE_PIXEL_SIZE * blur_texels;
 float a = texture(TEXTURE, UV).a;
 float soft_a = texture(TEXTURE, UV + vec2(px.x, 0.0)).a;
 soft_a += texture(TEXTURE, UV - vec2(px.x, 0.0)).a;
 soft_a += texture(TEXTURE, UV + vec2(0.0, px.y)).a;
 soft_a += texture(TEXTURE, UV - vec2(0.0, px.y)).a;
 float softened = mix(a, soft_a * 0.25, 0.43);
 COLOR = vec4(shadow_tint.rgb, shadow_opacity * smoothstep(0.01, 0.90, softened));
}
