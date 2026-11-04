# Lembah Asri — V8.0 Area Scene Loading & Debug

## Cara membuka per scene di browser / iPhone

Mainkan \`https://eneft.github.io/Lembah-Asri/terrain-test/\` setelah commit V8.0 lolos CI + deploy.

Di kanan atas game, pada kontrol **SCENE**, pilih:
- **Open World**: kembali ke dunia biasa yang menyambung; posisi kamera/karakter awal dipulihkan setelah keluar dari mode debug
- **Desa Inti**
- **Pekarangan Barat**
- **Balai Desa**
- **Tepi Sungai**
- **Kawasan Pesisir**

Saat scene spesifik dipilih, **hanya satu wilayah bangunan + vegetasi yang aktif**, area tanah di luar batas wilayah dipotong secara visual untuk keperluan inspeksi. Karakter dipindahkan ke tanah kering dan aman yang ditemukan melalui raycast; kontrol berjalan, lari, lompat, dan putar kamera tetap sama. Kembali ke **Open World** untuk memainkan dunia tanpa potongan terrain.

Di editor Godot gunakan panel Remote:
\`World/AreaStreamingV79/Area_*/Houses/*/V80Visuals\`
dan
\`World/AreaStreamingV79/Area_*/Foliage/V80Foliage\`.

Ketiadaan node \`V80Visuals\` / \`V80Foliage\` pada wilayah jauh menandakan **instansi scene telah benar-benar di-free** (bukan sekadar \`visible=false\`). Akar \`Houses\` dan \`Plants\` tetap menyimpan collision, transform dan metadata fisik.

## Cara kerja

1. V7.9 mengidentifikasi lima area yang sudah ada menurut \`vegetation_v73.json\`.
2. V8 membuat PackedScene untuk visual 17 rumah dan 5 batch vegetasi wilayah, melepas Node3D visual asli dari SceneTree.
3. Setiap ~0,28 detik V8 mengukur jarak pemain ke batas wilayah. Area tetangga dipersiapkan sebelum dimasuki (47 m, ditambah zoom), dan dapat dilepas saat cukup jauh (65 m, plus zoom). Histeresis mencegah kedip.
4. Debug picker mengunci tepat satu area instansi, tanpa meniadakan collision atau memindahkan blueprint.
5. Terrain utama, laut, sungai, jalur, jembatan, karakter, dan kamera tetap aktif untuk kontinuitas dunia.
6. Bila area dimainkan lagi, rumah yang sama diinstansiasi kembali dari template; model Meshy original tetap memakai UV dan materialnya.

**Keterbatasan RAM:** file WebGL awal masih satu \`.pck\`. PackedScene template masih menyimpan referensi mesh/texture dan shader global untuk pemakaian ulang. Ini adalah **runtime scene/node streaming**, bukan HTTP lazy-downloading atau bukti bahwa RAM tekstur GPU berkurang sebanding dengan jumlah wilayah. Pengukuran iPhone nyata masih perlu dilakukan untuk menentukan apakah diperlukan pemisahan atlas/asset pack serta pembagian terrain mesh lebih lanjut.

## Uji otomatis

CI menjalankan tes lama (17 rumah, UV Meshy 95k, 179 vegetasi, kamera, jembatan, collision) dengan mode debug memuat seluruh visual. Tes baru \`tests/terrain_v80_scene_loading_smoke.gd\` memeriksa pergantian pesisir ↔ barat: node visual di luar area **hilang**, instansi scene yang dipilih muncul kembali, posisi rumah identik, dan collision rumah yang tidak dirender tetap bekerja. Build deploy tetap diuji browser Chromium WebGL untuk mencegah layar blank.
