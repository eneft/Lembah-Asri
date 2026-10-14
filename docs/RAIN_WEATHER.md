# Lembah Asri — Hujan dan Percikan Air (Godot 4.3)

Efek reusable: `res://scenes/weather/rain_weather.tscn`, instanced pada scene utama dan `scenes/rumah_ladang_run8_test.tscn`.

- **RainBack**: streak rintik ringan di belakang avatar, z=-5.
- **RainFront**: rintik lebih dekat, z=12.
- **GroundSplashes**: crown splash dua semburan kecil dan ring yang memudar di jalur/halaman terbuka, bukan atap bangunan, z=14.
- **RiverRipples**: ring dan percikan hujan di atas air, diposisikan dengan sampling alpha **aset sungai yang asli** `assets/art/separated/river_water.webp` pada (1058,288), z=15.
- Render lewat CanvasItem._draw dalam _process untuk menghindari beda ritme physics/render yang pernah menyebabkan background getar. Tidak pakai fullscreen texture baru ataupun merubah shader air, collision, background, pivot karakter, ukuran sprite, HUD utama, scene/atlas RUN8 dan IDLE8.
- Default hujan **aktif**. Preview Rumah-Ladang memiliki checkbox **Hujan + percikan air** untuk pengguna mobile/desktop. Scene utama bisa toggle dengan tombol R.
- `RainWeather.intensity` adalah pilihan untuk tingkat hujan; untuk scene baru drag/instance `scenes/weather/rain_weather.tscn`.
- Smoke khusus pada `tests/rain_weather_smoke.gd` menguji kedua scene, empat layer, seed percikan air, kontrol toggle, player idle dan main collision. Dipasang pada Godot CI dan Web export.

Browser: https://eneft.github.io/Lembah-Asri/rumah-ladang-test/
