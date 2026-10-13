#!/usr/bin/env python3
"""Install the user-approved proportional RUN8 atlas into the Lembah Asri Godot 4 repo.

Usage:
    python tools/install_run8_proportional.py LembahAsri_Run8_Proportional_Godot4.zip

The installer copies only a whitelisted set of files. Existing RUN/WALK/IDLE
assets, Godot project settings, scenes and integration files are not overwritten.
The MAIN scene auto-selects the new RUN after this pack is installed; WALK
and IDLE continue using their existing sources.
"""
import argparse
import json
import re
import struct
from pathlib import Path
from zipfile import ZipFile

TARGET = "assets/characters/run8_proportional"
DIRS = ("right", "down_right", "down", "down_left",
        "left", "up_left", "up", "up_right")
EXPECTED = {
    "down": 10, "down_right": 10, "right": 8, "up_right": 10,
    "up": 8, "up_left": 10, "left": 8, "down_left": 10,
}
RESOURCE_PREFIX = "res://assets/run8/"
REPLACEMENT_PREFIX = "res://" + TARGET + "/"
PACK_FILES = {
    "assets/run8/Run8_Normalized_Base.png": TARGET + "/Run8_Normalized_Base.png",
    "assets/run8/Run8_Normalized_Mirror.png": TARGET + "/Run8_Normalized_Mirror.png",
    "assets/run8/Run8_SpriteFrames.tres": TARGET + "/Run8_SpriteFrames.tres",
    "assets/run8/Run8Player.gd": TARGET + "/Run8Player.gd",
    "assets/run8/Run8Player.tscn": TARGET + "/Run8Player.tscn",
    "Main.gd": "scripts/run8_proportional_test.gd",
    "Main.tscn": "scenes/run8_proportional_test.tscn",
    "Scale_Audit.json": "docs/run8_proportional_scale_audit.json",
}

def check_png(raw, label):
    if not raw.startswith(b"\x89PNG\r\n\x1a\n") or len(raw) < 24:
        raise ValueError(f"Invalid PNG: {label}")
    width, height = struct.unpack(">II", raw[16:24])
    if not (100 <= width <= 8192 and 100 <= height <= 8192):
        raise ValueError(f"Suspicious dimensions for {label}: {width}x{height}")
    return width, height

def install(archive_path: Path, root: Path):
    if not (root / "project.godot").is_file() or not (root / "scripts/stage1_player.gd").is_file():
        raise ValueError(f"Not a Lembah Asri Godot root: {root}")
    pending = {}
    with ZipFile(archive_path) as archive:
        files = set(archive.namelist())
        missing = set(PACK_FILES) - files
        if missing:
            raise ValueError("Missing archive files: " + ", ".join(sorted(missing)))
        for src, dst in PACK_FILES.items():
            raw = archive.read(src)
            if src.endswith(".png"):
                check_png(raw, src)
            else:
                txt = raw.decode("utf-8-sig")
                if dst.endswith((".tres", ".tscn", ".gd")):
                    txt = txt.replace(RESOURCE_PREFIX, REPLACEMENT_PREFIX)
                    txt = txt.replace("res://Main.gd", "res://scripts/run8_proportional_test.gd")
                raw = txt.encode("utf-8")
            pending[dst] = raw

    # Ensure this is the correct 8-direction, 74-pose pack before any writes.
    sprites = pending[TARGET + "/Run8_SpriteFrames.tres"].decode()
    total = 0
    for name in DIRS:
        pattern = r'"frames": \[(.*?)\], "loop": true, "name": &"run_' + re.escape(name) + r'"'
        match = re.search(pattern, sprites)
        if match is None:
            raise ValueError(f"Missing run direction: {name}")
        count = match.group(1).count('"duration"')
        if count != EXPECTED[name]:
            raise ValueError(f"Wrong frame count run_{name}: {count} != {EXPECTED[name]}")
        total += count
    if total != 74:
        raise ValueError(f"Wrong total poses: {total}")
    audit = json.loads(pending["docs/run8_proportional_scale_audit.json"].decode())
    if audit.get("canvas_wh_px") != [512, 768] or audit.get("target_visual_height_px") != 640:
        raise ValueError("Incompatible atlas geometry")
    if REPLACEMENT_PREFIX not in sprites:
        raise ValueError("SpriteFrames texture paths were not adjusted")
    # Commit the known-good files without touching any source animation.
    for relative, raw in pending.items():
        dst = root / relative
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(raw)
        print("Installed:", relative, len(raw), "bytes")
    print("SUCCESS: RUN8 proportional 8 dirs/74 frames; old RUN/WALK/IDLE untouched.")
    print("Main: scenes/house_garden_stage1.tscn; standalone test: scenes/run8_proportional_test.tscn")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_file", type=Path, help="LembahAsri_Run8_Proportional_Godot4.zip")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    install(args.zip_file.resolve(), args.repo_root.resolve())
