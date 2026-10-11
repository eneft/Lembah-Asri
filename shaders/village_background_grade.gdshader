shader_type canvas_item;
render_mode unshaded;

// Lembah Asri: DOF-style softening only for the visually distant scenery.
// UV.y is an art-directed depth approximation, NOT true 3D depth.
// Keep playable courtyard, paths, stone bridge, and foreground terrain sharp.
// Foreground cutouts/hero/HUD remain separate, unaffected by this material.
uniform float saturation : hint_range(0.5, 1.5) = 0.95;
uniform float contrast : hint_range(0.6, 1.4) = 0.96;
uniform float softness : hint_range(0.0, 2.5) = 0.80;
uniform float distant_start : hint_range(0.0, 1.0) = 0.16;
uniform float distant_end : hint_range(0.0, 1.0) = 0.48;
uniform float warmth : hint_range(0.0, 0.20) = 0.025;

void fragment() {
    vec4 sharp = texture(TEXTURE, UV);
    // Full distance softening in the top part of the hand-painted scene;
    // smoothly disappears by roughly source pixel Y=452 of 941.
    // y >= distant_end: absolutely no blur and neutral saturation/contrast.
    float far_mask = 1.0 - smoothstep(distant_start, distant_end, UV.y);

    // Avoid four extra texture taps in the most frequently visible
    // gameplay/foreground region on mobile GPUs.
    vec4 soft = sharp;
    if (far_mask > 0.001 && softness > 0.001) {
        vec2 step_uv = TEXTURE_PIXEL_SIZE * softness;
        soft = sharp * 0.52;
        soft += texture(TEXTURE, clamp(UV + vec2(step_uv.x, 0.0), vec2(0.0), vec2(1.0))) * 0.12;
        soft += texture(TEXTURE, clamp(UV - vec2(step_uv.x, 0.0), vec2(0.0), vec2(1.0))) * 0.12;
        soft += texture(TEXTURE, clamp(UV + vec2(0.0, step_uv.y), vec2(0.0), vec2(1.0))) * 0.12;
        soft += texture(TEXTURE, clamp(UV - vec2(0.0, step_uv.y), vec2(0.0), vec2(1.0))) * 0.12;
    }

    vec4 texel = mix(sharp, soft, far_mask);
    float gray = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
    float local_saturation = mix(1.0, saturation, far_mask);
    float local_contrast = mix(1.0, contrast, far_mask);
    vec3 result = mix(vec3(gray), texel.rgb, local_saturation);
    result = (result - vec3(0.5)) * local_contrast + vec3(0.5);
    result += vec3(0.65, 0.42, 0.14) * warmth
        * far_mask * smoothstep(0.35, 0.87, gray);

    COLOR = vec4(clamp(result, vec3(0.0), vec3(1.0)), sharp.a);
}
