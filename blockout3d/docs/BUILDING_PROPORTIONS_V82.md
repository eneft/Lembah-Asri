# Lembah Asri V8.2 — standar proporsi 17 bangunan (implementasi nyata)

## Sumber yang dilindungi
- **1 unit Godot = 1 meter**, tinggi karakter utama **1,68 m**; ukuran dunia/terrain dan kamera tidak diubah.
- **17** ID berasal dari \`assets/environment/village/settlement_v7.json\` yang sudah dipakai produksi: **7** rumah desa, **3** rumah barat, **1** rumah masa kecil, **1** gudang, **1** balai desa, **1** pos ronda, **2** rumah nelayan, **1** warung. Jangan menciptakan \`rumah_barat_04\`; ID itu tidak ada.
- **Seluruh \`center\`, \`yaw\`, \`foot\`, jalur, lapangan, sungai, jembatan, collision layer, dan streaming 5 area tetap sama.**
- Ukuran bukan multiplier buta untuk semua jenis bangunan. Bentuk atap, body, dan material setiap model tetap unik.

## Patokan bersama
- Pintu hunian: **2,16 m** (karakter ≈77,8% tinggi pintu).
- Pintu warung/rumah nelayan prosedural: **2,18 m**; balai **2,30 m**; gudang **2,10 m**.
- Jendela fasad prosedural: **0,85 × 1,13 m**, ambang ≈**1,04 m** di atas lantai rumah. Ukuran panel kaca dan kisi mengikuti jendela.
- Kolom balai, atap joglo, teritis, dan collision diperpanjang seiring dinding; **tidak** memperlebar footprint sampai mengambil jalan.
- **Rumah nelayan Meshy asli \`rumah_nelayan_01\` khusus:** data GLB pengguna adalah **satu mesh UV tekstur utuh** (95.121 segitiga). Pintu tidak dapat digeser secara independen tanpa membongkar aset. Koreksi yang aman: mempertahankan X/Z uniform agar kedalaman plot tidak terlanggar, dan membesarkan Y terkalibrasi 1,24 terhadap ukuran X/Z; UV, material asli, dan collision footprint dipertahankan.
- **Rumah masa kecil:** tinggi model ke puncak **4,48 m** (dari 4,05 m) dengan lebar/depth yang sama; collision disesuaikan.

## Standar tiap ID (meter)

Angka lebar/depth bangunan prosedural menunjukkan *badan dinding*, bukan lebar jalan, area halaman ataupun seluruh tepi kanopi. Untuk rumah impor, dimensi model dihitung dari AABB sumber pada runtime.

| ID eksisting | Kategori | Lebar × depth badan | Tinggi dinding/teritis | Pintu | Catatan |
|---|---|---:|---:|---:|---|
| rumah_desa_01 | Rumah desa | 6,30 × 5,25 | 3,00 | 2,16 | Atap pelana |
| rumah_desa_02 | Rumah desa | 6,56 × 5,18 | 3,14 | 2,16 | Joglo |
| rumah_desa_03 | Rumah desa | 6,12 × 4,83 | 3,04 | 2,16 | Limasan |
| rumah_desa_04 | Rumah desa | 6,03 × 5,25 | 2,98 | 2,16 | Atap asimetris |
| rumah_desa_05 | Rumah desa | 6,30 × 5,10 | 3,05 | 2,16 | Limasan |
| rumah_desa_06 | Rumah dekat sungai | 6,39 × 5,10 | 3,13 | 2,16 | Joglo |
| rumah_desa_07 | Rumah desa | 6,12 × 5,18 | 3,09 | 2,16 | Pelana |
| rumah_barat_01 | Rumah barat | 6,21 × 4,90 | 2,98 | 2,16 | Limasan |
| rumah_barat_02 | Rumah barat | 5,94 × 4,97 | 3,01 | 2,16 | Pelana |
| rumah_barat_03 | Rumah barat | 6,48 × 4,69 | 3,10 | 2,16 | Joglo |
| rumah_masa_kecil | Rumah utama naratif | Lebar/depth lama tetap | Puncak 4,48 | Tergantung detail GLB | Meshy orisinal tetap |
| gudang_kebun | Gudang | 6,03 × 5,60 | 2,79 | 2,10 | Tetap bangunan penunjang |
| balai_desa | Publik | 8,36 × 6,39 | 3,64 | 2,30 | Joglo dua tingkat + pilar 3,44 m |
| pos_ronda_balai | Pos ronda | 2,30 × 2,16 | Atap 2,95 | Terbuka | Collision sederhana 2,62 m |
| rumah_nelayan_01 | Meshy nelayan | X/Z sesuai batas plot 8×6,5 | Puncak naik ±4,1–4,4 | Proporsional terhadap mesh utuh | **Prioritas screenshot** |
| rumah_nelayan_02 | Nelayan prosedural | 5,44 × 4,81 | 3,12 + panggung 0,79 | 2,18 | Tetap beda dari rumah nelayan 01 |
| warung_pesisir | Warung | 6,30 × 5,04 | 3,07 + lift 0,09 | 2,18 | Bukaan depan tetap jelas |

## Checklist audit Godot + WebGL

1. Jalankan seluruh tes \`terrain_v7_settlement_smoke.gd\`, termasuk original GLB topology/UV, model unik, dorong karakter ke collision balai, dan jarak pintu/jendela.
2. Jalankan \`terrain_v79_streaming_smoke.gd\` dan \`terrain_v80_scene_loading_smoke.gd\`: 17 rumah berpindah ke lima area tanpa perubahan posisi; unloading visual tidak pernah menghilangkan collision.
3. Di mode **SCENE → Kawasan Pesisir**, foto pemain 1,68 m di depan \`rumah_nelayan_01\`; verifikasi pintu tidak sejajar kepala dan atap menaungi avatar.
4. Di mode **Open World**, jalan dari desa ke pantai, uji jembatan, wajah/kamera, frustum/ground, mobile controller, serta tidak ada atap yang menembus area pemain.
5. Setelah build, audit screenshot nyata iPhone Safari. CI Chromium tidak dapat membuktikan sudut perspektif yang sama pada semua ukuran layar.

### Tidak dikerjakan pada revisi proporsi ini
Tidak merekonstruksi pintu internal GLB Meshy (karena file sumbernya belum terpisah), tidak mengganti texture hand-painted, tidak mengubah layout/akses, dan tidak memodifikasi generator water/terrain. Transform rumah import dievaluasi terhadap plot sebelum boleh merge.
