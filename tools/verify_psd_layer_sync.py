#!/usr/bin/env python3
"""Reject any Godot Web/Smoke build that uses PSD PNGs from an older upload.

This guard runs BEFORE Godot tests and Web export. Stdlib only.
"""
import hashlib
import json
from pathlib import Path

root = Path("assets/art/psd_layered_scene")
src = Path("assets/source_psd/Lembah asri tes scene")
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
collision = json.loads((root / "collision_polygons.json").read_text(encoding="utf-8"))
sha256 = hashlib.sha256(src.read_bytes()).hexdigest()
assert src.read_bytes()[:4] == b"8BPS", "Expected original Photoshop source"
assert manifest["source_sha256"] == sha256, (
    "PSD layer PNGs are STALE relative to edited source. "
    "Let the Photoshop import workflow finish before deploying."
)
assert collision["source_sha256"] == sha256, "Authored collision map is stale"
assert manifest["canvas"] == collision["canvas"] == [1672, 941], "PSD canvas mismatch"
assert collision["obstacle_count"] == len(collision["polygons"]) and 1 <= len(collision["polygons"]) <= 128
assert manifest["layers"][0]["name"] == "Background"
assert manifest["layers"][0]["source_order"] == 0
assert len(manifest["layers"]) == 11, "Scene uses eleven named native layer images"
orders = [int(x["source_order"]) for x in manifest["layers"]]
assert orders == sorted(orders) and len(set(orders)) == len(orders), "Layers not in PSD order"
marker_order = int(manifest["hero_marker_source_order"])
assert marker_order >= 1 and marker_order not in orders, "Character must replace its authored placeholder"
marker = manifest["character_marker_bbox"]
foot = [(marker[0] + marker[2] + 1)//2, marker[3]]
assert collision["hero_spawn_foot"] == foot, "PSD character marker changed without updating spawn"
scene = Path("scenes/rumah_ladang_psd_camera2d.tscn").read_text(encoding="utf-8")
for layer in manifest["layers"]:
    img = root / layer["filename"]
    assert img.exists() and img.stat().st_size > 500, f"Missing authentic PSD layer export: {img}"
    assert f"res://assets/art/psd_layered_scene/{layer['filename']}" in scene
assert len(collision["polygons"]) > 0, "No authored Photoshop collisions"
print(
    f"PSD LAYER ASSET SYNC PASS: original source sha256={sha256}; "
    f"art_layers={len(manifest['layers'])}; "
    f"collision_solids={len(collision['polygons'])}; "
    f"hero_layer={marker_order}; hero_foot={foot}"
)
