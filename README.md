# Lembah Asri

**Pulang ke kenangan, hidup di desa.**

Game simulasi kehidupan dan pertanian bernuansa desa Indonesia. Dibangun dengan Godot 4 sebagai proyek baru yang **terpisah** dari repositori lama `Lembah-sari`.

## Cerita
Seorang pemuda kembali dari kota ke rumah masa kecilnya di desa. Rumah itu lama kosong dan tidak dirawat. Berawal dari kerinduan, ia memutuskan menetap, memperbaiki rumah, bercocok tanam, memancing, memelihara hewan, berinteraksi dengan warga, dan mungkin membangun keluarga. **Bukan** cerita tentang misi besar membangun desa.

## Baseline yang dikunci
- **Kamera gameplay:** 3/4 dari atas (elevated three-quarter), melihat area cukup luas; karakter relatif kecil dibanding lingkungan, terutama di pasar.
- **Karakter utama:** rambut cokelat agak berantakan, outer hijau zaitun, kaos krem, celana cokelat, boots cokelat, ransel kecil. Jangan desain ulang tanpa persetujuan.
- **Desa Indonesia:** rumah genteng, sawah dan irigasi, pasar desa, kelapa, pisang, pepaya, bambu, sungai, musim hujan/kemarau.
- **Gaya:** cozy illustrated **2D**, dengan karakter utama proporsi tubuh SD yang disetujui (bukan chibi), ukuran konsisten terhadap lingkungan dan NPC. Lab karakter 3D terpisah bukan gameplay utama.
- **Gameplay wajib:** kebun, sawah, ternak, pets, interaksi NPC; dikembangkan bertahap.

## Status
Stage 1 `house_garden_stage1.tscn`: lingkungan desa dari layer PNG 2D, Camera2D, collision, interaksi Bu Sari memakai **E**, dan karakter utama base/idle 2D HD **delapan arah** terpisah (`1152 × 1632` PNG RGBA lossless). Posisi kaki, proporsi dan arah hadap diselaraskan; pose kiri bukan flip. **Walk/run saat ini masih menggunakan pose diam sesuai arah gerakan, bukan animasi frame-by-frame.** Kontrol mobile dengan joystick sentuh, LARI dan AKSI tersedia di browser HP, tanpa mengubah kendali desktop. Sistem bercocok tanam, inventory, NPC AI, dan renovasi belum fungsional. Smoke test dan ekspor Godot Web dijalankan lewat GitHub Actions.

## Menjalankan
1. Gunakan Godot 4.3 atau lebih baru.
2. Buka `project.godot` dan jalankan proyek (F5).
3. Desktop: WASD/panah untuk berjalan, **Shift** untuk berlari, dan **E** untuk berinteraksi.
4. Mobile: putar HP ke posisi **landscape**; geser **joystick kiri**, tahan **LARI** di kanan sambil bergerak, dan ketuk **AKSI** untuk berbicara dengan Bu Sari atau melihat kebun. Tombol responsif mengikuti ukuran layar dan mendukung dua jari atau lebih.
5. Demo Web terbaru: https://eneft.github.io/Lembah-Asri/

Dokumen acuan: `docs/ART_DIRECTION.md`, `docs/GAME_DESIGN.md`, `docs/ROADMAP.md`.

Repo baru ini tidak memodifikasi `eneft/Lembah-sari` maupun `eneft/sidokter`.
