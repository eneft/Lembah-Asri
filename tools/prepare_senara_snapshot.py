#!/usr/bin/env python3
"""Prepare a new SENARA snapshot; never modify or delete the source repository."""
import argparse
import hashlib
import json
import re
import urllib.parse
from pathlib import Path

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def kebab(name):
    return re.sub(r"[-_ ]+", "-", re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "-", name)).lower()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--source-commit", required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    web = root / "web"
    assert (web / "package.json").is_file()
    assert not (root / "blockout3d").exists() and not (root / "assets").exists()
    public = web / "public"
    special = {
        "shaded.png": "character-albedo.png",
        "texture_diffuse.png": "character-diffuse.png",
        "texture_metallic.png": "character-metallic.png",
        "texture_normal.png": "character-normal.png",
        "texture_pbr.png": "character-pbr.png",
        "texture_roughness.png": "character-roughness.png",
        "Rumah_Masa_Kecil.glb": "rumah-masa-kecil.glb",
        "lembah_asri_rocks_original_16.glb": "senara-rocks-original-16.glb",
        "lembah_leaf_pigment.webp": "senara-leaf-pigment.webp",
        "lembah_material_atlas.webp": "senara-material-atlas.webp",
        "pohon pekarangan.webp": "pohon-pekarangan-atlas.webp",
    }
    entries = []
    renames = {}
    seen = set()
    for old in sorted(public.rglob("*")):
        if not old.is_file():
            continue
        new = old.with_name(special.get(old.name, kebab(old.stem) + old.suffix.lower()))
        target = str(new.relative_to(root))
        if target in seen:
            raise RuntimeError(f"Case/name collision: {target}")
        seen.add(target)
        entries.append({"old": str(old.relative_to(root)), "new": target, "sha256": digest(old), "bytes": old.stat().st_size})
        if new != old:
            if old.name in renames and renames[old.name] != new.name:
                raise RuntimeError(f"Ambiguous filename: {old.name}")
            renames[old.name] = new.name
    # All authored asset content stays byte-identical; only filenames change.
    for entry in entries:
        old, new = root / entry["old"], root / entry["new"]
        if old != new:
            if new.exists():
                raise RuntimeError(f"Destination exists: {new}")
            old.rename(new)
    text_ext = {".ts", ".tsx", ".mjs", ".mts", ".cjs", ".js", ".json", ".html", ".css", ".md", ".yml", ".yaml", ".py", ".svg"}
    generated = {
        "pohon_rimbun_shade.glb": "pohon-rimbun-shade.glb",
        "pohon_rimbun_orchard.glb": "pohon-rimbun-orchard.glb",
        "Walking.json": "walking.json",
        "Running.json": "running.json",
        "Jump.json": "jump.json",
    }
    full = {**renames, **generated}
    # Handle literal and regex-escaped references, plus percent-encoded URL names.
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix not in text_ext or public in path.parents:
            continue
        src = path.read_text(encoding="utf-8")
        out = src
        for old, new in sorted(full.items(), key=lambda item: -len(item[0])):
            out = out.replace(old, new)
            out = out.replace(old.replace(".", r"\."), new.replace(".", r"\."))
            out = out.replace(urllib.parse.quote(old), urllib.parse.quote(new))
        # Generated paths assembled from variables.
        out = out.replace("pohon_rimbun_", "pohon-rimbun-")
        if path.name == "build-character-clips.mjs":
            out = out.replace("name + '.fbx'", "name.toLowerCase() + '.fbx'")
            out = out.replace("'clips/' + name + '.json'", "'clips/' + name.toLowerCase() + '.json'")
        if path.name == "check-garden-browser.mjs":
            out = out.replace("clip + '.json'", "clip.toLowerCase() + '.json'")
            out = out.replace("clip + '.fbx'", "clip.toLowerCase() + '.fbx'")
        # Brand presentation, NOT the village name in dialogue, save keys, or schema IDs.
        if path.name == "index.html":
            out = out.replace("<title>Lembah Asri</title>", "<title>SENARA</title>")
        if path.name == "App.tsx":
            out = out.replace('className="brand-mark">LA<', 'className="brand-mark">S<')
            out = out.replace("<strong>Lembah Asri</strong>", "<strong>SENARA</strong>")
        if path == web / "electron/main.cjs":
            out = out.replace("title: 'Lembah Asri'", "title: 'SENARA'")
        if path == web / "package.json":
            data = json.loads(out)
            data["name"] = "senara-web"
            data["build"]["productName"] = "SENARA"
            data["build"]["win"]["artifactName"] = "SENARA-${version}-${arch}.${ext}"
            # Preserve existing appId to avoid breaking local app data.
            out = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
        if out != src:
            path.write_text(out, encoding="utf-8")
    # Keep binary data unchanged including textures, animations and embedded GLB maps.
    for entry in entries:
        target = root / entry["new"]
        if digest(target) != entry["sha256"] or target.stat().st_size != entry["bytes"]:
            raise RuntimeError(f"Asset content changed: {target}")
    docs = root / "docs"
    docs.mkdir(exist_ok=True)
    (docs / "asset-migration-manifest.json").write_text(json.dumps({
        "source": "eneft/Lembah-Asri", "sourceCommit": args.source_commit,
        "assets": entries, "generatedNames": generated,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Verified {len(entries)} assets, renamed {len(renames)} authored filenames; all SHA256 unchanged.")
    print("Source modules retain valid TypeScript camelCase/PascalCase conventions, config and entry filenames remain standard.")

if __name__ == "__main__":
    main()
