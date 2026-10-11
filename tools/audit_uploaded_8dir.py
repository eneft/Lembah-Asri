#!/usr/bin/env python3
"""Fingerprint 8 uploaded image files against fixed approved Lembah Asri pose masters."""
from pathlib import Path
from PIL import Image
import numpy as np
import json
import re

FINGERPRINTS = {
    "down": "bc932cb32d8c4bc3",
    "down_right": "b1b368c62e9693c6",
    "right": "b33967ce2498c6c6",
    "up_right": "b136cd866c98cd93",
    "up": "bc31cdd12ccec9c1",
    "up_left": "e526999269c99b96",
    "left": "e74c329b39499393",
    "down_left": "e4e639b329c88793",
}
BASE = Path("assets/characters/player_base_8dir")
UUID_NAME = re.compile(r"^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\.png$")

def hash_image(image):
    image = image.convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Empty alpha")
    image = image.crop(bounds)
    bg = Image.new("RGBA", image.size, (180, 180, 180, 255))
    bg.alpha_composite(image)
    small = bg.convert("L").resize((32, 32), Image.Resampling.LANCZOS)
    a = np.asarray(small, dtype=float) - 128
    n = 32
    coef = np.array([[np.cos((2*x+1)*y*np.pi/(2*n)) for x in range(n)] for y in range(n)])
    signal = (coef @ a @ coef.T)[:8, :8].ravel()
    median = np.median(signal[1:])
    bits = 0
    for val in signal:
        bits = (bits << 1) | int(val > median)
    return bits

def main():
    matches = []
    files = sorted(x for x in BASE.glob("*.png") if UUID_NAME.match(x.name))
    print(f"UPLOADED_FILES={len(files)}")
    if len(files) == 0:
        # Once successfully installed, UUID sources are intentionally replaced
        # by 8 individually named, foot-aligned, lossless RGBA game assets.
        for direction, digest in FINGERPRINTS.items():
            p = BASE / (direction + ".png")
            if not p.is_file():
                raise FileNotFoundError("Missing canonical base pose: " + str(p))
            with Image.open(p) as im:
                box = im.convert("RGBA").getchannel("A").getbbox()
                good = (
                    im.mode == "RGBA"
                    and im.size == (1152, 1632)
                    and im.getpixel((0, 0))[3] == 0
                    and im.getpixel((1151, 1631))[3] == 0
                    and box is not None
                    and box[3] == 1585
                    and hash_image(im) == int(digest, 16)
                )
                print("CANONICAL_POSE " + json.dumps({
                    "direction": direction,
                    "size": list(im.size),
                    "mode": im.mode,
                    "bbox": box,
                    "fingerprint_match": hash_image(im) == int(digest, 16),
                    "valid": good
                }, separators=(",", ":")))
                if not good:
                    raise ValueError("Canonical image quality/identity regression: " + direction)
        print("MATCH_RESULT={\"confident\":true,\"installed\":true,\"count\":8}")
        return 0
    if len(files) != 8:
        print("NOT_READY: expected either 8 raw uploaded PNGs or 8 canonical PNGs")
        return 1
    for f in files:
        with Image.open(f) as im:
            dims = [im.width, im.height]
            mode = im.mode
            corner_alpha = im.convert("RGBA").getpixel((0, 0))[3]
            h = hash_image(im)
        ranks = sorted(
            [{"direction": d, "distance": (h ^ int(ref, 16)).bit_count()} for d, ref in FINGERPRINTS.items()],
            key=lambda p: p["distance"]
        )
        matches.append({"filename": f.name, "size": dims, "mode": mode, "corner_alpha": corner_alpha, "fingerprint": format(h, "016x"), "best": ranks[0], "second": ranks[1], "ranks": ranks})
        print("POSE " + json.dumps(matches[-1], separators=(",", ":")))
    chosen = [m["best"]["direction"] for m in matches]
    confident = (len(set(chosen)) == 8 and all(m["best"]["distance"] <= 12 and m["second"]["distance"] - m["best"]["distance"] >= 4 for m in matches))
    print("MATCH_RESULT=" + json.dumps({"confident": confident, "count": len(matches), "directions": chosen}, separators=(",", ":")))
    print("NO FILES RENAMED. This is an audit only.")
    return 0 if confident else 1

if __name__ == "__main__":
    raise SystemExit(main())
