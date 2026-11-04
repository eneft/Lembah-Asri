# Rumah Kepala Desa — GLB asli dan revisi atap/dinding V2

## Status

| File | Ukuran | Keterangan |
|---|---:|---|
| `Meshy_AI_Rumah_Merah_Putih_1104091308_texture.glb` | 18.709.472 byte | Original Meshy dari pengguna, **dipertahankan utuh** |
| `rumah_kepala_desa_clean.glb` | 17.493.384 byte | **V2, model yang telah direvisi**; menggantikan versi V1 yang merusak sebagian genteng |

SHA-256 V2: `acf2b796f658a2c53f131af692cfaa5ef825b070ba70d2f5f456c76158749ca2`.

### Audit V2 (4 November 2026)

- Original: 124.673 vertex dan **100.095 segitiga**.
- V2: **74.481 segitiga**, dengan **25.614 segitiga** tanaman yang mengganggu dihilangkan.
- **28.797 permukaan segitiga genteng terakota asli terlindungi**, bukan dipotong bersama tumbuhan.
- **37 muka** bekas tanaman berwarna hijau pada area atap **di-UV remap secara lokal** ke warna genteng dari tekstur asli; geometry-nya tidak dibuang sehingga tidak membuat lubang tambahan.
- Tanaman merambat yang keluar dari tembok/jendela samping dibersihkan. Semak taman dan pot di halaman tetap ada.
- Tiga PNG sumber tetap **byte-identik**; UV dan normal geometri asli yang dipertahankan tidak diubah, kecuali UV 37 muka yang memang sengaja diperbaiki.
- Bendera merah-putih, pilar, pintu, jendela, teras, dinding, serta genteng secara umum dipertahankan.
- Render pemeriksaan dari depan, kanan, belakang, atas sudah dilakukan; terdapat beberapa bintik hijau kecil dan sapuan hijau asli pada tile yang masih bisa tampak dari atas. Ini tidak diklaim sebagai model benar-benar tanpa warna hijau.

### Reproduksi dan verifikasi

Sumber pembersihan otomatis: `blockout3d/tools/clean_village_head_roof.py`. GitHub Actions membangun langsung dari GLB original dan commit hasilnya ke branch ini:

[Clean Meshy Village Head Roof — log V2](https://github.com/eneft/Lembah-Asri/actions/runs/41848205545)

Proses berhasil, log mencocokkan SHA-256 V2. Pastikan setiap revisi selanjutnya memakai sumber asli, bukan hasil clean yang telah kehilangan faces.

### Proteksi game

Aset ini **belum terpasang** ke scene sebagai bangunan kepala desa. Tidak mengubah model balai desa, lokasi 17 bangunan, player 168 cm, collision, kamera, jalan, terrain, vegetasi dunia maupun streaming. Integrasi ke game adalah pekerjaan terpisah yang memerlukan pengujian proporsi, posisi dan performa.
