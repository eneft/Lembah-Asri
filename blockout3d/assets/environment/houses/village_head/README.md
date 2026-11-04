# Aset rumah kepala desa — Meshy original

Status: **menunggu upload berkas GLB biner asli**. Berkas belum disimpan ke GitHub; hanya folder dan identitas aset yang telah disiapkan.

## Unggah file sumber

**Nama file persis:** `Meshy_AI_Rumah_Merah_Putih_1104091308_texture.glb`

**Target path:**
`blockout3d/assets/environment/houses/village_head/Meshy_AI_Rumah_Merah_Putih_1104091308_texture.glb`

**Ukuran sumber:** 18,709,472 bytes (~18.7 MB)

**SHA-256:** `858e5b0161c23a9481a28e6a41c9377ca037e7ff7283d585cc996fbfa6c77707`

Unggah dari komputer menggunakan GitHub web pada branch `asset/rumah-kepala-desa-meshy-source` → **Add file → Upload files**. Jangan mengganti file rumah yang dipakai di game; ini hanya aset sumber untuk proses pembersihan tumbuhan.

## Hasil inspeksi berkas lokal pengguna
- Format glTF Binary / GLB 2.0 valid.
- **1 mesh, 1 node, 1 primitive**, 124,673 vertices, 100,095 triangles, 1 material, **3 gambar tekstur**.
- Tumbuhan atap tampaknya menyatu dalam mesh, bukan objek terpisah bernama `plant/ivy`; pembersihan perlu segmentasi geometri/seleksi selektif supaya UV, badan rumah, warna, pintu, jendela, atap, dan material tidak rusak.
- Hasil akhir nantinya disimpan terpisah sebagai `rumah_kepala_desa_clean.glb`, setelah divalidasi tampak depan/samping/atas dan collision serta ukuran terhadap avatar 168 cm.
- Belum melakukan integrasi ke scene game / penggantian balai desa.

## Keamanan baseline
- Tidak mengubah scene rumah warga, balai desa, rumah nelayan, terrain, kamera, collision, atau lima scene streaming.
- Original GLB harus dipertahankan utuh sebagai cadangan sebelum pembersihan.
