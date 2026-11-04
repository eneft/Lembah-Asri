#!/usr/bin/env python3
"""Remove roof foliage from the original Meshy village-head GLB.

Retain the original PBR PNG image bytes, exact UVs and source NORMAL vectors.
Only the two localized roof plant groups are removed, not garden foliage.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

SOURCE_VERTICES = 124673
SOURCE_TRIANGLES = 100095
DTYPES = {5121: np.dtype("u1"), 5123: np.dtype("<u2"),
          5125: np.dtype("<u4"), 5126: np.dtype("<f4")}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path: Path):
    raw = path.read_bytes()
    assert raw[:4] == b"glTF" and struct.unpack_from("<I", raw, 4)[0] == 2
    assert struct.unpack_from("<I", raw, 8)[0] == len(raw)
    jslen, jstype = struct.unpack_from("<II", raw, 12)
    assert jstype == 0x4E4F534A
    offset = 20 + jslen
    binlen, bintype = struct.unpack_from("<II", raw, offset)
    assert bintype == 0x004E4942
    return json.loads(raw[20:offset]), raw[offset + 8:offset + 8 + binlen]


def view_bytes(doc, buf, i):
    v = doc["bufferViews"][i]
    n = v.get("byteOffset", 0)
    return buf[n:n + v["byteLength"]]


def accessor(doc, buf, i):
    a = doc["accessors"][i]
    v = doc["bufferViews"][a["bufferView"]]
    assert "byteStride" not in v and "sparse" not in a
    offset = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    n = a["count"] * WIDTHS[a["type"]]
    return np.frombuffer(buf, dtype=DTYPES[a["componentType"]],
                         count=n, offset=offset).reshape(a["count"], -1).copy()


def clean(source: Path, dest: Path):
    doc, buf = read_glb(source)
    primitive = doc["meshes"][0]["primitives"][0]
    attrs = primitive["attributes"]
    p = accessor(doc, buf, attrs["POSITION"])
    normals = accessor(doc, buf, attrs["NORMAL"])
    uv = accessor(doc, buf, attrs["TEXCOORD_0"])
    faces = accessor(doc, buf, primitive["indices"]).reshape(-1, 3)
    assert p.shape == (SOURCE_VERTICES, 3) and len(faces) == SOURCE_TRIANGLES
    assert normals.shape == p.shape and uv.shape == (len(p), 2)

    material = doc["materials"][primitive["material"]]
    texid = material["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    imgid = doc["textures"][texid]["source"]
    img = doc["images"][imgid]
    texture_bytes = view_bytes(doc, buf, img["bufferView"])
    tex = np.asarray(Image.open(io.BytesIO(texture_bytes)).convert("RGB"))
    ux = np.clip((uv[:, 0] * (tex.shape[1] - 1)).astype(np.int32), 0, tex.shape[1] - 1)
    uy = np.clip((uv[:, 1] * (tex.shape[0] - 1)).astype(np.int32), 0, tex.shape[0] - 1)
    rgb = tex[uy, ux].astype(np.float32)
    green = ((rgb[:, 1] > 1.10 * rgb[:, 0]) &
             (rgb[:, 1] > 1.13 * rgb[:, 2]) &
             (rgb[:, 1] > 57))

    edges = np.concatenate((faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]))
    g = coo_matrix((np.ones(len(edges), dtype=np.int8),
                    (edges[:, 0], edges[:, 1])),
                   shape=(len(p), len(p))).tocsr()
    count, labels = connected_components(g, directed=False)
    n = np.bincount(labels, minlength=count)
    greens = np.bincount(labels, weights=green.astype(np.float32), minlength=count)
    mx = np.bincount(labels, weights=p[:, 0], minlength=count) / np.maximum(n, 1)
    my = np.bincount(labels, weights=p[:, 1], minlength=count) / np.maximum(n, 1)
    mz = np.bincount(labels, weights=p[:, 2], minlength=count) / np.maximum(n, 1)

    left_roof = (mx < -0.22) & (mz < 0.08) & (my > 0.0)
    right_roof = (mx > 0.55) & (mz > -0.18) & (my > 0.01)
    remove_component = (left_roof | right_roof) & (greens / np.maximum(n, 1) >= 0.30)
    remove_face = remove_component[labels[faces[:, 0]]]

    removed = int(remove_face.sum())
    assert 21000 <= removed <= 25000, f"unexpected removed triangles: {removed}"
    assert not np.any(remove_face & (p[faces, 1].max(axis=1) < -0.20)), "garden was touched"
    kept = faces[~remove_face]
    unique, inverse = np.unique(kept.reshape(-1), return_inverse=True)
    remaining_green = int((green[unique] & (p[unique, 1] > .12)).sum())
    original_green = int((green & (p[:, 1] > .12)).sum())
    assert remaining_green < original_green * .02, "roof vegetation still present"
    compact_faces = inverse.reshape(-1, 3).astype("<u4")
    compact_position = p[unique].astype("<f4")
    compact_normal = normals[unique].astype("<f4")
    compact_uv = uv[unique].astype("<f4")

    output = copy.deepcopy(doc)
    attr = output["meshes"][0]["primitives"][0]["attributes"]
    values = {
        attr["POSITION"]: compact_position,
        attr["NORMAL"]: compact_normal,
        attr["TEXCOORD_0"]: compact_uv,
        primitive["indices"]: compact_faces.reshape(-1, 1)
    }
    packed = []
    cursor = 0
    for i in range(len(doc["bufferViews"])):
        this_accessor = next((a for a in values
                              if doc["accessors"][a]["bufferView"] == i), None)
        if this_accessor is None:
            raw = view_bytes(doc, buf, i)
        else:
            new_values = values[this_accessor]
            raw = new_values.tobytes()
            a = output["accessors"][this_accessor]
            a["count"] = len(new_values)
            a["byteOffset"] = 0
            if this_accessor == attr["POSITION"]:
                a["min"] = compact_position.min(axis=0).astype(float).tolist()
                a["max"] = compact_position.max(axis=0).astype(float).tolist()
            if this_accessor == primitive["indices"]:
                a["min"] = [int(compact_faces.min())]
                a["max"] = [int(compact_faces.max())]
        pad = (-cursor) % 4
        packed.append(bytes(pad))
        cursor += pad
        output["bufferViews"][i]["byteOffset"] = cursor
        output["bufferViews"][i]["byteLength"] = len(raw)
        packed.append(raw)
        cursor += len(raw)

    binary = b"".join(packed)
    output["buffers"][0]["byteLength"] = len(binary)
    metadata = json.dumps(output, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    metadata += b" " * (-len(metadata) % 4)
    binary += bytes(-len(binary) % 4)
    glb = (b"glTF" + struct.pack("<II", 2, 12 + 8 + len(metadata) + 8 + len(binary))
           + struct.pack("<I4s", len(metadata), b"JSON") + metadata
           + struct.pack("<I4s", len(binary), b"BIN\x00") + binary)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(glb)

    chk, raw = read_glb(dest)
    chkprim = chk["meshes"][0]["primitives"][0]
    assert chkprim["attributes"].keys() == attrs.keys()
    assert np.array_equal(accessor(chk, raw, chkprim["attributes"]["NORMAL"]), compact_normal)
    assert np.array_equal(accessor(chk, raw, chkprim["attributes"]["TEXCOORD_0"]), compact_uv)
    for original_image, clean_image in zip(doc["images"], chk["images"]):
        assert hashlib.sha256(view_bytes(doc, buf, original_image["bufferView"])).digest() == \
               hashlib.sha256(view_bytes(chk, raw, clean_image["bufferView"])).digest()
    assert len(accessor(chk, raw, chkprim["indices"])) == len(compact_faces) * 3
    print(f"CLEAN ROOF PASS: deleted {removed} roof-vegetation triangles, retained {len(compact_faces)} triangles, {len(unique)} vertices")
    print(f"ROOF UV/NORMAL/TEXTURE PASS: upper-green {original_green}->{remaining_green}; all 3 original PNGs intact")
    print(f"OUTPUT: {dest} {dest.stat().st_size} bytes sha256={hashlib.sha256(glb).hexdigest()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    opts = parser.parse_args()
    clean(opts.source, opts.output)
