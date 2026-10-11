# Lembah Asri

**Pulang ke kenangan, hidup di desa.**

Game simulasi kehidupan dan pertanian bernuansa desa Indonesia. Dibangun dengan Godot 4 sebagai proyek baru yang **terpisah** dari repositori lama `Lembah-sari`.

## Cerita
Seorang pemuda kembali dari kota ke rumah masa kecilnya di desa. Rumah itu lama kosong dan tidak dirawat. Berawal dari kerinduan, ia memutuskan menetap, memperbaiki rumah, bercocok tanam, memancing, memelihara hewan, berinteraksi dengan warga, dan mungkin membangun keluarga. **Bukan** cerita tentang misi besar membangun desa.

## Baseline yang dikunci
- **Kamera gameplay:** 3/4 dari atas (elevated three-quarter), melihat area cukup luas; karakter relatif kecil dibanding lingkungan, terutama di pasar.
- **Karakter utama:** rambut agak berantakan, outer hijau zaitun, kaos krem, celana cokelat, boots cokelat, ransel kecil. Jangan desain ulang tanpa persetujuan.
- **Desa Indonesia:** rumah genteng, sawah dan irigasi, pasar desa, kelapa, pisang, pepaya, bambu, sungai, musim hujan/kemarau.
- **Gaya:** cozy illustrated **2D**, dengan karakter utama proporsi tubuh SD yang disetujui (bukan chibi), ukuran konsisten terhadap lingkungan. Gameplay hanya 2D, tanpa preview 3D.
- **Gameplay wajib:** kebun, sawah, ternak, pets, interaksi NPC; dikembangkan bertahap.

## Status
Stage 1 `house_garden_stage1.tscn`: lingkungan desa dari layer PNG 2D, Camera2D, collision, dan karakter utama base/idle 2D HD **delapan arah** terpisah (`1152 × 1632` PNG RGBA lossless). Karakter diperkecil 30% (skala 0.105, pijakan kaki tetap); posisi kaki, proporsi dan arah hadap diselaraskan; pose kiri bukan flip. **Walk/run saat ini masih menggunakan pose diam sesuai arah gerakan, bukan animasi frame-by-frame.** Kontrol mobile dengan joystick sentuh dan LARI tersedia di browser HP, tanpa mengubah kendali desktop. Tombol AKSI disembunyikan sementara karena belum ada objek interaktif. Sistem bercocok tanam, inventory, NPC AI, dan renovasi belum fungsional. Smoke test dan ekspor Godot Web dijalankan lewat GitHub Actions.

## Background Stage 1 (11 Oktober 2026)
Ilustrasi dasar `assets/art/layers/background_base.png` sekarang adalah **rumah masa kecil yang ditinggalkan lebih dari 10 tahun**, halaman luas belum ditanami, jalan setapak menuju jembatan, sungai, serta langit dan desa di kejauhan. Ukuran 1672 × 941 dan piksel gambar sumber tetap sama. Aset layer rumah, kandang, tanaman, dan foliage lama disimpan tetapi disembunyikan untuk mencegah gambar rangkap. Collision kebun dan interaksi tomat lama tidak berlaku selama menggunakan full-scene background; kontrol gerak dan karakter tetap aktif. NPC Bu Sari, label dialog, HUD prototipe, dan preview 3D dihapus dari Stage 1.

## Penyesuaian pencahayaan karakter (Godot)

Pencahayaan dan tone karakter sekarang menggunakan `ShaderMaterial` 2D pada sprite gameplay, **bukan mengganti atau mengompresi 8 PNG karakter**. Shader menjaga alpha asli dan berlaku pada semua arah, termasuk idle/walk/run. Preset awal mengurangi saturasi dan kontras, memberi bias sinar matahari kuning hangat, mengangkat bayangan gelap secara halus, dan memberi pantulan warna rumput tipis di tubuh bagian bawah.

Untuk menyetel hasil visual langsung di Godot, buka `assets/materials/hero_environment_grade.tres`, lalu ubah `saturation`, `contrast`, `shadow_fill`, `sun_warmth`, atau `green_bounce`. Implementasi shader: `shaders/hero_environment_grade.gdshader`. Ini merupakan *render-only grade*, bukan lampu dinamis; tidak mengubah posisi, gerak, skala, collision, tekstur, atau background.

## Menjalankan
1. Gunakan Godot 4.3 atau lebih baru.
2. Buka `project.godot` dan jalankan proyek (F5).
3. Desktop: WASD/panah untuk berjalan dan **Shift** untuk berlari. Belum ada objek interaktif di Stage 1.
4. Mobile: putar HP ke posisi **landscape**; geser **joystick kiri** dan tahan **LARI** di kanan sambil bergerak. Tombol responsif mengikuti ukuran layar dan mendukung dua jari atau lebih.
5. Demo Web terbaru: https://eneft.github.io/Lembah-Asri/

Dokumen acuan: `docs/ART_DIRECTION.md`, `docs/GAME_DESIGN.md`, `docs/ROADMAP.md`.

Repo baru ini tidak memodifikasi `eneft/Lembah-sari` maupun `eneft/sidokter`.
