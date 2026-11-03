#!/usr/bin/env python3
"""Diagnose the real exported terrain Web entrypoint without touching Godot gameplay.

The editor smoke tests can pass even when /terrain-test/index.pck is invalid.
This check adds a tiny standalone HTML boot/error indicator that remains useful
when WebGL or WASM cannot initialize, rather than leaving an unexplained blank.
"""
from __future__ import annotations
import argparse
from pathlib import Path

MARKER = "<!-- LEMBAH_ASRI_TERRAIN_BOOT_AUDIT_V78 -->"
BOOT_UI = r'''
<!-- LEMBAH_ASRI_TERRAIN_BOOT_AUDIT_V78 -->
<style>
#la-boot-v78 {
    position: fixed; z-index: 100000; bottom: max(14px, env(safe-area-inset-bottom));
    left: max(14px, env(safe-area-inset-left)); right: auto; max-width: min(88vw, 370px);
    color: #fff7e4; background: rgba(30, 49, 46, .94); padding: 12px 14px;
    border: 1px solid rgba(248,239,218,.38); border-radius: 9px;
    font: 13px/1.45 system-ui, sans-serif; pointer-events: none;
}
#la-boot-v78[hidden] { display: none !important; }
#la-boot-v78 strong { display:block; margin-bottom:4px; }
#la-boot-v78 button {
    background: #e5d5b4; border: 0; color: #263b36; margin-top: 9px;
    border-radius:6px; padding:8px 12px; font: inherit; font-weight:600;
}
#la-boot-v78.la-failed { pointer-events: auto; }
</style>
<div id="la-boot-v78" role="status" aria-live="polite">
    <strong>Lembah Asri • Memuat dunia 3D</strong>
    <span id="la-boot-message-v78">Memuat karakter, terrain, dan desa…</span>
    <div><button id="la-boot-retry-v78" type="button" hidden>Muat ulang</button></div>
    <small id="la-boot-version-v78">Build: __REVISION__</small>
</div>
<script>
(function () {
    "use strict";
    const indicator = document.getElementById("la-boot-v78");
    const message = document.getElementById("la-boot-message-v78");
    const retry = document.getElementById("la-boot-retry-v78");
    const canvas = document.getElementById("canvas");
    const loader = document.getElementById("status");
    let finished = false;
    let problem = false;
    retry.addEventListener("click", function () { window.location.reload(); });
    function showProblem(detail) {
        if (problem) return;
        problem = true;
        finished = false;
        indicator.hidden = false;
        indicator.classList.add("la-failed");
        message.textContent = detail;
        retry.hidden = false;
    }
    function ready() {
        if (problem || finished || !canvas) return;
        // Godot 4.3 exports sometimes omit the optional #status element:
        // if it isn't there, the game's explicit ready signal is authority.
        // The former loader && check never hid the panel on these exports.
        const loaded = !loader || loader.style.display === "none" ||
             window.getComputedStyle(loader).display === "none";
        if (loaded && canvas.width > 0 && canvas.height > 0 &&
            window.__lembahTerrainReadyV78 === true) {
            finished = true;
            indicator.hidden = true;
            window.clearInterval(checkTimer);
        }
    }
    if (!canvas) {
        showProblem("Canvas game tidak ditemukan dalam halaman ekspor.");
        return;
    }
    canvas.addEventListener("webglcontextlost", function (event) {
        event.preventDefault();
        finished = false;
        showProblem("WebGL terputus. Tutup tab lain lalu muat ulang.");
    });
    window.addEventListener("error", function (event) {
        const label = String(event.message || event.target && event.target.src || "");
        if (/webgl|wasm|\.pck|index\.js|godot|out of memory/i.test(label)) {
            showProblem("Gagal memuat game 3D: " + label.slice(0, 110));
        }
    }, true);
    window.addEventListener("unhandledrejection", function (event) {
        const label = String(event.reason && event.reason.message || event.reason || "");
        if (/webgl|wasm|\.pck|memory|network|fetch/i.test(label)) {
            showProblem("Memuat game gagal: " + label.slice(0, 110));
        }
    });
    const checkTimer = window.setInterval(ready, 300);
    window.setTimeout(function () {
        if (!finished && !problem) {
            showProblem("Game belum berhasil tampil. Coba muat ulang; bila masih blank, periksa WebGL dan memori browser.");
        }
    }, 65000);
    ready();
}());
</script>
'''

def validate_shell(html: str) -> None:
    if "</body>" not in html or "index.pck" not in html or "index.wasm" not in html:
        raise ValueError("Not a complete Godot Web export (body/pack/wasm missing)")
    if html.count("</body>") != 1:
        raise ValueError("Godot export body close tag must be unique")

def patch(path: Path, revision: str) -> None:
    html = path.read_text(encoding="utf-8")
    validate_shell(html)
    if MARKER in html:
        raise ValueError("Boot audit already injected; refusing duplicate")
    if not revision or len(revision) > 48 or not all(c.isalnum() or c in "-_." for c in revision):
        raise ValueError("Unsafe or empty revision marker")
    widget = BOOT_UI.replace("__REVISION__", revision)
    patched = html.replace("</body>", widget + "\n</body>")
    path.write_text(patched, encoding="utf-8")
    verify(path, revision)

def verify(path: Path, revision: str) -> None:
    html = path.read_text(encoding="utf-8")
    validate_shell(html)
    if html.count(MARKER) != 1 or 'id="la-boot-v78"' not in html:
        raise ValueError("Missing/duplicated independent loading and error UI")
    if "Build: " + revision not in html:
        raise ValueError("Incorrect published GitHub commit ID")
    if 'const loaded = !loader ||' not in html:
        raise ValueError("Godot Web exports can omit #status; do not deadlock loading panel")
    if 'window.__lembahTerrainReadyV78 === true' not in html:
        raise ValueError("Canvas-only ready check can hide loader on a blank render")
    if 'window.location.reload()' not in html or "webglcontextlost" not in html:
        raise ValueError("Missing browser recovery diagnostics")
    print("V7.8 WEB BOOT AUDIT PASS: exported shell includes WASM/pack and loading-error recovery; revision", revision)

def test() -> None:
    import tempfile
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder, "index.html")
        path.write_text('<!doctype html><body><canvas id="canvas"></canvas>'
                        '<script>index.pck index.wasm</script></body>', encoding="utf-8")
        patch(path, "test1234")
        try:
            patch(path, "test1234")
        except ValueError as e:
            assert "duplicate" in str(e).lower()
        else:
            raise AssertionError("A second injection should fail")
    print("V7.8 WEB BOOT AUDIT SELFTEST PASS")

def main() -> None:
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--patch", type=Path)
    mode.add_argument("--verify", type=Path)
    mode.add_argument("--selftest", action="store_true")
    ap.add_argument("--revision", default="")
    args = ap.parse_args()
    if args.selftest:
        test()
    elif args.patch:
        patch(args.patch, args.revision)
    else:
        verify(args.verify, args.revision)

if __name__ == "__main__":
    main()
