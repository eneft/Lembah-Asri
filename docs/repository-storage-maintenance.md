# Repository storage maintenance

## Baseline (2026-11-27, main before maintenance)
GitHub repository size: 388900 KiB (about 380 MiB). The recursive tree contained 552 files, 530401839 logical bytes (506 MiB), and 500980796 unique blob bytes (478 MiB). The latter two are uncompressed and cannot be compared directly to the packed GitHub size.

- `blockout3d/assets`: about 189 MiB (legacy Godot 3D).
- `web/public`: about 124 MiB (Three.js runtime candidates).
- `assets/characters`: about 95 MiB (legacy 2D).
- `assets/source_psd`: about 43 MiB.
- `assets/art`: about 26 MiB.
- Root Running FBX duplicates the Godot FBX exactly; removing one path does not remove the shared Git object.

## Routine check
Use a complete clone, then run `python3 tools/audit_repo_size.py`. Compare a proposed change with `python3 tools/audit_repo_size.py --base origin/main`. The PR workflow reports large new unique blobs (10 MiB warning, over 50 MiB failure), current tree sizes, duplicate paths and reachable historical objects. It is a CI check, not automatically a required branch-protection rule. Reports measure only fetched refs, not inaccessible or unadvertised remote refs.

## Migration checklist (not performed by this PR)
1. Inventory references from runtime, scripts, tests and CI. Classify legacy assets and preserve original source, UVs, textures, materials, animation and collisions. Do not assume everything outside web is unused.
2. Create and verify an independent backup or archive outside the repository before removing legacy assets. A branch or tag in this same repository does not release its reachable objects.
3. Preserve active Three.js paths. For each proposed removal or asset optimization, verify the production build, asset hashes or justified visual differences, browser gameplay and scene-specific tests.
4. Evaluate Git LFS storage/bandwidth and enable LFS checkout in every relevant CI/build workflow before converting any assets to pointers. Verify binary retrieval in clean clones and deployment. Do not blanket-track all images or models without a migration test.
5. For actual historical reduction, perform a rehearsed migration or filter-repo rewrite on a disposable mirror with all refs inventoried, backups checked, and affected branches/tags/PRs coordinated. Compare packed sizes, test a fresh clone, and obtain explicit approval for any force update. Old server-side refs and retention may delay reclamation. Never force-update main as part of routine asset cleanup.

This change does not move, delete, compress, or replace any assets, activate LFS, rewrite history, or change deployment behavior.
