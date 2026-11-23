# Lembah Asri — kelanjutan Work, 23 November 2026

## Pemeriksaan sumber
- GitHub `main` sebelum pekerjaan ini: `2d82a95463d12b60923f05fb6fbf81e01747b73c` (PR #93).
- **Tidak ada commit atau PR Work berikutnya** yang terbit di repo hingga audit ini.
- Screenshot Work yang pengguna kirim memperlihatkan thumbnail **daun** dan **kulit pohon**, serta laporan persiapan **batu, genteng, rumpun rumput, tanah tebing dan air**. Screenshot tidak menyertakan piksel sumber PNG/WebP resolusi asli. Jangan menyatakan sumber-sumber Work itu sudah diintegrasikan.
- Keputusan estetika yang dipertahankan: **3D nyata dengan UV hand-painted**, bukan gambar 2D yang disamarkan; sumur batu tetap terbuka **tanpa atap**, 2 pohon, bedengan belakang, pagar bambu, karakter lama, jembatan GLB kedua, sungai; pertahankan **material tebing sebelum PR #91** sebagaimana dibuka kembali oleh PR #92.

## Integrasi yang dilakukan dalam PR ini
- Tajuk besar di sisi kanan pekarangan: tambahkan gugusan daun oval **geometri 3D lengkung**, memakai atlas pigment daun yang *sudah tersedia di kode* tanpa mengganti GLB shade yang telah disetujui. Detail tulang daun tetap berasal dari UV, bukan decal atau kartu yang selalu menatap kamera. Hanya satu instanced draw call.
- Tambahkan kamera masuk `?view=konsep` untuk memotret komposisi **dari tepi sungai** dalam scene Three.js asli. Kamera, kontrol pemain, dan spawn normal/`?view=sungai` tetap tidak berubah.
- Verifikasi runtime GLB, texture map, instance daun, posisi kamera, collision dan render browser. Tidak mengubah kebun/farming, sumur, rumah, air, buih, rumput, atau tanah tebing.

## Status tiap lapisan visual dari laporan Work
| Lapisan | Sumber yang aktif / keputusan |
|---|---|
| Daun | GLB shade/orchard asli dengan alpha cutout; penambahan gugusan daun ber-UV yang memakai `makePaintedLeafAlbedo()` (PR ini). **Bukan file PNG Work** |
| Kulit pohon | Atlas UV asli dan `makePaintedBarkAtlas()`; delapan akar 3D dipertahankan |
| Batu | GLB `lembah_asri_rocks_original_16.glb` (2 variasi yang disepakati) serta UV batu dasar sungai |
| Genteng | Tetap tekstur bawaan `rumah_utama.glb`; tidak memasang atap pada sumur |
| Rumpun rumput | Rumput halus dan `village_grass_painted.webp` yang sudah disetujui |
| Tanah tebing | **Dipertahankan** dari rollback PR #92 (versi pilihan pengguna), tidak dipaksakan ke eksperimen PR #91 |
| Air | `creek_water_painterly_illustrated.webp` dan atlas buih `creek_foam_painterly_restored_v2.png`, animasi tetap jalan |
| Kamera | Preset baru dari tepian sungai `?view=konsep` sebagai opsi, tidak mengganti default |

## Yang belum boleh diklaim selesai
Gambar tekstur baru yang hanya tampil sebagai thumbnail di Work **belum ada sebagai sumber asli yang bisa dibaca dari GitHub**. Substitusi file asli menjadi UV atlas game hanya boleh dilakukan setelah texture originals tersedia dan telah diuji pada mesh 3D yang bersesuaian, dengan screenshot *before/after*. Jangan menebak tekstur asli dari thumbnail, jangan menimpa scene PR #93, jangan merombak baseline yang sudah disepakati.
