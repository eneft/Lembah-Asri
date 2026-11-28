import * as THREE from 'three';

/**
 * Stage 5 – one daylight art direction for the full childhood-home world.
 *
 * Authored UV brushwork stays authoritative: every painted MeshBasicMaterial
 * remains unlit/toneMapped=false. We only soften the *PBR response* (house,
 * bamboo) and the real-time shadows that sit over the painted world.
 * No screen-space post-process, toon rendering, new shader pass or draw call.
 */
export const LEMBAH_DAYLIGHT = Object.freeze({
  version: 'lembah-painterly-daylight-stage5-v1',
  sky: '#b5d8df',
  distantMist: '#b8c9ab',
  fogNear: 64,
  fogFar: 190,
  sunColor: '#fff0d9',
  sunIntensity: 1.55,
  hemisphereSky: '#eaf3ec',
  hemisphereGround: '#96866e',
  hemisphereIntensity: 1.1,
  fillColor: '#d5e8e8',
  fillIntensity: 0.3,
  environmentIntensity: 0.3,
  exposure: 1.0,
  pbrRoughnessFloor: 0.82,
  pbrNormalStrengthMax: 0.62,
  pbrMetalnessMax: 0.22,
  pbrEnvironmentIntensityMax: 0.3,
  shadowOpacity: 0.43,
  contactShadowOpacity: 0.35
});

/** Home-only warm morning grade. Preserve the legacy rig, baked albedo,
 * Neutral tone mapping, existing shadow maps and all authored materials. */
export const HOME_WARM_MORNING = Object.freeze({
  version:'home-warm-morning-v1',
  sky:'#c8dfe5',
  sunColor:'#f6d9a6',
  sunIntensity:1.18,
  hemisphereSky:'#e5f0f5',
  hemisphereGround:'#a19479',
  hemisphereIntensity:1.26,
  fillColor:'#fff0d8',
  fillIntensity:.32,
  environmentIntensity:.24,
  exposure:1,
  shadowColor:'#796b53',
  shadowOpacity:.24,
  contactShadowOpacity:.30
});

/** Adjust the already installed single lighting rig, never add another sun. */
export function applyHomeWarmMorning(
  scene:THREE.Scene, renderer:THREE.WebGLRenderer, sun:THREE.DirectionalLight,
  hemisphere:THREE.HemisphereLight,fill:THREE.DirectionalLight
):void {
  const p=HOME_WARM_MORNING;
  renderer.toneMappingExposure=p.exposure;
  scene.background=new THREE.Color(p.sky);
  if(scene.fog instanceof THREE.Fog)scene.fog.color.set(p.sky);
  scene.environmentIntensity=p.environmentIntensity;
  sun.color.set(p.sunColor);sun.intensity=p.sunIntensity;
  hemisphere.color.set(p.hemisphereSky);hemisphere.groundColor.set(p.hemisphereGround);
  hemisphere.intensity=p.hemisphereIntensity;
  fill.color.set(p.fillColor);fill.intensity=p.fillIntensity;
  scene.userData.painterlyLightingStyle=p.version;
}

/** Scene color management stays explicit in linear lighting / sRGB output. */
export function applyLembahDaylight(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  sun: THREE.DirectionalLight,
  hemisphere: THREE.HemisphereLight,
  fill: THREE.DirectionalLight
): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = LEMBAH_DAYLIGHT.exposure;

  scene.background = new THREE.Color(LEMBAH_DAYLIGHT.sky);
  scene.fog = new THREE.Fog(
    LEMBAH_DAYLIGHT.distantMist,
    LEMBAH_DAYLIGHT.fogNear,
    LEMBAH_DAYLIGHT.fogFar
  );
  scene.environmentIntensity = LEMBAH_DAYLIGHT.environmentIntensity;
  scene.userData.painterlyLightingStyle = LEMBAH_DAYLIGHT.version;

  sun.color.set(LEMBAH_DAYLIGHT.sunColor);
  sun.intensity = LEMBAH_DAYLIGHT.sunIntensity;
  hemisphere.color.set(LEMBAH_DAYLIGHT.hemisphereSky);
  hemisphere.groundColor.set(LEMBAH_DAYLIGHT.hemisphereGround);
  hemisphere.intensity = LEMBAH_DAYLIGHT.hemisphereIntensity;
  fill.color.set(LEMBAH_DAYLIGHT.fillColor);
  fill.intensity = LEMBAH_DAYLIGHT.fillIntensity;
}

/**
 * Attenuate exaggerated highlights on painted real-3D PBR objects.
 * Keep the ORIGINAL map, normalMap, roughnessMap, metalnessMap, UV,
 * material class and geometric normals. This never converts to unlit.
 */
export function softenPaintedPBR(
  material: THREE.MeshStandardMaterial,
  identity: 'house' | 'bamboo'
): void {
  if (material.userData.painterlyPBR === LEMBAH_DAYLIGHT.version) return;

  material.roughness = Math.max(material.roughness, LEMBAH_DAYLIGHT.pbrRoughnessFloor);
  material.metalness = Math.min(material.metalness, LEMBAH_DAYLIGHT.pbrMetalnessMax);
  material.normalScale.set(
    Math.sign(material.normalScale.x) *
      Math.min(Math.abs(material.normalScale.x), LEMBAH_DAYLIGHT.pbrNormalStrengthMax),
    Math.sign(material.normalScale.y) *
      Math.min(Math.abs(material.normalScale.y), LEMBAH_DAYLIGHT.pbrNormalStrengthMax)
  );
  material.envMapIntensity = Math.min(
    material.envMapIntensity, LEMBAH_DAYLIGHT.pbrEnvironmentIntensityMax
  );
  material.userData.painterlyPBR = LEMBAH_DAYLIGHT.version;
  material.userData.painterlyPBRIdentity = identity;
  material.needsUpdate = true;
}
