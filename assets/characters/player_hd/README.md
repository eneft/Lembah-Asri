# Lembah Asri — Protagonis 2D HD (8 arah)
Sumber: turnaround HD terbaru yang disetujui pengguna, terpisah dari atlas animasi 2D terdahulu.

- Delapan file `.png` RGBA **lossless**, masing-masing **512 × 640 px**; tidak diturunkan resolusinya dan tidak dibuat JPG/WebP.
- File sumber lengkap tanpa perubahan: `turnaround_master_hd.png` (1448 × 1086 px).
- Semua memakai kaki di titik pijakan bersama, Y=592 dari kanvas.
- Godot memakai `AnimatedSprite2D` dalam `scripts/stage1_player.gd`, 3 state × 8 arah; sekarang **1 pose statis / state / arah**.
- **Tidak ada siklus kaki walk/run HD yang asli dalam turnaround ini.** Input WASD/arrow, Shift (run), 8 arah, collision, kamera, dan dialog tetap bekerja, tetapi walk/run masih pose bergerak tanpa siklus kaki.
- Playback state diset 12 FPS sebagai dasar animasi tahap berikutnya.
- Penempatan di `scripts/house_garden_stage1.gd`: scale 0.36, position Y=-97.92, character foot pada origin Node2D. Aset PNG tetap resolusi asli.
- **Lab 3D** tetap tersedia untuk perbandingan, bukan karakter utama. Atlas 2D lama disimpan untuk histori dan tidak lagi dipakai oleh hero gameplay utama.
