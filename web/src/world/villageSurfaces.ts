import * as THREE from 'three';
import { applyPaintedPigment } from './paintedPigment.ts';

// Use the village's authored clay, limewash and timber paintings at a consistent scale.
export function villageFinishes(load: (url: string) => THREE.Texture) {
  const surfaces = {
    clay: load(new URL('../../../blockout3d/assets/environment/village/balai_modular/roof_painted.svg', import.meta.url).href),
    plaster: load(new URL('../../../blockout3d/assets/environment/village/balai_modular/plaster_painted.svg', import.meta.url).href),
    timber: load(new URL('../../../blockout3d/assets/environment/village/balai_modular/wood_painted.svg', import.meta.url).href)
  };
  const material = (map: THREE.Texture, color: string, u: number, v: number) => {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(u, v);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return applyPaintedPigment(new THREE.MeshLambertMaterial({ map, color, toneMapped: false }));
  };
  return {
    roof: material(surfaces.clay, '#e1beaa', 5, 2),
    wall: material(surfaces.plaster, '#f2e4cf', 2, 1),
    wood: material(surfaces.timber, '#d5bf99', 1, 1)
  };
}

// Reuse the west creek painting across the width of the village stream.
// A feathered, gently bending margin lets the painted meadow meet the water.
export function villageStream(map: THREE.Texture) {
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapT = THREE.MirroredRepeatWrapping;
  map.anisotropy = 4;
  const geometry = new THREE.PlaneGeometry(48, 2.6, 72, 12);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const colors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const across = uv.getY(i);
    const bend = .25 * Math.sin(x*.49) + .13 * Math.sin(x*1.17);
    positions.setY(i, positions.getY(i) + bend * (.62 + .38*across));
    const edge = Math.min(across, 1-across);
    const alpha = THREE.MathUtils.smoothstep(edge, 0, .14)
      * THREE.MathUtils.smoothstep(24-Math.abs(x), 0, 1.5);
    colors.push(.94, .98, .91, alpha);
    uv.setXY(i, across, x / 6.4);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    map, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false
  }));
  mesh.material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      float bank = 1. - smoothstep(.04,.32,min(vMapUv.x,1.-vMapUv.x));
      float light = dot(diffuseColor.rgb,vec3(.22,.66,.12));
      diffuseColor.rgb = mix(diffuseColor.rgb,light*vec3(.76,1.03,.89),.46);
      diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.22,.25,.13)*(.7+light),bank*.67);
    `);
  };
  mesh.name = 'Painted village stream';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, .052, 17);
  mesh.renderOrder = 4;
  return mesh;
}
