import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { AnimationClip, Texture, TextureLoader } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const root = new URL('../public/models/character/', import.meta.url);
await mkdir(new URL('clips/', root), { recursive: true });

// This standalone Node process extracts animation tracks. Materials and embedded
// image previews are irrelevant here and would otherwise require a browser DOM.
globalThis.window = { URL };
TextureLoader.prototype.load = () => new Texture();

for (const name of ['Walking', 'Running', 'Jump']) {
  const bytes = await readFile(new URL(name + '.fbx', root));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const model = new FBXLoader().parse(buffer, '');
  const clip = model.animations[0];
  if (!clip?.tracks.length || !(clip.duration > 0)) throw new Error('Invalid clip: ' + name);
  const json = AnimationClip.toJSON(clip);
  const data = JSON.stringify(json);
  await writeFile(new URL('clips/' + name + '.json', root), data);
  console.log(name + ': ' + bytes.length + ' FBX bytes -> ' + Buffer.byteLength(data) + ' clip bytes');
}
