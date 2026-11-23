#!/usr/bin/env python3
"""Import supplied GLB: retain all source mesh/UV bytes; optimize only its three PBR images."""
import sys, struct, json, hashlib, io
from pathlib import Path
from PIL import Image
SOURCE_SHA='6f8eb6de6f40b85cdeda83401c1ec0983f5e08c8ceb3e506a8e05579967f710b'
def optimize(source,target):
    data=Path(source).read_bytes()
    if hashlib.sha256(data).hexdigest()!=SOURCE_SHA:
        raise ValueError('Source GLB checksum mismatch')
    if data[:4]!=b'glTF' or struct.unpack_from('<II',data,4)!=(2,len(data)):
        raise ValueError('Not original glTF 2.0 GLB')
    jl,typ=struct.unpack_from('<II',data,12)
    if typ!=0x4e4f534a: raise ValueError('Missing JSON chunk')
    doc=json.loads(data[20:20+jl])
    o=20+jl+8
    if data[o-4:o]!=b'BIN\x00': raise ValueError('Missing BIN chunk')
    source_bin=data[o:]
    if len(doc.get('images',[]))!=3 or len(doc.get('meshes',[]))!=1:
        raise ValueError('Different model: expected 1 mesh, 3 PBR maps')
    imgs=doc['images'];views=doc['bufferViews']
    first=min(views[im['bufferView']].get('byteOffset',0) for im in imgs)
    if first<100000 or first%4: raise ValueError('Unexpected geometry boundary')
    dest=bytearray(source_bin[:first])
    for idx,max_dim,quality in [(0,1024,91),(1,2048,92),(2,1024,90)]:
        view=views[imgs[idx]['bufferView']]
        old=source_bin[view['byteOffset']:view['byteOffset']+view['byteLength']]
        with Image.open(io.BytesIO(old)) as original:
            im=original.convert('RGB')
            if max(im.size)>max_dim:
                r=max_dim/max(im.size)
                im=im.resize(tuple(round(v*r) for v in im.size),Image.Resampling.LANCZOS)
            out=io.BytesIO()
            im.save(out,format='JPEG',quality=quality,subsampling=0,optimize=True)
        value=out.getvalue()
        while len(dest)%4: dest.append(0)
        view['byteOffset']=len(dest); view['byteLength']=len(value)
        imgs[idx]['mimeType']='image/jpeg'
        dest.extend(value)
    while len(dest)%4: dest.append(0)
    doc['buffers'][0]['byteLength']=len(dest)
    encoded=json.dumps(doc,separators=(',',':')).encode()
    encoded+=b' '*((-len(encoded))%4)
    glb=struct.pack('<4sII',b'glTF',2,12+8+len(encoded)+8+len(dest))
    glb+=struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(dest),b'BIN\x00')+dest
    if len(glb)>len(data)*.55: raise ValueError('Expected mobile compression ratio')
    assert glb[28+len(encoded):28+len(encoded)+first]==source_bin[:first]
    p=Path(target);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(glb)
    print('PBR house bytes',len(data),'->',len(glb),'triangles unchanged 100000')
if __name__=='__main__':
    if len(sys.argv)!=3: raise SystemExit('Usage: optimize-house-glb.py input.glb output.glb')
    optimize(sys.argv[1],sys.argv[2])
