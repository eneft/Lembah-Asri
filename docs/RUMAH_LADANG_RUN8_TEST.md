# Lembah Asri — Scene Test Rumah & Ladang (RUN8)

Scene ini terpisah dari gameplay lama dan memakai gambar background rumah-ladang yang dibuat tanpa karakter.

## Jalankan di Godot

- Buka **`scenes/rumah_ladang_run8_test.tscn`** dan tekan **F6** (Run Current Scene).
- **F5** tetap memulai `scenes/house_garden_stage1.tscn`, scene lama yang tidak diubah.
- Background: `assets/art/scenes/rumah_ladang_empty.png` (1672 × 941, PNG asli tanpa karakter).
- SHA-256: `7cfb92976182aa9c257954787fb7ab3f7c9cbf6298f8252944f5dc549e87d4c5`.
- Karakter: `assets/characters/run8_proportional/Run8Player.tscn`, 74 pose/8 arah.
- FPS: `run_left` dan `run_right` **8 FPS**; enam arah lainnya **10 FPS**.
- Skala karakter: **112 piksel dunia**, pivot kaki (256,708), seragam pada setiap arah.
- Kamera follow 1,25× dengan smoothing serta batas 1672×941.
- Gerak WASD/tombol panah; Shift mempercepat translasi; kontrol joystick mobile dan tombol delapan arah tersedia.
- Karakter akan menjalankan siklus RUN di tempat saat diam untuk inspeksi; klik AUTO untuk berputar arah.

## Browser test

**https://eneft.github.io/Lembah-Asri/rumah-ladang-test/**

Halaman lain dipertahankan:

- `https://eneft.github.io/Lembah-Asri/` — scene utama lama.
- `https://eneft.github.io/Lembah-Asri/run8/` — preview animasi RUN8 di test grid.
- `https://eneft.github.io/Lembah-Asri/run8-uploaded/` — preview legacy terpisah.

**Catatan:** Ini tes integrasi visual dan animasi, bukan level permainan final. Background masih berupa clean plate tunggal tanpa layer Y-sort rumah/pagar/pohon dan tanpa collision mask sungai yang final. Fitur lama, alur scene utama, WALK/IDLE, dan kamera utama tidak diubah.

Validasi otomatis melalui `tests/rumah_ladang_run8_smoke.gd` dan GitHub Actions wajib membuktikan background PNG asli termuat (bukan fallback), jumlah pose dan FPS benar, serta game lama tetap main scene.
