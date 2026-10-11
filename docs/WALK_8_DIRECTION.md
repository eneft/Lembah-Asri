# Lembah Asri — Walk cycle prosedural 8 arah (prototype)

Sumber animasi adalah **delapan PNG RGBA 1152 × 1632 asli** pada `assets/characters/player_base_8dir/`. Setiap arah memakai gambarnya sendiri, tanpa flip, desain ulang, crop tambahan, atau perubahan alpha asli.

## Implementasi Godot

- `scripts/stage1_player.gd` membuat 24 animasi (idle/walk/run × 8 arah), mengatur 12 indeks fase siklus jalan dan 12 sample per detik.
- `shaders/hero_environment_grade.gdshader` menggeser sampel bagian paha, tulang kering, dan sepatu secara berlawanan dengan fungsi sinus, menambah foot clearance serta ayunan lengan berlawanan. Gait shader juga menjaga color grading yang sudah disetujui.
- `assets/materials/hero_environment_grade.tres` tetap dapat digunakan untuk mengubah pencahayaan dan saturasi.
- Ketika pemain berhenti, `gait_strength = 0`, kembali persis ke pose idle sumber. Berlari memakai 16 sample/detik dan amplitudo sedikit lebih besar.
- Pergantian arah saat bergerak mempertahankan siklus langkah; arah kiri memakai PNG kiri yang berbeda dan **tidak flip**.
- Scale karakter `0.105` dan titik pijakan `(0, -80.745)` tetap sama; collision, kamera, dan kontrol mobile tidak diubah.

## Batasan

Ini **walk prototipe procedural di GPU**, bukan 12 gambar baru yang digambar manual untuk tiap arah (96 gambar). Karena PNG sumber adalah pose diam utuh, deformasi pixel tidak bisa menampilkan anatomi tersembunyi di samping. Pergerakan kaki, khususnya side-view, wajib dievaluasi visual di Godot sebelum dianggap walk final. Setelah disetujui, artwork walk frame-by-frame anatomis bisa menggantikan shader tanpa mengubah controller 8 arah.

## Uji

Jalankan `godot --path .` atau build Web. Tekan WASD/panah di semua delapan arah, berhenti mendadak, ganti arah saat melangkah, lalu tahan Shift. Evaluasi urutan bergantian left/right, foot sliding, dan apakah deformasi tangan/kaki terlalu kuat. `tests/smoke_test.gd` memverifikasi shader, transisi, pemetaan arah, dan reset saat idle.
