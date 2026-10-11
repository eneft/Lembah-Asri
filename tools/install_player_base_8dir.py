#!/usr/bin/env python3
"""Import and validate the official Lembah Asri 8-direction HD base-form ZIP.

Usage:
    python tools/install_player_base_8dir.py /path/to/Lembah_Asri_Base_Karakter_8_Arah_Godot.zip
This installer never pushes to GitHub or silently overwrites existing PNGs.
"""
import hashlib
import json
from pathlib import Path
import struct
import sys
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets/characters/player_base_8dir"
PREFIX = "assets/characters/player_base_8dir/"
DIRECTIONS = (
    "down", "down_right", "right", "up_right",
    "up", "up_left", "left", "down_left",
)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def validate_png(data: bytes, name: str) -> None:
    if not data.startswith(PNG_SIGNATURE) or len(data) < 33:
        raise ValueError(f"{name}: not a PNG")
    length = struct.unpack(">I", data[8:12])[0]
    if data[12:16] != b"IHDR" or length != 13:
        raise ValueError(f"{name}: missing PNG IHDR")
    width, height, depth, color_type = struct.unpack(">IIBB", data[16:26])
    if (width, height, depth, color_type) != (1152, 1632, 8, 6):
        raise ValueError(
            f"{name}: requires 1152x1632, 8-bit RGBA (got {width}x{height}, depth={depth}, color={color_type})"
        )


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python tools/install_player_base_8dir.py <base_character_zip>")
        return 2
    zip_path = Path(sys.argv[1]).resolve()
    if not zip_path.is_file():
        print(f"Missing ZIP: {zip_path}", file=sys.stderr)
        return 2
    with ZipFile(zip_path) as archive:
        names = set(archive.namelist())
        manifest_name = PREFIX + "manifest.json"
        required = {PREFIX + d + ".png" for d in DIRECTIONS}
        if manifest_name not in names or not required.issubset(names):
            raise ValueError("Expected 8 PNGs and manifest.json at the ZIP root (no extra wrapper folder).")
        manifest = json.loads(archive.read(manifest_name))
        if manifest.get("canvas") != [1152, 1632] or manifest.get("foot_baseline_y") != 1585:
            raise ValueError("The ZIP is not the approved 1152x1632, foot-aligned version.")
        records = {record["direction"]: record for record in manifest["poses"]}
        if set(records) != set(DIRECTIONS):
            raise ValueError("Manifest must include exactly 8 directions.")
        validated = {}
        for direction in DIRECTIONS:
            name = direction + ".png"
            binary = archive.read(PREFIX + name)
            validate_png(binary, name)
            digest = hashlib.sha256(binary).hexdigest()
            if digest != records[direction]["sha256"]:
                raise ValueError(f"{name}: SHA-256 mismatch, refusing corrupted/altered art")
            validated[name] = binary
        # Verify *all* images before altering any files.
        for name, binary in validated.items():
            path = DEST / name
            if path.exists() and path.read_bytes() != binary:
                raise FileExistsError(f"{path}: differs from official master; refusing to overwrite")
        DEST.mkdir(parents=True, exist_ok=True)
        for name, binary in validated.items():
            (DEST / name).write_bytes(binary)
            print(f"VALID PNG RGBA 1152x1632: {PREFIX}{name}")
        (DEST / "manifest.json").write_bytes(archive.read(manifest_name))
    print("8 base poses imported. Commit/push 'assets/characters/player_base_8dir/' to activate them in Godot Web.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError) as error:
        print(f"BASE CHARACTER IMPORT FAILED: {error}", file=sys.stderr)
        sys.exit(1)
