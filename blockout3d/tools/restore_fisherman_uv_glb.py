#!/usr/bin/env python3
"""Restore the original user-supplied fisherman UV-mapped GLB from Git chunks.

Why chunks? The binary GLB is compressed on disk, then split only for reliable
GitHub transport. It is NOT decimated. The Godot Web build unpacks it before
the first project import. Reproducible offline: Python 3 standard library.
"""
from __future__ import annotations
import gzip
import hashlib
import json
from pathlib import Path
import struct

PART_COUNT = 8
EXPECTED_GZ_SHA256 = "e2d3e1c7b84a624a7589fe1d8dd421415dd524d95645658c9384ffe545e5b4f4"
EXPECTED_GLB_SHA256 = "704642bccb3655b14c1480246e68555349136b4dc4da97aeab13992d69cd44ad"
EXPECTED_GLB_SIZE = 8355972
SOURCE = Path(__file__).resolve().parents[1] / "assets/environment/houses/fisherman_meshy"
TARGET = SOURCE / "fisherman_original_uv.glb"

def restore() -> None:
    if TARGET.exists():
        current = hashlib.sha256(TARGET.read_bytes()).hexdigest()
        if current == EXPECTED_GLB_SHA256:
            print("FISHERMAN FULL UV RESTORE PASS: already verified", TARGET.stat().st_size)
            return
    chunks = [SOURCE / f"fisherman_original_uv.glb.gz.part{i:02d}" for i in range(1, PART_COUNT + 1)]
    for chunk in chunks:
        if not chunk.is_file() or chunk.stat().st_size < 100:
            raise RuntimeError(f"Missing or empty original-fisherman asset chunk: {chunk}")
    zipped = b"".join(p.read_bytes() for p in chunks)
    if hashlib.sha256(zipped).hexdigest() != EXPECTED_GZ_SHA256:
        raise RuntimeError("Original fisherman chunks corrupted (gzip SHA256)")
    raw = gzip.decompress(zipped)
    if len(raw) != EXPECTED_GLB_SIZE or hashlib.sha256(raw).hexdigest() != EXPECTED_GLB_SHA256:
        raise RuntimeError("Source UV GLB failed integrity check")
    magic, version, size = struct.unpack_from("<III", raw, 0)
    if magic != 0x46546C67 or version != 2 or size != len(raw):
        raise RuntimeError("Not a complete valid glTF binary")
    json_len, json_tag = struct.unpack_from("<II", raw, 12)
    if json_tag != 0x4E4F534A:
        raise RuntimeError("GLB JSON chunk missing")
    scene = json.loads(raw[20:20 + json_len])
    faces = scene["accessors"][scene["meshes"][0]["primitives"][0]["indices"]]["count"] // 3
    prim = scene["meshes"][0]["primitives"][0]
    if faces != 95121 or "TEXCOORD_0" not in prim["attributes"]:
        raise RuntimeError("Fisherman original UV mesh lost its 95121 faces")
    if len(scene["images"]) != 2 or any(image["mimeType"] != "image/jpeg" for image in scene["images"]):
        raise RuntimeError("Web-optimized original painted textures missing")
    TARGET.write_bytes(raw)
    print("FISHERMAN FULL UV RESTORE PASS: ", TARGET.stat().st_size, "bytes, 95121 triangles, 2048px texture", sep="")

if __name__ == "__main__":
    restore()
