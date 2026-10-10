shader_type canvas_item;
render_mode unshaded;

// Static removal of the white painted floor under original idle boots.
// No walk deformation: true walk/run sequences use six atlas poses.
void fragment() {
    vec4 texel = texture(TEXTURE, UV);
    vec2 pixel = UV / TEXTURE_PIXEL_SIZE;
    float neutral = 1.0 - smoothstep(0.10, 0.25,
        max(texel.r, max(texel.g, texel.b)) - min(texel.r, min(texel.g, texel.b)));
    float near_white = smoothstep(0.72, 0.91, min(texel.r, min(texel.g, texel.b)));
    float floor_band = smoothstep(572.0, 594.0, pixel.y);
    float unwanted_floor = floor_band * near_white * neutral;
    texel.a *= (1.0 - unwanted_floor);
    COLOR = texel;
}
