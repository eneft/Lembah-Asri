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


## Kalibrasi hujan tampak lebih deras (14 Oktober 2026)

Karena user menilai optimasi awal tampak seperti gerimis, density visual dikalibrasi tanpa kembali ke per-particle `_draw`: RainBack **230** dan RainFront **220** instance (browser **90%**, yaitu ±207 + 198 rintik). Tebal streak **2.8 px** dan panjang **27 px** pada mesh sumber, opacity/ramp meningkat dan arah angin sedikit lebih jelas. Splash di halaman (**75**) dan riak sungai (**65**) tidak diubah. Semua tetap hanya **empat draw batch** dan update cap **30/20 Hz**, sehingga tidak menambah node/physics, tidak menyentuh kamera, karakter, atau background. CI visual mengetes agar area hujan di frame benar-benar tampak lebih padat (bukan sekadar sukses memuat scene).

**Pengukuran visual:** pembanding render versi ringan sebelumnya menghasilkan 101 piksel hujan terdeteksi pada viewport 640×360. Tes revisi membutuhkan minimal 145 piksel di viewport yang sama; performa FPS nyata tetap perlu divalidasi di perangkat pengguna.


## Genangan, pantulan dan footstep splash (14 Oktober 2026)

Scene utama dan Rumah-Ladang test: **12 genangan** berbentuk elips pseudo-isometrik di jalur halaman. Tekstur dibuat prosedural sekali saja, dengan tepi lembut dan highlight refleksi langit; update kilau 12 Hz. Percikan hujan di tanah kini dibuat lebih terang dan besar (125 native / 103 Web) agar tampak jelas di atas latar hijau, tetap menggunakan satu GPU MultiMesh batch pada 20 Hz. Efek injakan muncul **hanya ketika kaki karakter masuk area genangan sambil berjalan atau berlari** (trigger posisi kaki + cooldown 0,16 detik + jarak minimum 8 px). Ring-buffer 10 efek injakan, satu batch GPU, tidak menambah physics/collision/perhitungan berat. Total enam layer GPU batched, bukan ratusan node/DrawCalls. Saat toggle cuaca mati, animasi dan permukaan genangan disembunyikan bersamaan. Tes `tests/puddle_render_smoke.gd` memeriksa piksel hasil render asli pada renderer Compatibility, termasuk 3 efek independen.


## Dynamic ground rain impacts

GroundSplashes now recycles each pooled impact at a different random ground coordinate after a short independent lifetime. Three size categories (micro 65%, medium 25%, accent 10%) and independent fade timing create natural non-repeating rainfall. GPU MultiMesh instancing and the 20 Hz effect update remain unchanged. Roof exclusions use the existing exposed-soil polygon. River ripples, puddles and footstep splashes are unchanged. CI checks position recycling and real rendered-frame differences.
