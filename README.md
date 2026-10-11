# Lembah Asri

**Pulang ke kenangan, hidup di desa.**

Game simulasi kehidupan dan pertanian bernuansa desa Indonesia. Dibangun dengan Godot 4 sebagai proyek baru yang **terpisah** dari repositori lama `Lembah-sari`.

## Cerita
Seorang pemuda kembali dari kota ke rumah masa kecilnya di desa. Rumah itu lama kosong dan tidak dirawat. Berawal dari kerinduan, ia memutuskan menetap, memperbaiki rumah, bercocok tanam, memancing, memelihara hewan, berinteraksi dengan warga, dan mungkin membangun keluarga. **Bukan** cerita tentang misi besar membangun desa.

## Baseline yang dikunci
- **Kamera gameplay:** 3/4 dari atas (elevated three-quarter), melihat area cukup luas; karakter relatif kecil dibanding lingkungan, terutama di pasar.
- **Karakter utama:** sprite runner yang diunggah pengguna (jaket abu-abu, ransel cokelat), menggantikan karakter lama. Desain tak diubah.
- **Desa Indonesia:** rumah genteng, sawah dan irigasi, pasar desa, kelapa, pisang, pepaya, bambu, sungai, musim hujan/kemarau.
- **Gaya:** cozy illustrated **2D**, dengan karakter utama proporsi tubuh SD yang disetujui (bukan chibi), ukuran konsisten terhadap lingkungan. Gameplay hanya 2D, tanpa preview 3D.
- **Gameplay wajib:** kebun, sawah, ternak, pets, interaksi NPC; dikembangkan bertahap.

## Status
Stage 1 sekarang memakai karakter *runner* pengguna dari ZIP Run_godot4 (1).zip. Sumber `Run.tres` tetap menyimpan **31 frame asli**, tetapi loop gameplay sekarang menggunakan **14 frame inti (indeks 15–28)** tanpa frame mulai/berhenti yang menyebabkan jeda. Idle tetap 1 frame. Ini bukan shader deformasi. Atlas penuh 2444×3702 disimpan sebagai WebP kualitas tinggi dengan alpha untuk Web. Kanan memakai gambar asli, kiri mirror sementara. Aset ZIP hanya menyediakan tampak kanan, jadi **belum ada run cycle asli untuk 8 arah**; arah lain sementara memakai profil runner agar karakter tidak berganti identitas. Walk masih berasal dari pose lari yang sama (belum memiliki walk cycle tersendiri), tetapi sekarang loop-nya dipangkas menjadi mulus: sekitar 12 frame visual/detik untuk walk dan 26 frame/detik untuk run. Shift menaikkan kecepatan karakter menjadi 325 unit/detik. Bayangan pijakan lunak dan color grading membantu keterbacaan karakter. Revisi visual berikutnya memperbesar karakter ke skala 0.222 dan membuat HUD interaktif Godot, bukan gambar datar. Mobile joystick/LARI tetap aktif, NPC dan preview 3D tetap dihapus.

## Background Stage 1 (11 Oktober 2026)
Ilustrasi dasar `assets/art/layers/background_base.png` sekarang adalah **rumah masa kecil yang ditinggalkan lebih dari 10 tahun**, halaman luas belum ditanami, jalan setapak menuju jembatan, sungai, serta langit dan desa di kejauhan. Ukuran 1672 × 941 dan piksel gambar sumber tetap sama. Aset layer rumah, kandang, tanaman, dan foliage lama disimpan tetapi disembunyikan untuk mencegah gambar rangkap. Collision kebun dan interaksi tomat lama tidak berlaku selama menggunakan full-scene background; kontrol gerak dan karakter tetap aktif. NPC Bu Sari, label dialog, HUD prototipe, dan preview 3D dihapus dari Stage 1.

## Penyesuaian pencahayaan karakter (Godot)

Pencahayaan dan tone karakter sekarang menggunakan `ShaderMaterial` 2D pada sprite gameplay, **bukan mengganti atau mengompresi gambar animasi**. Shader menjaga alpha asli dan berlaku pada semua arah. Preset terbaru memulihkan saturasi dan kontras secukupnya agar karakter tidak tenggelam secara visual, sambil mempertahankan sinar hangat dan pantulan hijau halus.

Untuk menyetel hasil visual langsung di Godot, buka `assets/materials/hero_environment_grade.tres`, lalu ubah `saturation`, `contrast`, `shadow_fill`, `sun_warmth`, atau `green_bounce`. Implementasi shader: `shaders/hero_environment_grade.gdshader`. Ini merupakan *render-only grade*, bukan lampu dinamis; tidak mengubah posisi, gerak, skala, collision, tekstur, atau background.

## Menjalankan
1. Gunakan Godot 4.3 atau lebih baru.
2. Buka `project.godot` dan jalankan proyek (F5).
3. Desktop: WASD/panah untuk berjalan dan **Shift** untuk berlari. Belum ada objek interaktif di Stage 1.
4. Mobile: putar HP ke posisi **landscape**; geser **joystick kiri** dan tahan **LARI** di kanan sambil bergerak. Tombol responsif mengikuti ukuran layar dan mendukung dua jari atau lebih.
5. Demo Web terbaru: https://eneft.github.io/Lembah-Asri/

Dokumen acuan: `docs/ART_DIRECTION.md`, `docs/GAME_DESIGN.md`, `docs/ROADMAP.md`.

Repo baru ini tidak memodifikasi `eneft/Lembah-sari` maupun `eneft/sidokter`.

Detail keterbatasan arah: `docs/WALK_8_DIRECTION.md`.

## Referensi visual UI & scene (prototipe tahap 1)

Referensi tampilan rumah-kebun penuh diperlakukan sebagai **arah seni untuk rumah yang kelak telah dirawat**, bukan foto mentah untuk mengganti lingkungan saat pertama kali pulang. Gambar contoh mengandung karakter, hewan, NPC, tanaman, dan HUD yang sudah dibakar ke satu foto; mengimpornya langsung akan membuat semua unsur itu palsu dan tidak interaktif. Stage 1 tetap memakai background rumah 10+ tahun ditinggalkan dalam PNG bersih; kini `village_background_grade.gdshader` mengatur warna lingkungannya terpisah dari karakter dan UI.

`scripts/gameplay_hud.gd` menggambar UI **secara runtime**: potret karakter, jam yang maju, koin riil awal 0, minimap dengan titik pemain yang mengikuti posisi, bar alat 1-8, panel inventori (masih kosong), peta, dan menu. Tidak ada hitungan hasil kebun, ternak atau kemampuan alat yang direkayasa. Tombol I, M, Esc, 1-8 dan sentuhan hotbar tersedia. Ikon alat sementara berbentuk label; sistem kebun/ternak/NPC serta UI final akan dibuat sebagai scene/gameplay berlapis pada fase berikutnya.

Karakter sumber run cycle 31 frame tetap utuh; skala gameplay diperbesar dari 0.182 ke **0.222** dengan anchor kaki dihitung ulang, tanpa mengubah collision. Kontrol lari mobile, kamera, dan area jalan tidak dibangun ulang.

## Scene layering — tahap pertama

Keputusan arsitektur: **tetap Godot 4 Camera2D elevated 3/4**, bukan Camera3D. World mengaktifkan `y_sort_enabled`; Player sekarang `z_index=0` agar prop baru nanti dapat menutup/ditutup karakter secara natural berdasarkan pijakan Y. Ilustrasi dasar masih satu gambar (bukan aset bangunan/pohon yang sudah diekstrak).

Latar belakang sekarang memakai blur 5-tap ringan + saturasi/kontras lebih soft hanya untuk gambar lingkungan; karakter dan UI tetap detail. `RiverWaterfallSurface` adalah **lapisan animasi air sementara**, memanfaatkan tekstur yang sama, dipotong ke pojok kanan-bawah dan dibatasi mask warna biru/cyan sehingga pagar tidak ikut bergerak. Ini belum mask sungai sempurna; akan diganti ketika potongan gambar sungai/air terjun benar-benar tersedia.

Roadmap clean-plate, pemecahan rumah/pagar/pohon/kandang/jembatan, collision, dan mask air akurat: `docs/ENVIRONMENT_LAYERING_PLAN.md`. Semua bagian gameplay yang sudah bekerja tetap ada.

## Stage 2: aset environment terpisah (implementasi)

World kini memakai `assets/art/separated/terrain_clean.webp` sebagai ground. Tersedia lima **sprite alpha mandiri**: rumah, kandang, pohon pisang foreground, pagar depan, dan railing jembatan, masing-masing ditempatkan melalui `Node2D` pivot Y-sorting. Ini menggantikan objek identik yang sebelumnya tergambar permanen pada gambar latar. `assets/art/layers/background_base.png` asli tetap disimpan sebagai rollback (tidak ikut digambar). Sky, desa jauh, tebing, bebatuan, dek jembatan, dan detail vegetasi lain saat ini tetap baked pada ground.

`RiverWaterfallSurface` kini memakai cutout RGBA dengan area alfa air yang eksplisit dari `assets/art/separated/river_water.webp`, bukan chroma-key di shader. Arus bergerak halus; waterfall foam lebih lanjut masih dalam backlog. Jalur pijakan menuju jembatan sudah diperpanjang, tetapi kualitas collision/occlusion harus diperiksa visual saat dimainkan, terutama di railing dan tepi pagar.

File manifest koordinat/pivot: `assets/art/separated/manifest.json`. Pemecahan aset adalah tracing masker konservatif + clean inpainting, jadi beberapa pinggiran foliage mungkin masih perlu dirapikan. Proyek tetap 2D, kontrol HP dan run 14-frame tidak berubah.

## Koreksi softness area gameplay (11 Oktober 2026)

**Bug visual diperbaiki:** efek blur sebelumnya menutupi seluruh `terrain_clean.webp` (termasuk halaman, jalan setapak, dan tepian sungai) sehingga objek sprite seperti rumah tetap tajam tetapi area sekitar karakter terlalu kabur. Kini `village_background_grade.gdshader` menggunakan *vertical distance mask* berbasis koordinat tekstur: paling atas diberi softening ringan, efeknya berkurang antara `distant_start=0.16` dan `distant_end=0.48`, dan **y>=0.48 (halaman/gameplay dekat) tidak diblur atau dikurangi kontrasnya sama sekali**. Pengaturan awal `softness=0.80`, lebih halus daripada versi global sebelumnya 1.35. Aset tekstur, rumah, pagar, karakter, run cycle, water effect dan HUD tidak diganti.

Mask Y ini adalah pendekatan artistik untuk perspektif 3/4, bukan kalkulasi jarak 3D. Bila scene berikutnya memiliki objek jauh di bawah horizon, perlu depth mask buatan khusus atau layer background jauh tersendiri.
