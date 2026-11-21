import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dirs = ['shade','orchard'];
for (const kind of dirs) {
  test(kind + ' tree is a REAL textured 3D GLB with thick alpha leaf canopy', () => {
    const data = readFileSync(fileURLToPath(new URL(
      '../public/models/environment/pohon_rimbun_' + kind + '.glb', import.meta.url
    )));
    assert.ok(data.length > 50_000 && data.length < 1_500_000);
    assert.equal(data.subarray(0,4).toString(), 'glTF');
    assert.equal(data.readUInt32LE(4), 2);
    assert.equal(data.readUInt32LE(8), data.length);
    const jsonLength = data.readUInt32LE(12);
    const json = JSON.parse(data.subarray(20,20+jsonLength).toString('utf8'));
    const binaryStart = 20 + jsonLength + 8;
    assert.equal(json.meshes.length, 2);
    assert.equal(json.images.length, 2);
    assert.equal(json.materials[1].alphaMode, 'MASK');
    assert.equal(json.materials[1].doubleSided, true);
    assert.ok(json.materials[1].alphaCutoff >= 0.4);
    assert.equal(json.materials[0].pbrMetallicRoughness.baseColorTexture.index, 0);
    const crown = json.meshes[1].primitives[0];
    assert.ok(crown.attributes.POSITION !== undefined);
    assert.ok(crown.attributes.TEXCOORD_0 !== undefined);
    const vertices = json.accessors[crown.attributes.POSITION];
    const triangles = json.accessors[crown.indices].count / 3;
    assert.ok(vertices.count >= 3000 && vertices.count < 7000);
    assert.ok(triangles >= 2700 && triangles < 5000);
    assert.ok(vertices.max[0]-vertices.min[0] > 3.5);
    assert.ok(vertices.max[2]-vertices.min[2] > 3.5);
    assert.ok(vertices.max[1]-vertices.min[1] > 2, 'deep crown from top to underside');
    assert.equal(json.meshes[1].extras.canopyLobes, 9, 'asymmetric cluster volumes, not a single round shell');
    assert.match(json.meshes[1].extras.canopyStyle, /asymmetric-overlapping-lobes/);
    assert.ok(json.meshes[1].extras.leafCards >= 320 && json.meshes[1].extras.leafCards <= 420);
    assert.ok(json.accessors[crown.indices].count / 3 <= 3800, 'mobile-safe triangle budget');
    assert.equal(json.materials[1].alphaMode, 'MASK');
    assert.ok(!json.materials[1].alphaHash, 'never use stippled transparency');
    const view = json.bufferViews[json.images[1].bufferView];
    const offset = binaryStart + view.byteOffset;
    const png = data.subarray(offset, offset + view.byteLength);
    assert.equal(png.subarray(1,4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 512);
    assert.equal(png.readUInt32BE(20), 512);
    const idat = [];let p = 8;
    while (p < png.length) {
      const n = png.readUInt32BE(p);const type = png.subarray(p+4,p+8).toString();
      if (type === 'IDAT') idat.push(png.subarray(p+8,p+8+n));
      p += 12+n;
      if (type === 'IEND') break;
    }
    const pixels = inflateSync(Buffer.concat(idat));
    const alpha = [];
    const sampleGreen = [];
    const stride = 512 * 4 + 1; // each PNG scanline starts with one filter byte
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const i = y * stride + 1 + x * 4;
        alpha.push(pixels[i + 3]);
        if (pixels[i + 3] > 180) sampleGreen.push(pixels[i + 1]);
      }
    }
    const meanGreen = sampleGreen.reduce((a,b)=>a+b,0) / sampleGreen.length;
    assert.ok(meanGreen > 118, 'foliage should not be overly dark on mobile');
    assert.ok(meanGreen < 195, 'avoid washed-out neon lime leaf patches');
    assert.ok(alpha.some(a => a === 0), 'transparent gaps between leaf sprites');
    assert.ok(alpha.some(a => a >= 230), 'opaque hand-painted leaves');
  });
}
test('both models generated deterministically from local tool (no CDN)', () => {
  const script = readFileSync(fileURLToPath(new URL('../scripts/build-painted-trees.mjs',import.meta.url)), 'utf8');
  assert.match(script,/alphaMode:'MASK'/);
  assert.doesNotMatch(script,/https?:\/\//);
});
