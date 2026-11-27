#!/usr/bin/env python3
"""Read-only repository size audit. No dependencies, network, or Git mutations."""
import argparse
import collections
import os
import subprocess
import sys

MIB = 1024 * 1024

def git(*args, data=None):
    return subprocess.run(
        ["git", *args], input=data, stdout=subprocess.PIPE, check=True
    ).stdout

def tree(ref):
    rows = []
    for entry in git("ls-tree", "-r", "-l", "-z", ref).split(b"\0"):
        if not entry:
            continue
        meta, path = entry.split(b"\t", 1)
        mode, kind, oid, size = meta.split()
        if kind == b"blob":
            rows.append((oid.decode(), int(size), os.fsdecode(path)))
    return rows

def mib(size):
    return f"{size / MIB:,.2f} MiB"

def safe(text):
    return text.replace("|", "\\|").replace("\n", " ").replace("\r", " ").replace("`", "'")

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", help="Compare new blobs against this revision")
    parser.add_argument("--warn-mib", type=int, default=10)
    parser.add_argument("--max-new-mib", type=int, default=50)
    args = parser.parse_args()
    if args.warn_mib < 0 or args.max_new_mib < args.warn_mib:
        parser.error("Thresholds must be nonnegative and max >= warning")
    if git("rev-parse", "--is-shallow-repository").strip() == b"true":
        parser.error("Full history required: fetch-depth: 0 or git fetch --unshallow")
    rows = tree("HEAD")
    head = {}
    groups = collections.Counter()
    for oid, size, path in rows:
        head.setdefault(oid, (size, []))[1].append(path)
        parts = path.split("/")
        group = "/".join(parts[:2]) if len(parts) > 2 else parts[0]
        groups[group] += size
    # Paths are examples from rev-list, not an exhaustive historical path map.
    paths = {}
    for line in git("rev-list", "--objects", "--all", "HEAD").splitlines():
        oid, _, path = line.partition(b" ")
        paths[oid.decode()] = os.fsdecode(path)
    requested = ("\n".join(paths) + "\n").encode()
    history = {}
    for line in git("cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)", data=requested).splitlines():
        fields = line.split()
        if len(fields) != 3:
            raise RuntimeError("Missing or invalid Git object; cannot audit full history")
        oid, kind, size = fields
        if kind == b"blob":
            history[oid.decode()] = int(size)
    if not head.keys() <= history.keys():
        raise RuntimeError("HEAD blobs absent from history inventory")
    old = {oid: size for oid, size in history.items() if oid not in head}
    print("# Repository size audit\n")
    print(f"- HEAD files: {len(rows):,}")
    print(f"- HEAD file bytes (including duplicate paths): {mib(sum(x[1] for x in rows))}")
    print(f"- HEAD unique blob bytes: {mib(sum(x[0] for x in head.values()))}")
    print(f"- Reachable blob bytes across fetched refs and HEAD: {mib(sum(history.values()))}")
    print(f"- Reachable blobs absent from HEAD: {len(old):,} / {mib(sum(old.values()))}")
    print("- Logical uncompressed bytes, not GitHub's packed repository size.")
    print("- History-only blobs may still be required by other branches or tags.")
    print("\n## Largest directories in HEAD\n\n| Directory | Bytes |\n|---|---:|")
    for group, size in groups.most_common(20):
        print(f"| {safe(group)} | {mib(size)} |")
    print("\n## Largest files in HEAD\n\n| Path | Bytes |\n|---|---:|")
    for _, size, path in sorted(rows, key=lambda x: -x[1])[:25]:
        print(f"| {safe(path)} | {mib(size)} |")
    print("\n## Identical blobs at multiple HEAD paths\n\n| Blob size | Paths |\n|---:|---|")
    for size, names in sorted(head.values(), key=lambda x: -x[0]):
        if len(names) > 1 and size >= MIB:
            print(f"| {mib(size)} | {safe('; '.join(names))} |")
    print("\n## Largest historical blobs absent from HEAD\n\n| Example path | Object ID | Bytes |\n|---|---|---:|")
    for oid, size in sorted(old.items(), key=lambda x: -x[1])[:25]:
        print(f"| {safe(paths[oid])} | {oid} | {mib(size)} |")
    print("\n## Local object storage\n\n```text")
    print(git("count-objects", "-vH").decode().strip())
    print("```")
    if args.base:
        base = {oid for oid, _, _ in tree(args.base)}
        new = [(oid, size, names) for oid, (size, names) in head.items() if oid not in base]
        large = [x for x in new if x[1] >= args.warn_mib * MIB]
        blocked = [x for x in new if x[1] > args.max_new_mib * MIB]
        print(f"\n## New blobs vs base ({safe(args.base)})\n")
        print(f"Warning threshold: {args.warn_mib} MiB; maximum new blob: {args.max_new_mib} MiB.")
        if large:
            for _, size, names in sorted(large, key=lambda x: -x[1]):
                print(f"- {'BLOCK' if size > args.max_new_mib * MIB else 'WARN'}: {mib(size)} — {safe('; '.join(names))}")
        else:
            print("- No new blobs at or above the warning threshold.")
        if blocked:
            print("\nOversized new blobs: optimize or use a verified asset-storage migration before merging.")
            return 2
    return 0

if __name__ == "__main__":
    sys.exit(main())
