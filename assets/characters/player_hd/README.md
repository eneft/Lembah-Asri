# Lembah Asri — Protagonis 2D HD (8 arah)
Sumber: turnaround HD terbaru yang disetujui pengguna, terpisah dari atlas animasi 2D terdahulu.

- Delapan file `.png` RGBA **lossless**, masing-masing **512 × 640 px**; tidak diturunkan resolusinya dan tidak dibuat JPG/WebP.
- File sumber lengkap tanpa perubahan: `turnaround_master_hd.png` (1448 × 1086 px).
- Semua memakai kaki di titik pijakan bersama, Y=592 dari kanvas.
- Godot memakai `AnimatedSprite2D` dalam `scripts/stage1_player.gd`, 3 state × 8 arah dengan **1 pose HD asli / state / arah** dan animasi langkah prosedural via `shaders/hero_gait.gdshader`.
- Gait berjalan/berlari menggerakkan area kaki dan sedikit lengan via deformasi shader, sinkron terhadap jarak perpindahan. Kekuatan langkah di-blend halus dan idle otomatis kembali ke pose asli. **Ini belum spritesheet siklus animasi gambar tangan atau skeletal rig**; tampilan estetis gerakan masih memerlukan evaluasi visual di Godot.
- Playback state 12 FPS adalah baseline `SpriteFrames` satu pose; animasi deformasi berjalan berbasis **jarak nyata yang ditempuh**: 1 siklus per 90 piksel saat berjalan dan 112 piksel saat berlari. Shader dinetralkan ketika idle/terhalang. Tidak ada pergantian resolusi PNG atau deformasi frame yang disimpan.
- Penempatan di `scripts/house_garden_stage1.gd`: scale 0.36, position Y=-97.92, character foot pada origin Node2D. Aset PNG tetap resolusi asli.
- **Lab 3D** tetap tersedia untuk perbandingan, bukan karakter utama. Atlas 2D lama disimpan untuk histori dan tidak lagi dipakai oleh hero gameplay utama.

- Source PNG tidak ditimpa, tidak di-resize maupun dikompresi ulang. Main scene dan workflow collision tetap dipertahankan.
