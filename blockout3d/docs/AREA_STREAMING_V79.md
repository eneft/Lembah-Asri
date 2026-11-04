# Lembah Asri V7.9 — streaming visual per wilayah

**Scene aktif:** \`/terrain-test/\` / \`blockout3d/scenes/terrain_base_test.tscn\`.

## Pemisahan
\`area_v79.tscn\` di-instantiate **lima kali** berdasarkan master V7.3:
- \`desa_inti\`
- \`pekarangan_barat\`
- \`balai_desa\`
- \`tepi_sungai\`
- \`akses_pesisir\`

Masing-masing memegang \`Houses\`, \`Plants\` dan \`Foliage\` sebagai subtree terpisah. Seluruh 17 rumah, termasuk rumah masa kecil dan dua rumah nelayan yang berlainan, dipindahkan tanpa mengubah global transform atau aset sumber. Data bangunan tetap berasal dari \`settlement_v7.json\`.

Sebelum V7.9, seluruh daun dan rumput digabungkan ke beberapa \`MultiMesh\` skala pulau, sehingga Godot tidak bisa menyembunyikan satu wilayah tanpa menyembunyikan semuanya. V7.9 membagi tiap \`MultiMesh\` berdasarkan zona, **tanpa menggandakan instance** dan dengan UV/material/shadow asli yang sama. Akar/metadata vegetasi tetap kompatibel dengan perhitungan total.

## Pengaturan jarak

\`terrain_v79_area_streamer.gd\` memeriksa posisi karakter tiap 0,36 detik. Wilayah aktif pada jarak sekitar 39 m dari batas wilayahnya; nonaktif setelah melewati 55 m (histeresis). Jarak ditambah secara bertahap jika pemain memperbesar zoom kamera. Perpindahan cepat lewat tombol Pantai / Kembali Desa menyegarkan area langsung.

**Yang disembunyikan:** render subtree rumah dan flora yang jauh.
**Yang tetap ada:** collision rumah dan batang pohon, terrain utama dan collision presisi, sungai, laut, jalan, kedua jembatan, pemain, kamera dan kontrol. Jadi tidak ada lubang collision saat pindah area.

**Batasan:** ini optimasi **render culling** dengan lima PackedScene visual; bukan pengunduhan aset jaringan bertahap atau pelepasan tekstur GLB dari RAM. Pulau dan air tetap scene kontinu agar tidak ada seam atau jeda loading. Langkah lain bila RAM iPhone masih menjadi bottleneck ialah memecah terrain atlas/asset load pada tahap berikutnya, setelah diukur dengan profiler nyata.

## Audit wajib

\`\`\`bash
python3 blockout3d/tools/restore_fisherman_uv_glb.py
python3 -m pip install Pillow
python3 blockout3d/tools/optimize_terrain_base.py
godot --headless --path blockout3d --editor --quit
godot --headless --path blockout3d --script res://tests/terrain_v79_streaming_smoke.gd
\`\`\`

Pengujian baru memeriksa 5 scene independen, 17 bangunan, kesamaan jumlah MultiMesh instance, tukar visibilitas barat/pesisir, dan collision rumah yang tersembunyi. CI tetap menjalankan tes existing, tes WebGL Chromium dan deploy Pages.
