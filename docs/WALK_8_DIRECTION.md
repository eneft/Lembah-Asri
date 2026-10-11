# Run Cycle pengguna — implementasi asli

Aset sumber `Run_godot4 (1).zip` berisi sprite sheet PNG dan file Godot 4 `Run.tres` dengan 31 frame `row_1` dan satu frame diam `row_6`. `Run.tres` dipertahankan dan hanya jalur sumber teksturnya diarahkan ke `Run.webp` (resolusi **2444×3702**, alpha tetap, kualitas tinggi) untuk build Web. Tekstur PNG asli tetap tersedia di ZIP pengguna.

Shader deformasi walk lama dicabut. Animasi sekarang mengganti tekstur setiap frame secara nyata lewat `AnimatedSprite2D`, diatur oleh `stage1_player.gd`.

Keterbatasan: ZIP ini hanya mempunyai tampak **samping kanan**, bukan run cycle 8 arah. Kiri memakai flip horizontal sementara, dan gerak depan/belakang/diagonal memakai tampak samping sampai gambar arah tersebut tersedia. Mode berjalan menggunakan siklus run pada frame rate lebih pelan; belum ada walk cycle terpisah.

Frame dan pijakan: atlas 512×778, skala game 0.182, offset (0,-70.798), collider tetap. Pengujian render dibandingkan pada ukuran gameplay oleh `tests/run_cycle_render_smoke.gd`.

## Penyempurnaan gameplay (audit 11 Oktober 2026)

- Aset asli `Run.tres` masih memuat 31 frame, tapi siklus `walk_*` dan `run_*` kini hanya mengambil frame indeks **14–27**. Frame antisipasi (0–13) dan pengereman (28–30) tidak ikut loop, sehingga tidak ada jeda paksa saat kembali ke awal.
- Durasi sumber pada bagian tengah adalah 0.5 unit/frame. Setelan animasi Godot `WALK_FPS=6.0` menghasilkan ~12 fps tampilan; `RUN_FPS=13.0` menghasilkan ~26 fps tampilan, dan kecepatan karakter lari naik ke 325 unit/detik. Frame terakhir dipersingkat 22% agar seam tidak tertahan.
- Tambahkan `FootContactShadow` radial tipis di belakang sepatu dan pulihkan sebagian kontras/saturasi karakter via material, **tanpa mengubah atlas maupun footprint collider**.
- Uji render sekarang mencakup frame 14, 16, 20, 24, 27 serta seam 27→14.
- Walk masih *adaptasi gerakan run*, belum walk cycle anatomis yang dibuat khusus. Seluruh arah selain kanan/kiri juga masih memakai profil samping sementara.
