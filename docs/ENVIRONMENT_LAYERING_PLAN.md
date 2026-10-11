# Arsitektur layered world — Lembah Asri

## Diputuskan
Godot 4 **Camera2D** perspektif elevated 3/4 (pseudo-isometric); bukan kamera 3D. World menggunakan `y_sort_enabled=true`. Anak langsung root dengan `z_index=0` harus memiliki origin/pivot di titik pijakan untuk occlusion terhadap Player. Background z=-20, efek sungai z=-19, Player z=0, HUD CanvasLayer tetap terpisah.

## Tahap 1 — terpasang
- Original full painting masih aktif sebagai `BackgroundBase`. Shader blur lima sampel hanya pada background, bukan karakter/HUD.
- `RiverWaterfallSurface` memakai region x=980..1672 dan y=350..941 pada atlas asal. Warna blue/cyan dalam region tersebut dipilih sebagai mask awal dan dibuat bergerak ringan dengan shader; mask ini **perkiraan, bukan cutout air final**.
- Player z=0 mengikuti world Y-sorting. Run SpriteFrames dari ZIP, kaki, collider, HUD, kontrol mobile tidak diubah.

## Aset yang perlu diekstrak sungguhan
1. **Clean-plate:** terrain dan jalan tanpa objek yang akan dijadikan sprite terpisah (jangan menyisakan rumah/pagar/pohon duplikat).
2. Rumah: badan bangunan, atap/teras foreground, pintu dan tangga.
3. Pagar: segmen depan-belakang, gerbang dan collision.
4. Pohon dan vegetasi: batang dan kanopi, semak, pisang, kelapa, pepaya, bambu.
5. Kandang/gudang: struktur, pintu, interior jika dapat dimasuki.
6. Jembatan: dek, railing depan-belakang, jalur tersambung halaman dan collision.
7. Air: dasar sungai, permukaan, kontur mask tepi batu, air terjun, buih dan percikan.
8. Detail kecil: bebatuan, pot, kursi, ember, jerami dan peralatan tani.
9. Langit, pegunungan dan permukiman jauh: lapisan soft untuk parallax sangat ringan.
10. NPC/ternak/kebun produktif: dibuat sebagai objek gameplay berikutnya, bukan dibakar dalam background.

## Langkah lanjut
1. Buat aset clean-plate + sprite cutout dari ilustrasi resmi.
2. Tambahkan semua objek dengan pivot kaki ke world yang sudah Y-sorted, koreksi collision dan ruang ayun pintu.
3. Ganti shader chroma river dengan mask presisi; animasikan foam air terjun terpisah.
4. Implementasi interaksi nyata, kebun dan hewan, bukan dekorasi tampak interaktif.

**Batasan:** Godot smoke test hanya menjamin proyek berjalan dan node/shader terpasang. Akurasi pinggiran air serta depth occlusion masih harus diuji visual dalam game.

## Tahap 2 — sprite transparan dan clean-plate terpasang

**Penerapan nyata:** texture `terrain_clean.webp` bukan lagi foto scene yang mengandung rumah. Potongan alpha mandiri tersedia untuk `house`, `coop`, `banana`, `bridge_rail`, dan `front_fence`. Setiap sprite memakai pivot global yang berbeda dan terdaftar pada `assets/art/separated/manifest.json`. Sumber cutout adalah **konsep environment bersih** 1672×941 yang disetujui, bukan gambar gameplay dengan UI/NPC. `background_base.png` lama tetap tersedia di Git sebagai rollback, namun tidak ikut ditampilkan.

**Penting:** ini tahap cutout konservatif dengan polygon masking dan fill/inpainting, belum rotoscoping tingkat produksi. Tepi tanaman, detail pagar, dan tekstur yang sebelumnya tertutup bangunan dapat memiliki bekas masker saat karakter berjalan persis di balik tepinya. Perlu QA visual manual di ponsel dan refinement manual mask setelah itu.

Sungai sekarang menggunakan tekstur `river_water.webp` RGBA yang mask-nya dibangun dari warna cyan/putih hanya pada koridor air. Shader menggunakan alpha yang diekstrak ini, bukan memilih warna objek dari background secara realtime; batu/jembatan tetap statis. Jembatan memiliki `bridge_rail` Y-sort di atas dek statis sehingga pemain tidak hilang ketika berjalan melewati deck.

World masih Camera2D, run cycle asli ZIP/kecepatan, collision utama dan HUD/mobile tetap dipertahankan. Tidak membuat NPC atau ternak palsu.
