# Referensi tekstur user — Lembah Asri, 23 November 2026

Dua gambar sumber diterima di chat dan diproses menjadi albedo WebP ringan. **Bukan** hasil image generation, tidak mengganti geometri 3D atau menggambar billboard di scene.

- `web/public/textures/concept/lembah_material_atlas.webp`: atlas 2×2 dari sumber JPG: kulit batang (kiri atas), batu berlumut (kanan atas), terakota (kiri bawah), kayu (kanan bawah). Susunan piksel tidak dibalik pada file; selector UV Three.js mengambil tiap kuadran.
- `web/public/textures/concept/lembah_leaf_pigment.webp`: hasil crop daun hijau dengan tulang tengah dari sumber JPG. Latar putih untuk presentasi dihilangkan menggunakan pengisian warna daun tetangga agar tidak muncul di permukaan 3D. Ini **pigment texture**, bukan cutout silhouette.
- Applied: pohon tua sebelah kanan kebun, batang/8 akar dan 672 daun oval 3D melalui UV yang sudah ada; batu kering varian GLB ke-02.
- Preserved: model GLB pohon dan jembatan kedua, kanopi alpha-cutout original, batu sungai berlumut dan shader air, rumah serta atap asli, kayu jembatan, sumur, physics, 24 planting places, shading dan grass/river baseline.
- Terakota dan kayu tersedia di atlas **belum diaplikasikan** ke genteng rumah atau jembatan asli karena UV kedua GLB itu berbeda; tidak mengganti material final secara buta.
- On load failure the game keeps the currently approved old materials; no missing-texture white artifacts.

Pengujian unit `tests/user-reference-textures.test.mjs`; CI Three.js build, farming dan tangkapan gambar runtime tetap berlaku.
