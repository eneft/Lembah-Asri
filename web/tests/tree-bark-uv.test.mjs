import test from 'node:test';
import assert from 'node:assert/strict';
import { BARK_ATLAS_SIZE, BARK_UV_ISLANDS, paintBarkUVAtlas,
  addUnwrappedBarkTube } from '../scripts/tree-bark-uv.mjs';

test('painted bark texture has separate UV islands and stable transparent-free albedo', () => {
  assert.equal(BARK_ATLAS_SIZE,1024);
  const p=paintBarkUVAtlas();
  assert.equal(p.length,1024*1024*4);
  const ch=(x,y,c=0)=>p[(y*1024+x)*4+c];
  const art=BARK_UV_ISLANDS;
  assert.ok(art.trunk.x1<art.bough.x0 && art.bough.x1<art.twig.x0);
  assert.ok(Math.abs(ch(art.trunk.x0,445)-ch(art.trunk.x1,445))<15,
    'circumference UV seam shares same painted pigment');
  assert.equal(ch(200,220,3),255);
  assert.notEqual(ch(200,220),ch(720,220),'bough artwork is not trunk copy');
  const changes=new Set();
  for(let x=66;x<480;x+=13) changes.add(ch(x,317));
  assert.ok(changes.size>=10,'varied painted pigment, not uniform stripes');
});

test('actual 3D bark geometry keeps one continuous UV island through trunk joints', () => {
  const mesh={p:[],uv:[],idx:[],colors:[]};
  const points=[[0,0,0],[.03,.9,0],[-.04,1.9,.03],[.05,2.75,0],[0,3.3,0]];
  addUnwrappedBarkTube(mesh,points,[.34,.28,.20,.12,.04],11,'trunk');
  assert.equal(mesh.p.length/3,60);
  assert.equal(mesh.uv.length/2,60);
  assert.equal(mesh.colors.length/3,60);
  assert.equal(mesh.idx.length/3,88);
  const rings=[0,12,24,36,48].map(index=>mesh.uv[index*2+1]);
  assert.ok(rings.every((v,i)=>i===0||v>rings[i-1]));
  assert.ok(rings.at(-1)-rings[0]>.85);
  assert.ok(mesh.uv.every((v,i)=>v>=0&&v<=1));
  assert.ok(mesh.colors[0]<mesh.colors.at(-3),'darken base, not upper trunk');
  const twigStart=mesh.p.length/3;
  addUnwrappedBarkTube(mesh,[[0,2,0],[.5,2.3,.2]],
    [.1,.02],6,'twig',2);
  assert.ok(mesh.uv.slice(twigStart*2).every((u,i)=>i%2===1
    ?u>.04&&u<.98:u>.8&&u<.98),
    'twig uses its own UV region without touching trunk pigment');
  assert.deepEqual(mesh.barkIslands.map(i=>i.name),['trunk','twig']);
});
