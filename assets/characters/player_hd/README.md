# Lembah Asri — walk sprites 8 arah (6 frame per arah)

- **Idle:** delapan PNG 512x640 asli dari turnaround yang sudah dikunci, tetap dipakai.
- **Walk/run:** 6 frame pose nyata tiap arah, kanvas 512x640/frame, PNG RGBA lossless.
- **Sumber 5 arah utama:** up, up_right, right, down_right, down.
- **3 arah kiri:** up_left, left dan down_left memakai mirror horizontal dari pasangan kanan dengan `AnimatedSprite2D.flip_h`. Idle kiri memakai artwork kiri asli, tidak di-flip.
- **Atlas:** `walk_atlases/*.png` masing-masing strip 6x512x640 = 3072x640.
- **Fps:** walk=8.5, run=12.0, idle pose tunggal.
- **Anchor:** kaki baseline Y=592 pada kanvas per frame; skala di world tetap 0.36, offset Y=-97.92.
- **Penting:** shader deformasi kaki `hero_gait.gdshader` tidak dipakai lagi. Hanya shader pembersihan putih di lantai `hero_floor_cleanup.gdshader` yang tetap digunakan, tanpa perubahan bentuk tubuh.
- **Master:** body/face/clothes baseline tidak diganti. Semua gambar frame berjalan mengikuti pose dari sheet pengguna; tiap frame diambil tanpa stretch per sumbu.
- **Tes:** `tests/smoke_test.gd` wajib memeriksa jumlah frame, atlas 512x640 dan mirror kiri, transisi idle/walk/run, serta collision dan dialog.
- **Batasan:** sumber pose walk dihasilkan AI dan masih perlu penilaian kualitas visual/ritme gerakan di scene nyata; smoke test tidak membuktikan estetika sempurna.
