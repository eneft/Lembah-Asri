# Lembah Asri — Hujan dan Percikan Air (Godot 4.3)

Efek reusable: `res://scenes/weather/rain_weather.tscn`, instanced pada scene utama dan `scenes/rumah_ladang_run8_test.tscn`.

- **RainBack**: streak rintik ringan di belakang avatar, z=-5.
- **RainFront**: rintik lebih dekat, z=12.
- **GroundSplashes**: crown splash dua semburan kecil dan ring yang memudar di jalur/halaman terbuka, bukan atap bangunan, z=14.
- **RiverRipples**: ring dan percikan hujan di atas air, diposisikan dengan sampling alpha **aset sungai yang asli** `assets/art/separated/river_water.webp` pada (1058,288), z=15.
- **Perbaikan lag Oktober 2026:** render tidak lagi menggambar ratusan `draw_arc` dan `draw_line` setiap frame. Empat layer memakai masing-masing satu `MultiMeshInstance2D` (GPU instancing), sprite kecil dibuat hanya saat pertama dimuat. Hujan diperbarui maksimal **30 FPS**, percikan/ripple maksimal **20 FPS** (tidak mengubah kecepatan karakter/kamera). Jumlah partikel dasar sekarang 165 + 145 hujan dan 75 + 65 splash, dan browser menjalankan 75% jumlah itu. Saat hujan OFF, layer dan proses update dimatikan. Tidak mengubah shader air, collision, background, pivot karakter, ukuran sprite, HUD utama, scene/atlas RUN8 dan IDLE8.
- Default hujan **aktif**. Preview Rumah-Ladang memiliki checkbox **Hujan + percikan air** untuk pengguna mobile/desktop. Scene utama bisa toggle dengan tombol R.
- `RainWeather.intensity` adalah pilihan untuk tingkat hujan; untuk scene baru drag/instance `scenes/weather/rain_weather.tscn`.
- Smoke khusus pada `tests/rain_weather_smoke.gd` menguji kedua scene, empat layer, seed percikan air, kontrol toggle, player idle dan main collision. Dipasang pada Godot CI dan Web export.

Browser: https://eneft.github.io/Lembah-Asri/rumah-ladang-test/

- Test validasi render GPU: `tests/rain_render_smoke.gd` mengambil hasil gambar sebenarnya pada renderer Compatibility, lalu membandingkan sebelum/sesudah hujan OFF.
