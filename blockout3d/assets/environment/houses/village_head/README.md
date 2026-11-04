# Rumah Kepala Desa — aset Meshy dan hasil pembersihan atap

## Status: berhasil diunggah dan dibersihkan

| File | Status | Ukuran |
|---|---|---:|
| `Meshy_AI_Rumah_Merah_Putih_1104091308_texture.glb` | Sumber asli, dipertahankan | 18.709.472 byte |
| `rumah_kepala_desa_clean.glb` | Tanaman menempel pada atap dihilangkan | 17.599.232 byte |

SHA-256 model bersih: `79fab3a253138e60154c2838633ba6531c9dbdfa871e9f5e0512febcd0c434ce`.

### Perubahan terverifikasi

- Dari model asli **100.095 segitiga / 124.673 vertex**, hilang **23.244 segitiga** vegetasi atap.
- Hasil **76.851 segitiga / 98.692 vertex**.
- Geometri genteng, dinding, teras, pintu, jendela, bendera merah-putih, pot, rumput halaman, dan dasar rumah dipertahankan.
- Semua **3 PNG tekstur asli byte-identik**, termasuk normal map dan metallic-roughness; array UV dan normal vector untuk vertex tersisa dibawa utuh dari GLB asli.
- Pewarnaan daun hijau pada bagian atas tinggal 130 vertex dari 22.019 vertex semula. Ini menghilangkan tanaman besar; beberapa bercak warna hijau yang sudah menyatu pada lukisan tekstur genteng masih mungkin tampak.
- Generator yang dapat dijalankan ulang: `blockout3d/tools/clean_village_head_roof.py`.
- GitHub Actions berhasil mengeksekusi generator, memverifikasi hasil, lalu meng-commit GLB ke branch ini: [log pembuatan](https://github.com/eneft/Lembah-Asri/actions/runs/41839889731).

### Keamanan baseline Lembah Asri

Kedua aset berada di folder cadangan, **belum dijadikan node game**. Belum mengganti `balai_desa` atau bangunan lain; tidak mengubah center/yaw bangunan, collision, streaming, terrain, kamera, atau gameplay. Integrasi ke scene dilakukan terpisah dan harus menyamakan ukuran terhadap avatar 168 cm.
