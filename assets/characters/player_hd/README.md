# Lembah Asri — Protagonis 2D HD (8 arah)
Sumber: turnaround HD terbaru yang disetujui pengguna, terpisah dari atlas animasi 2D terdahulu.

- Delapan file `.png` RGBA **lossless**, masing-masing **512 × 640 px**; tidak diturunkan resolusinya dan tidak dibuat JPG/WebP.
- File sumber lengkap tanpa perubahan: `turnaround_master_hd.png` (1448 × 1086 px).
- Semua memakai kaki di titik pijakan bersama, Y=592 dari kanvas.
- Godot memakai `AnimatedSprite2D` dalam `scripts/stage1_player.gd`, 3 state × 8 arah dengan **1 pose HD asli / state / arah** dan animasi langkah prosedural via `shaders/hero_gait.gdshader`.
- Gait berjalan/berlari sekarang menggerakkan area kaki dan sedikit lengan via deformasi shader saat berjalan/berlari; idle otomatis berhenti. Kecepatan dan cadence walk/run berbeda. **Ini bukan 8×2 spritesheet siklus animasi gambar tangan atau skeletal rig**, sehingga hasil visual masih perlu review di Godot untuk kualitas langkah.
- Playback state 12 FPS adalah baseline `SpriteFrames` satu pose; waktu animasi gerakan dikelola secara terpisah oleh shader per frame (`1.75` langkah-siklus/detik berjalan, `3.15` berlari).
- Penempatan di `scripts/house_garden_stage1.gd`: scale 0.36, position Y=-97.92, character foot pada origin Node2D. Aset PNG tetap resolusi asli.
- **Lab 3D** tetap tersedia untuk perbandingan, bukan karakter utama. Atlas 2D lama disimpan untuk histori dan tidak lagi dipakai oleh hero gameplay utama.

- Source PNG tidak ditimpa, tidak di-resize maupun dikompresi ulang. Main scene dan workflow collision tetap dipertahankan.
