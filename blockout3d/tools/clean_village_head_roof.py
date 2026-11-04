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
from scipy.spatial import cKDTree

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
    """V2 from SOURCE: protect terracotta roof, remove foliage and side vine.

    Do not repeat earlier broad component deletion that punched tiles.
    The source mesh and all three original PNGs remain untouched.
    """
    doc, buf = read_glb(source)
    primitive = doc["meshes"][0]["primitives"][0]
    attrs = primitive["attributes"]
    p = accessor(doc, buf, attrs["POSITION"])
    normals = accessor(doc, buf, attrs["NORMAL"])
    uv = accessor(doc, buf, attrs["TEXCOORD_0"])
    faces = accessor(doc, buf, primitive["indices"]).reshape(-1, 3)
    assert p.shape == (SOURCE_VERTICES, 3) and len(faces) == SOURCE_TRIANGLES

    mat = doc["materials"][primitive["material"]]
    texidx = mat["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    imgid = doc["textures"][texidx]["source"]
    source_texture = view_bytes(doc, buf, doc["images"][imgid]["bufferView"])
    tex = np.asarray(Image.open(io.BytesIO(source_texture)).convert("RGB")).astype(np.float32) / 255.0
    ux = np.clip((uv[:, 0] * (tex.shape[1] - 1)).astype(np.int32), 0, tex.shape[1] - 1)
    uy = np.clip((uv[:, 1] * (tex.shape[0] - 1)).astype(np.int32), 0, tex.shape[0] - 1)
    rgb = tex[uy, ux]
    frgb = rgb[faces].mean(axis=1)
    fc = p[faces].mean(axis=1)
    vgreen = (rgb[:, 1] > rgb[:, 0] * 1.12) & (rgb[:, 1] > rgb[:, 2] * 1.10) & (rgb[:, 1] > .22)
    vred = (rgb[:, 0] > rgb[:, 1] * 1.20) & (rgb[:, 0] > rgb[:, 2] * 1.30) & (rgb[:, 0] > .35)

    edges = np.concatenate((faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]))
    graph = coo_matrix((np.ones(len(edges), dtype=np.int8), (edges[:, 0], edges[:, 1])), shape=(len(p), len(p))).tocsr()
    count, labels = connected_components(graph, directed=False)
    n = np.bincount(labels, minlength=count)
    green_n = np.bincount(labels, weights=vgreen.astype(float), minlength=count)
    red_n = np.bincount(labels, weights=vred.astype(float), minlength=count)
    mx = np.bincount(labels, weights=p[:, 0], minlength=count) / np.maximum(n, 1)
    my = np.bincount(labels, weights=p[:, 1], minlength=count) / np.maximum(n, 1)
    mz = np.bincount(labels, weights=p[:, 2], minlength=count) / np.maximum(n, 1)
    gr = green_n / np.maximum(n, 1)
    rr = red_n / np.maximum(n, 1)

    # Roof envelope from REAL red tiles. Near-brown leaf branches are not used
    # to lift the envelope, unlike the earlier damaging cleanup.
    strong_red = (frgb[:, 0] > frgb[:, 1] * 1.60) & (frgb[:, 0] > frgb[:, 2] * 1.45) & (frgb[:, 0] > .40)
    roof_core = strong_red & (fc[:, 1] > -.07) & (fc[:, 1] < .45) & (np.abs(fc[:, 0]) < .77) & (np.abs(fc[:, 2]) < .67)
    tree = cKDTree(fc[roof_core][:, [0, 2]])
    _, inds = tree.query(fc[:, [0, 2]], k=32)
    roof_y = np.percentile(fc[roof_core][inds, 1], 25, axis=1)
    above = fc[:, 1] - roof_y
    roof_left = (fc[:, 0] < -.12) & (fc[:, 2] < .15) & (fc[:, 1] > -.06)
    roof_right = (fc[:, 0] > .49) & (fc[:, 2] > -.23) & (fc[:, 1] > -.05)
    roof_area = roof_left | roof_right
    drop = roof_area & (above > .030) & ~roof_core
    green_face = (frgb[:, 1] > frgb[:, 0] * 1.08) & (frgb[:, 1] > frgb[:, 2] * 1.08) & (frgb[:, 1] > .20)
    drop |= roof_area & (above > .013) & green_face & ~roof_core
    roof_c = ((mx < -.15) & (mz < .13) & (my > .025)) | ((mx > .49) & (mz > -.22) & (my > .018))
    plant_roof = roof_c & (gr > .30) & (rr < .17)
    drop |= plant_roof[labels[faces[:, 0]]] & ~roof_core

    # Intruding side-wall plant, not shrubs planted around the foundation.
    side_c = (mx > .54) & (mx < .95) & (mz > -.39) & (mz < -.03) & (my > -.38) & (my < .04)
    wall_vines = side_c & (gr > .15) & (rr < .30)
    drop |= wall_vines[labels[faces[:, 0]]] & ~roof_core
    # Meshy plaster is approximately x=.52; the vine protrudes beyond x=.575.
    vine = (fc[:, 0] > .575) & (fc[:, 1] > -.365) & (fc[:, 1] < -.095) & (fc[:, 2] > -.37) & (fc[:, 2] < -.065)
    drop |= vine & ~roof_core
    canopy = (fc[:, 0] < -.31) & (fc[:, 2] < -.15) & (fc[:, 1] > .03)
    drop |= canopy & ((above > .042) | ((above > .012) & ~strong_red))
    # These faces ARE the physical roof and must never be culled as ivy.
    tile = roof_core & (above < .042)
    drop &= ~tile
    assert not np.any(drop & tile), "terracotta roof regression"

    kept = faces[~drop]
    unique, inverse = np.unique(kept.reshape(-1), return_inverse=True)
    compact_faces = inverse.reshape(-1, 3).astype("<u4")
    compact_position = p[unique].astype("<f4")
    compact_normal = normals[unique].astype("<f4")
    compact_uv = uv[unique].astype("<f4")

    # Recolor remaining tiny green roof regions using SAME original terracotta
    # texture. Duplicate affected vertices so adjacent original UVs do not move.
    tile_candidates = np.where(roof_core & (frgb[:, 0] > .67) & (frgb[:, 1] < .48) & (frgb[:, 1] > .20))[0]
    assert len(tile_candidates) > 200
    sample_idx = int(tile_candidates[len(tile_candidates) // 3])
    tile_uv = uv[faces[sample_idx][0]].astype("<f4")
    recolor = (~drop) & roof_area & (above > -.022) & (frgb[:, 1] > frgb[:, 0] * .88) & (frgb[:, 1] > frgb[:, 2] * 1.08) & (~strong_red)
    target_rows = np.flatnonzero(recolor[~drop])
    if len(target_rows):
        source_rows = np.flatnonzero(~drop)[target_rows]
        vertices = faces[source_rows].reshape(-1)
        newids = np.arange(len(compact_position), len(compact_position) + len(vertices), dtype="<u4").reshape(-1, 3)
        compact_faces[target_rows] = newids
        compact_position = np.vstack((compact_position, p[vertices].astype("<f4")))
        compact_normal = np.vstack((compact_normal, normals[vertices].astype("<f4")))
        compact_uv = np.vstack((compact_uv, np.tile(tile_uv, (len(vertices), 1)).astype("<f4")))
    print(f"REPAINT V12 PASS: {len(target_rows)} moss-colored roof faces retextured; no geometry holes")

    output = copy.deepcopy(doc)
    values = {
        attrs["POSITION"]: compact_position,
        attrs["NORMAL"]: compact_normal,
        attrs["TEXCOORD_0"]: compact_uv,
        primitive["indices"]: compact_faces.reshape(-1, 1),
    }
    packed = []
    cursor = 0
    for i in range(len(doc["bufferViews"])):
        ac = next((a for a in values if doc["accessors"][a]["bufferView"] == i), None)
        rawbytes = values[ac].tobytes() if ac is not None else view_bytes(doc, buf, i)
        if ac is not None:
            a = output["accessors"][ac]
            a["count"] = len(values[ac])
            a["byteOffset"] = 0
            if ac == attrs["POSITION"]:
                a["min"] = compact_position.min(axis=0).astype(float).tolist()
                a["max"] = compact_position.max(axis=0).astype(float).tolist()
            if ac == primitive["indices"]:
                a["min"] = [int(compact_faces.min())]
                a["max"] = [int(compact_faces.max())]
        pad = (-cursor) % 4
        packed.append(bytes(pad))
        cursor += pad
        output["bufferViews"][i]["byteOffset"] = cursor
        output["bufferViews"][i]["byteLength"] = len(rawbytes)
        packed.append(rawbytes)
        cursor += len(rawbytes)
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
    chk, rb = read_glb(dest)
    chkprim = chk["meshes"][0]["primitives"][0]
    assert np.array_equal(accessor(chk, rb, chkprim["attributes"]["NORMAL"]), compact_normal)
    assert np.array_equal(accessor(chk, rb, chkprim["attributes"]["TEXCOORD_0"]), compact_uv)
    for a, b in zip(doc["images"], chk["images"]):
        assert hashlib.sha256(view_bytes(doc, buf, a["bufferView"])).digest() == hashlib.sha256(view_bytes(chk, rb, b["bufferView"])).digest()
    assert len(accessor(chk, rb, chkprim["indices"])) == len(compact_faces) * 3
    assert len(compact_faces) == 74481, "unexpected source geometry or cleanup parameters"
    print(f"ROOF WALL V12 PASS: removed {int(drop.sum())} plant triangles, retained {len(compact_faces)}; protected {int(tile.sum())} genuine tile faces")
    print(f"PRESERVE PASS: all three PNG images byte-identical, original structural UV and NORMAL intact")
    print(f"OUTPUT: {dest} {dest.stat().st_size} bytes sha256={hashlib.sha256(glb).hexdigest()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    opts = parser.parse_args()
    clean(opts.source, opts.output)
