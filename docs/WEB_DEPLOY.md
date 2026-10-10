# Mainkan melalui GitHub Pages

**Target URL:** https://eneft.github.io/Lembah-Asri/

Workflow `.github/workflows/deploy-web.yml` otomatis:
1. Mengambil source terbaru dari branch `main`.
2. Menggunakan Godot 4.3 dengan Web export templates.
3. Export single-threaded `Web` menjadi `build/web/index.html`.
4. Memeriksa `index.html`, `index.wasm`, dan `index.pck`.
5. Upload Pages artifact lalu deploy.

## Pengaturan GitHub Pages
Masuk **Settings → Pages → Build and deployment → Source: GitHub Actions** jika belum aktif.

## Browser
Gunakan browser mendukung WebGL 2 dan WebAssembly (Chrome/Edge/Firefox desktop direkomendasikan). Kontrol prototype: WASD atau panah, E untuk bicara dengan NPC. Seluruh grafis masih placeholder; referensi karakter, kamera, dan lingkungan disimpan dalam dokumen `docs/ART_DIRECTION.md`.

## Troubleshooting
- 404: pastikan **Source: GitHub Actions**, dan workflow **Build and Deploy Lembah Asri Web** berhasil.
- Halaman hitam: periksa developer console F12 untuk error WebGL dan WebAssembly.
- Tampil tetapi game belum punya sistem bertani: memang baru prototype; gameplay farming menyusul.
