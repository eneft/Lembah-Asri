#!/usr/bin/env python3
"""Export the four *actual* Photoshop layers for Lembah Asri's Camera3D scene.

The source can be named 'background' without the usual .psd suffix.
No screenshot cropping, object segmentation, or replacement illustrations.
The known PSD layer bounds are a deliberate compatibility check.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

CANVAS_SIZE = (1672, 941)
EXPECTED = {
    "01_background.png": (0, 0, 1672, 941),
    "02_house.png": (157, -107, 988, 517),
    "03_banana.png": (63, 217, 358, 577),
    "04_foreground_tree.png": (-468, 341, 448, 1234),
}


def export(source: Path, destination: Path) -> None:
    try:
        from psd_tools import PSDImage
    except ImportError as exc:
        raise RuntimeError("Install first: python -m pip install psd-tools Pillow") from exc

    if not source.is_file():
        raise ValueError(f"PSD source not found: {source}")
    with source.open("rb") as stream:
        if stream.read(4) != b"8BPS":
            raise ValueError("The input is not a Photoshop PSD file (8BPS header missing)")

    psd = PSDImage.open(source)
    if tuple(psd.size) != CANVAS_SIZE:
        raise ValueError(f"Wrong PSD canvas {psd.size}, expected {CANVAS_SIZE}")

    layers = list(psd)
    if len(layers) != len(EXPECTED):
        raise ValueError(
            f"Expected precisely four top-level PSD layers, found {len(layers)}. "
            "Do not merge, flatten or substitute layers."
        )
    matching = {}
    for layer in layers:
        bbox = tuple(int(v) for v in layer.bbox)
        names = [name for name, bounds in EXPECTED.items() if bounds == bbox]
        if len(names) != 1:
            raise ValueError(
                f"Unrecognized PSD layer '{layer.name}', bounds={bbox}. "
                "Review layer offsets before importing."
            )
        name = names[0]
        if name in matching:
            raise ValueError(f"Duplicate PSD layer matching {name}")
        if not layer.is_visible():
            raise ValueError(f"PSD layer '{layer.name}' is hidden: {name}")
        matching[name] = layer
    if set(matching) != set(EXPECTED):
        raise ValueError("Some required PSD layers could not be matched")

    destination.mkdir(parents=True, exist_ok=True)
    manifest = {
        "source": source.name,
        "canvas": list(CANVAS_SIZE),
        "pixel_size_in_godot_units": 0.01,
        "layer_order_bottom_to_top": [
            "01_background.png", "Run8Player", "02_house.png",
            "03_banana.png", "04_foreground_tree.png"
        ],
        "layers": {},
    }
    with tempfile.TemporaryDirectory(prefix=".psd-export-", dir=destination) as tmp:
        staging = Path(tmp)
        for filename, bounds in EXPECTED.items():
            layer = matching[filename]
            image = layer.composite(force=True)
            if image is None:
                raise ValueError(f"Unable to composite layer: {filename}")
            image = image.convert("RGBA")
            required_size = (bounds[2] - bounds[0], bounds[3] - bounds[1])
            if image.size != required_size:
                raise ValueError(
                    f"Layer {filename} exported as {image.size}, "
                    f"expected {required_size}; stopping to prevent bad alignment"
                )
            if image.getchannel("A").getextrema()[1] == 0:
                raise ValueError(f"Layer {filename} is fully transparent")
            image.save(staging / filename, "PNG", optimize=True)
            manifest["layers"][filename] = {
                "bbox": list(bounds), "width": image.width, "height": image.height
            }
        (staging / "manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        for filename in EXPECTED:
            os.replace(staging / filename, destination / filename)
        os.replace(staging / "manifest.json", destination / "manifest.json")
    print(f"PSD LAYER EXPORT PASS: {len(EXPECTED)} genuine PNGs in {destination}")
    print("Order: background -> player -> house -> banana -> foreground tree")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("psd", type=Path, help="original PSD (e.g. background)")
    parser.add_argument(
        "--output", type=Path, default=Path("assets/art/psd_background"),
        help="destination relative to Godot repo",
    )
    args = parser.parse_args()
    try:
        export(args.psd, args.output)
        return 0
    except (ValueError, RuntimeError, OSError) as exc:
        print(f"PSD LAYER EXPORT FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
