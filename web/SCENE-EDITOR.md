# Editor visual scene Lembah Asri (Three.js)

Fitur ini mengedit **scene Three.js game yang sama**, bukan scene hasil ekspor terpisah.

## Memakai editor

1. Jalankan game Three.js dari folder `web` seperti biasa.
2. Setelah 3D World Ready, klik **Edit Scene 3D**.
3. Klik pohon, batu, sumur, atau objek lainnya di viewport, atau cari dari daftar objek kiri.
4. Gunakan **Pindah**, **Putar**, atau **Skala**. Drag gizmo di viewport atau isi angka X/Y/Z.
5. Klik **Fokus kamera** untuk melihat objek yang dipilih. Mouse/touch pada area kosong memutar kamera; scroll/pinch memperbesar.
6. Klik **Kembali Bermain** setelah selesai. Kontrol WASD, farming, dan karakter tetap terpisah dari editor.

## Menyimpan hasil ke GitHub

- Pengeditan tersimpan otomatis pada `localStorage` browser saat gizmo dilepas / angka diubah.
- Klik **Ekspor JSON** untuk menghasilkan `lembah-asri-scene-layout.json`.
- **Commit isi JSON tersebut sebagai `web/public/scene-layout.json` di GitHub.** Saat build web berikutnya, layout resmi tersebut dimuat dari static asset oleh browser, termasuk ketika mode editor tidak dibuka.
- **Impor JSON** memasukkan layout ke browser lain dan bisa diuji sebelum dipublikasikan.
- Layout lokal mengutamakan transform setempat dibanding layout yang dipublikasikan. Gunakan **Reset semua** untuk kembali ke layout resmi GitHub.

Format JSON versi 1:
```json
{
  "format": "lembah-asri-scene-layout",
  "version": 1,
  "transforms": {
    "Rumah Masa Kecil / Playable House Garden/Old fruit tree#1": {
      "position": [-40, 0, 8.3],
      "rotation": [0, 0.21, 0],
      "scale": [1, 1, 1]
    }
  }
}
```

## Batasan keselamatan

Editor **tidak mengubah topologi GLB, UV, tekstur, material artist, heightmap, script farming, atau collider Rapier**. Editing saat ini mengubah transform objek statis yang tidak ditandai sebagai sistem/berkolisi. Terrain, ladang, badan air, jembatan, rumah, pagar, bangunan, dan bidang shadow dikunci untuk menghindari ketidaksesuaian visual dan physics.

Objek baru yang dibuat secara async (misalnya GLB rumah atau batu) akan masuk daftar saat siap. Perubahan pada scene visual diterapkan sesudah model siap.

Untuk perubahan bentuk sungai, terraforming, atau pemindahan rumah beserta collision-nya, gunakan jalur khusus yang memperbarui sekaligus geometry, collision, dan penempatan gameplay. Jangan hanya memindahkan mesh visual.
