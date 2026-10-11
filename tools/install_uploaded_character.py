#!/usr/bin/env python3
"""Install the eight distinct, user-uploaded Lembah Asri base poses in Godot.

Matches uploaded UUID PNGs by exact perceptual fingerprint against the approved
original artworks. Does NOT mirror images, downsample pixels or invent animation.
Pads full-resolution artwork onto identical 1152x1632 RGBA canvases with feet at
pixel y=1585. Every output is lossless and every original remains in Git history.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

from audit_uploaded_8dir import BASE, FINGERPRINTS, UUID_NAME, hash_image

CANVAS = (1152, 1632)
BASELINE = 1585
DIRECTIONS = (
    "down", "down_right", "right", "up_right",
    "up", "up_left", "left", "down_left"
)

def main() -> int:
    files = sorted(p for p in BASE.glob("*.png") if UUID_NAME.match(p.name))
    if len(files) != 8:
        raise ValueError(f"expected 8 source PNGs; found {len(files)}")
    matches = {}
    for path in files:
        with Image.open(path) as opened:
            original = opened.convert("RGBA")
        if original.size != (1024, 1536):
            raise ValueError(f"{path.name}: expected original 1024x1536, found {original.size}")
        if original.getpixel((0, 0))[3] != 0:
            raise ValueError(f"{path.name}: PNG not transparent at top-left")
        fingerprint = hash_image(original)
        exact = [name for name, h in FINGERPRINTS.items() if fingerprint == int(h, 16)]
        if len(exact) != 1:
            raise ValueError(f"{path.name}: cannot uniquely match approved artwork: {exact}")
        direction = exact[0]
        if direction in matches:
            raise ValueError(f"Duplicate direction: {direction}")
        matches[direction] = (path, original)
    if set(matches) != set(DIRECTIONS):
        raise ValueError(f"Missing directions: {set(DIRECTIONS) - set(matches)}")

    processed = {}
    report = []
    for direction in DIRECTIONS:
        source_path, source = matches[direction]
        box = source.getchannel("A").getbbox()
        if box is None:
            raise ValueError(f"{source_path}: empty alpha")
        x0, y0, x1, y1 = box
        dx = round((CANVAS[0] - x0 - x1) / 2)
        dy = BASELINE - y1
        if dx < 0 or dy < 0 or dx + source.width > CANVAS[0] or dy + source.height > CANVAS[1]:
            raise ValueError(f"{direction}: original art cannot fit canonical canvas")
        destination = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        # Paste without mask: retains every original RGBA pixel byte.
        destination.paste(source, (dx, dy))
        assert destination.getchannel("A").getbbox()[3] == BASELINE
        assert destination.getpixel((0, 0))[3] == 0
        out_path = BASE / (direction + ".png")
        if out_path.exists():
            raise FileExistsError(f"Refusing to overwrite {out_path}")
        processed[out_path] = destination
        report.append({
            "direction": direction,
            "original_uploaded_file": source_path.name,
            "original_size": list(source.size),
            "original_alpha_bbox": list(box),
            "offset": [dx, dy],
            "output_size": list(CANVAS),
            "foot_baseline_y": BASELINE,
            "fingerprint": FINGERPRINTS[direction],
        })

    # All eight files are validated before writing and removing UUID filenames.
    for path, image in processed.items():
        image.save(path, format="PNG", compress_level=6)
        with Image.open(path) as check:
            if check.size != CANVAS or check.mode != "RGBA" or check.getchannel("A").getbbox()[3] != BASELINE:
                raise ValueError(f"Invalid canonical PNG: {path.name}")
        image_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        direction = path.stem
        next(p for p in report if p["direction"] == direction)["sha256"] = image_hash
        print(f"CANONICAL_POSE {direction} <- {matches[direction][0].name} {image_hash[:12]}")

    (BASE / "manifest.json").write_text(json.dumps({
        "canvas": list(CANVAS),
        "foot_baseline_y": BASELINE,
        "lossless": True,
        "character_base": "Lembah Asri HD explorer - eight native views",
        "poses": report,
    }, indent=2) + "\n", encoding="utf-8")
    for path in files:
        path.unlink()
    print("BASE_8DIR_INSTALL_PASS: eight transparent aligned original-color PNGs installed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
