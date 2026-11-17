import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createNaturalEarthAlbedo, sampleEarthPigment } from '../src/world/naturalEarth.ts';
import { scatterLowPolyGrass, isGrassAllowed, makeLowPolyGrassGeometry } from '../src/world/lowPolyGrass.ts';
import { terrainTileRepeat } from '../src/world/terrainMaterials.ts';

test('natural pigment ground has no short-period ornamental source texture', () => {
  const code = readFileSync(new URL('../src/world/terrainMaterials.ts', import.meta.url), 'utf8');
  assert.match(code, /createNaturalEarthAlbedo\(\)/);
  assert.doesNotMatch(code, /loadAsync\(['"]\.\/models\/environment\/earth_path\.png/);
  for (const type of ['earth', 'path', 'soil', 'plaza']) {
    const uv = terrainTileRepeat(type, 42, 42);
    assert.deepEqual(uv, { x: 1, y: 1 });
  }
});

test('deterministic earth pigment varies naturally and wraps without visible seams', () => {
  const texture = createNaturalEarthAlbedo(128);
  assert.ok(texture instanceof THREE.DataTexture);
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  assert.equal(texture.generateMipmaps, true);
  assert.equal(texture.wrapS, THREE.RepeatWrapping);
  assert.equal(texture.wrapT, THREE.RepeatWrapping);
  assert.equal(texture.image.width, 128);
  assert.equal(texture.image.data.length, 128 * 128 * 4);
  const data = texture.image.data;
  const pixels = [0, 3200, 9000, 13000, 16000].map(i => Array.from(data.slice(i * 4, i * 4 + 3)));
  assert.ok(new Set(pixels.map(c => c.join(','))).size >= 4, 'organic dirt needs subtle pigment variation');
  const seamU0 = sampleEarthPigment(0, 0.34);
  const seamU1 = sampleEarthPigment(1, 0.34);
  const seamV0 = sampleEarthPigment(0.41, 0);
  const seamV1 = sampleEarthPigment(0.41, 1);
  assert.ok(seamU0.every((v, i) => Math.abs(v - seamU1[i]) < 0.01));
  assert.ok(seamV0.every((v, i) => Math.abs(v - seamV1[i]) < 0.01));
  assert.ok(data[0] > data[2] && data[1] > data[2], 'warm earth, not green paving');
  assert.ok(data.every((v, i) => i % 4 === 3 || (v > 80 && v < 220)));
  assert.throws(() => createNaturalEarthAlbedo(12));
  assert.throws(() => createNaturalEarthAlbedo(3000));
});

test('phone screenshot correction: keep central dirt yard clear and grass clumped', () => {
  const grass = scatterLowPolyGrass();
  assert.ok(grass.length > 200 && grass.length < 1800);
  assert.ok(grass.every(p => isGrassAllowed(p.x, p.z)));
  const middle = grass.filter(p => p.x > -42.2 && p.x < -16 && p.z > -10 && p.z < 13);
  assert.equal(middle.length, 0);
  assert.ok(grass.some(p => p.x < -22 && p.x > -44 && (p.z > 12 || p.z < -10)));
  // A clustered distribution produces multiple tufts within 1 metre.
  const groups = grass.filter(p =>
    grass.some(q => q !== p && Math.hypot(p.x - q.x, p.z - q.z) < 0.8)
  );
  assert.ok(groups.length > grass.length * 0.6);
  const geometry = makeLowPolyGrassGeometry();
  assert.ok(geometry.boundingSphere.radius < 0.4);
});
