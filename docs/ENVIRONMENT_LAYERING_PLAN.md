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
