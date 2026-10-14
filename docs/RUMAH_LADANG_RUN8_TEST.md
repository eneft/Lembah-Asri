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
- **Fix background getar (14 Oktober 2026):** pergerakan RUN8 pada scene test kini dihitung di render `_process(delta)`, sesuai `Camera2D.process_callback = IDLE`; bukan lagi `_physics_process` (60 Hz). Delta render abnormal dibatasi 1/30 detik agar frame drop tidak menggeser background secara mendadak. Gambar background dan animasi RUN tidak diubah.
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

## IDLE 8 arah (pembaruan)

Scene test kini memakai `scripts/rumah_ladang_runner_idle8.gd`, controller turunan RUN8 yang terisolasi. Saat bergerak: animasi RUN8 (74 frame) seperti sebelumnya, kiri/kanan 8 FPS, arah lainnya 10 FPS. Saat melepas kontrol: RUN langsung berhenti dan tampil pose IDLE sesuai arah terakhir, termasuk arah diagonal. Tombol delapan arah dan AUTO ketika diam menampilkan IDLE alih-alih memaksa RUN terus.

IDLE bersumber dari 5 PNG user-approved di `assets/characters/idle_uploaded/`: `front.png`, `front_right.png`, `right.png`, `back_right.png`, `back.png`; 3 arah kiri dicerminkan. Satu pose statis per arah (bukan frame berlari yang dibekukan). Proporsi dan foot pivot disesuaikan pada pergantian RUN/IDLE, sementara sumber atlas RUN8 serta semua gameplay lama tidak disentuh. Verifikasi tes otomatis mencakup 8 IDLE, 8 RUN, mirroring, dan transisi tombol gerak→diam.

## IDLE8 Baru — sumber resmi scene test (14 Oktober 2026)

**Sumber lama `assets/characters/idle_uploaded` tidak dipakai lagi di scene test.** Delapan pose IDLE baru diproses dari delapan gambar masing-masing arah, tanpa mirroring atau menggunakan pose lari yang dibekukan.

- Atlas transparan: `assets/characters/idle8_new/Idle8_Normalized.png` (2048 × 1536, RGBA asli)
- Resource Godot: `assets/characters/idle8_new/Idle8_SpriteFrames.tres`
- 8 pose nyata dengan urutan `down, down_right, right, up_right, up, up_left, left, down_left`
- Semua frame **512 × 768** (4 × 2 atlas), tinggi gambar karakter **640 piksel**, pivot kaki **(256, 708)**
- Skala karakter dunia = **112/640** pada IDLE maupun RUN; tidak ada resize/pivot saat berpindah animasi
- SHA-256 PNG: `5fa6c2ca4f4f23c8f13e2a611626fc35a212cb4c7d52d745bdcf2eff798b0445`
- RUN8 atlas lama, F5 scene utama, WALK asli, kamera, dan HUD lama tidak berubah.
