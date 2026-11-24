import * as THREE from 'three';

// Local coordinates keep pigment attached to instanced props and animated meshes.
// Broad broken strokes soften flat surfaces without replacing atlas detail or alpha.
export function applyPaintedPigment<T extends THREE.Material>(material: T): T {
  const previous = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.vertexShader = 'varying vec3 vPaintLocal;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvPaintLocal = position;'
    );
    shader.fragmentShader = 'varying vec3 vPaintLocal;\n' + shader.fragmentShader.replace(
      '#include <opaque_fragment>', `
      {
      float value = dot(outgoingLight, vec3(.2126, .7152, .0722));
      vec3 pigment = mix(vec3(value), outgoingLight, .88);
      float phase = dot(vPaintLocal, vec3(11., 21., 15.));
      float strokes = sin(phase + 1.4 * sin(dot(vPaintLocal, vec3(7., 3., 9.))));
      float fade = 1. - smoothstep(.4, 2., fwidth(phase));
      outgoingLight = pigment * vec3(1.015, 1., .966) * (1. + .032 * strokes * fade);
      }
      #include <opaque_fragment>`
    );
  };
  material.customProgramCacheKey = () => key + '|village-painted-pigment-1';
  return material;
}
