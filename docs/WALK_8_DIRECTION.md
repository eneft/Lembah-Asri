# Run Cycle pengguna — implementasi asli

Aset sumber `Run_godot4 (1).zip` berisi sprite sheet PNG dan file Godot 4 `Run.tres` dengan 31 frame `row_1` dan satu frame diam `row_6`. `Run.tres` dipertahankan dan hanya jalur sumber teksturnya diarahkan ke `Run.webp` (resolusi **2444×3702**, alpha tetap, kualitas tinggi) untuk build Web. Tekstur PNG asli tetap tersedia di ZIP pengguna.

Shader deformasi walk lama dicabut. Animasi sekarang mengganti tekstur setiap frame secara nyata lewat `AnimatedSprite2D`, diatur oleh `stage1_player.gd`.

Keterbatasan: ZIP ini hanya mempunyai tampak **samping kanan**, bukan run cycle 8 arah. Kiri memakai flip horizontal sementara, dan gerak depan/belakang/diagonal memakai tampak samping sampai gambar arah tersebut tersedia. Mode berjalan menggunakan siklus run pada frame rate lebih pelan; belum ada walk cycle terpisah.

Frame dan pijakan: atlas 512×778, skala game 0.182, offset (0,-70.798), collider tetap. Pengujian render dibandingkan pada ukuran gameplay oleh `tests/run_cycle_render_smoke.gd`.
