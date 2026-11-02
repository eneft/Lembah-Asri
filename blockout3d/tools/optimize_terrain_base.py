#!/usr/bin/env python3
"""Generate the clean, gameplay-ready Lembah Asri V3 terrain GLB.

Keep this historical entrypoint because both existing GitHub Actions workflows
call it. V3 deliberately REPLACES the reprojected photogrammetry faces, not
merely their vertex Y values. It also bakes the only texture the renderer uses.
"""
from terrain_v3_builder import main

if __name__ == "__main__":
    main()
