# Walk 16-frame / 8 arah — Lembah Asri

Lima sheet sumber 4x4 (up, up_right, right, down_right, down) dibagi menjadi enam belas frame 512×640, masing-masing di dalam atlas 2048×2560. Tiga arah kiri dicerminkan secara horizontal dari kanan.

Idle memakai frame 16 dari atlas yang sama agar gaya karakter tidak berubah saat berhenti; aset PNG master 8 arah tidak ditimpa. FPS walk 12, run 16 memakai walk frames (run bukan animasi khusus). Shader deformasi walk lama tidak digunakan.

**Batasan kualitas:** gambar sumber AI adalah 1122×1402 untuk 16 karakter, sehingga resolusi visual native per karakter jauh di bawah 512×640. Atlas 512×640 adalah canvas hasil upscale, bukan peningkatan detail asli. Tidak semua sheet berisi gait 16 pose yang progresif/anatomis konsisten. Uji visual in-game masih diperlukan dan foot-lift untuk semua frame belum bisa dijamin hanya melalui tes script.
