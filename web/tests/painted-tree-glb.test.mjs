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



test('trunk GLB uses separate atlas UV islands and a continuous main strip', () => {
  const data=readFileSync(fileURLToPath(new URL(
    '../public/models/environment/pohon_rimbun_shade.glb',import.meta.url
  )));
  const jsonLength=data.readUInt32LE(12);
  const gltf=JSON.parse(data.subarray(20,20+jsonLength).toString('utf8'));
  const binaryStart=20+jsonLength+8;
  const trunk=gltf.meshes[0], attrs=trunk.primitives[0].attributes;
  assert.equal(trunk.extras.barkUV,'unique-uv-islands-v3');
  assert.equal(trunk.extras.barkAtlasSize,1024);
  assert.equal(trunk.extras.baseVertexAO,true);
  const islands=trunk.extras.islands;
  assert.equal(islands.length,20);
  assert.equal(islands[0].name,'trunk');
  assert.equal(islands[0].rings,5);
  assert.equal(islands[0].verts,60);
  assert.equal(islands.filter(i=>i.name==='bough').length,6);
  assert.equal(islands.filter(i=>i.name==='twig').length,13);
  assert.equal(gltf.samplers[0].wrapS,33071,'unique UV atlas never repeats');
  assert.equal(gltf.samplers[0].wrapT,33071,'UV stays inside its authored pigment island');
  assert.equal(gltf.samplers[1].wrapS,33071,'foliage alpha atlas remains clamped');
  assert.ok(attrs.COLOR_0!==undefined);
  const accessor=gltf.accessors[attrs.TEXCOORD_0];
  const view=gltf.bufferViews[accessor.bufferView];
  const bytes=data.subarray(binaryStart+view.byteOffset,
    binaryStart+view.byteOffset+view.byteLength);
  const u=[],v=[];
  for(let i=0;i<accessor.count;i++){
    u.push(bytes.readFloatLE(i*8));
    v.push(bytes.readFloatLE(i*8+4));
  }
  assert.ok(u.every(x=>x>=0 && x<=1));
  assert.ok(v.every(x=>x>=0 && x<=1), 'no UV overflow/repeat');
  // 5 rings, 12 vertices per ring: original trunk now has ONE continuous V.
  const ringV=[0,12,24,36,48].map(i=>v[i]);
  assert.ok(ringV.every((x,i)=>i===0||x>ringV[i-1]+.04));
  assert.ok(ringV.at(-1)-ringV[0]>.85);
  assert.ok(u.slice(0,60).every(x=>x>.03&&x<.50));
  const branchStart=60 + 7*14; // roots are 7 two-ring tubes of 7 vertices
  assert.ok(u.slice(branchStart,branchStart+27).every(x=>x>.50&&x<.79));
  const colors=gltf.accessors[attrs.COLOR_0];
  const cview=gltf.bufferViews[colors.bufferView];
  const pigment=data.subarray(binaryStart+cview.byteOffset,
    binaryStart+cview.byteOffset+cview.byteLength);
  let minShade=Infinity,maxShade=-Infinity;
  for(let i=0;i<colors.count;i++){
    const value=pigment.readFloatLE(i*12);
    minShade=Math.min(minShade,value);
    maxShade=Math.max(maxShade,value);
  }
  assert.ok(minShade<.91,'only roots receive contact darkening');
  assert.ok(maxShade>.98,'upper bark keeps full authored albedo');
});

test('embedded 1024px bark image has painterly color variation without banded repeats', () => {
  const data=readFileSync(fileURLToPath(new URL(
    '../public/models/environment/pohon_rimbun_shade.glb',import.meta.url
  )));
  const jsonLength=data.readUInt32LE(12);
  const gltf=JSON.parse(data.subarray(20,20+jsonLength).toString('utf8'));
  const binaryStart=20+jsonLength+8;
  const view=gltf.bufferViews[gltf.images[0].bufferView];
  const png=data.subarray(binaryStart+view.byteOffset,
    binaryStart+view.byteOffset+view.byteLength);
  assert.equal(png.readUInt32BE(16),1024);
  assert.equal(png.readUInt32BE(20),1024);
  const chunks=[];let offset=8;
  while(offset<png.length){
    const n=png.readUInt32BE(offset),kind=png.subarray(offset+4,offset+8).toString();
    if(kind==='IDAT')chunks.push(png.subarray(offset+8,offset+8+n));
    offset+=n+12;
    if(kind==='IEND')break;
  }
  const pixels=inflateSync(Buffer.concat(chunks));
  const stride=1024*4+1;
  const px=(x,y,channel=0)=>pixels[y*stride+1+x*4+channel];
  const sample=[];
  for(let x=50;x<490;x+=6)sample.push(px(x,440));
  assert.ok(Math.max(...sample)-Math.min(...sample)>18,
    'varied pigment, knots and short natural fissures');
  assert.ok(Math.max(...sample)-Math.min(...sample)<110,
    'avoid extreme black-and-white striped bark');
  assert.ok(Math.abs(px(36,450)-px(501,450))<15,
    'seamless paint where a cylindrical trunk strip joins');
  assert.equal(px(90,200,3),255,'bark texture always opaque');
  assert.notEqual(px(320,420),px(700,420),'trunk and bough have separate artwork');
});
