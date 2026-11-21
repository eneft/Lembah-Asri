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


test('trunk has length-scaled UVs, repeated bark sampler and dark roots', () => {
  const bytes=readFileSync(fileURLToPath(new URL(
    '../public/models/environment/pohon_rimbun_shade.glb',import.meta.url
  )));
  const size=bytes.readUInt32LE(12);
  const gltf=JSON.parse(bytes.subarray(20,20+size).toString('utf8'));
  const bin=20+size+8;
  assert.equal(gltf.meshes[0].extras.barkUV,'world-length-repeat');
  assert.equal(gltf.meshes[0].extras.barkAtlasSize,512);
  assert.equal(gltf.samplers[0].wrapS,10497,'repeat around trunk');
  assert.equal(gltf.samplers[0].wrapT,10497,'repeat vertically');
  assert.equal(gltf.samplers[1].wrapS,33071,'alpha leaf atlas remains clamped');
  assert.equal(gltf.textures[0].sampler,0);
  assert.equal(gltf.textures[1].sampler,1);
  const attributes=gltf.meshes[0].primitives[0].attributes;
  assert.ok(attributes.COLOR_0!==undefined,'vertex color for roots');
  const uv=gltf.accessors[attributes.TEXCOORD_0];
  const uvView=gltf.bufferViews[uv.bufferView];
  const uvBytes=bytes.subarray(bin+uvView.byteOffset,bin+uvView.byteOffset+uvView.byteLength);
  let maxV=-Infinity;
  for(let i=0;i<uv.count;i++)maxV=Math.max(maxV,uvBytes.readFloatLE(i*8+4));
  assert.ok(maxV>1.5,'grain spans multiple texel periods on long trunk');
  const color=gltf.accessors[attributes.COLOR_0];
  const view=gltf.bufferViews[color.bufferView];
  const colorBytes=bytes.subarray(bin+view.byteOffset,bin+view.byteOffset+view.byteLength);
  assert.equal(color.count,gltf.accessors[attributes.POSITION].count);
  let minShade=Infinity,maxShade=-Infinity;
  for(let i=0;i<color.count;i++){
    const shade=colorBytes.readFloatLE(i*12);
    minShade=Math.min(minShade,shade);
    maxShade=Math.max(maxShade,shade);
  }
  assert.ok(minShade<.90,'root gently darkened');
  assert.ok(maxShade>.98,'upper bark stays clear');
});

test('embedded bark PNG has readable wood grain, knots and seamless repeat', () => {
  const bytes=readFileSync(fileURLToPath(new URL(
    '../public/models/environment/pohon_rimbun_shade.glb',import.meta.url
  )));
  const length=bytes.readUInt32LE(12);
  const gltf=JSON.parse(bytes.subarray(20,20+length).toString('utf8'));
  const bin=20+length+8;
  const view=gltf.bufferViews[gltf.images[0].bufferView];
  const png=bytes.subarray(bin+view.byteOffset,bin+view.byteOffset+view.byteLength);
  assert.equal(png.readUInt32BE(16),512);
  assert.equal(png.readUInt32BE(20),512);
  const chunks=[];let offset=8;
  while(offset<png.length){
    const n=png.readUInt32BE(offset),type=png.subarray(offset+4,offset+8).toString();
    if(type==='IDAT')chunks.push(png.subarray(offset+8,offset+8+n));
    offset+=n+12;
    if(type==='IEND')break;
  }
  const rgba=inflateSync(Buffer.concat(chunks));
  const stride=512*4+1;
  const sample=(x,y,channel=0)=>rgba[y*stride+1+x*4+channel];
  const row=[];
  for(let x=0;x<512;x+=7)row.push(sample(x,225));
  assert.ok(Math.max(...row)-Math.min(...row)>25,'visible fissure and paint contrast');
  assert.ok(Math.abs(sample(0,225)-sample(511,225))<13,'no horizontal seam');
  assert.ok(Math.abs(sample(140,0)-sample(140,511))<13,'no vertical repeat seam');
  assert.equal(sample(100,150,3),255,'solid, non-plastic painted bark');
});
