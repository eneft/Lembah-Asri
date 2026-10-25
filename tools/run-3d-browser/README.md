LEMBAH ASRI · ANIME TOON LIGHTING LAB

Tes browser independen (Three.js / WebGL, bukan ekspor native Godot):
https://eneft.github.io/Lembah-Asri/run-tester/

- 01 Running Normal: animasi asli dari Running.fbx, UV asli dipulihkan.
- 02 Run Anime: animasi asli dari Run.fbx, UV asli dipulihkan.
- 3 preset: Day / Neutral, Warm Sunset, Soft Indoor.
- Bandingkan Anime Soft Toon dengan Albedo Asli (unlit) agar lukisan sumber terbaca.
- Normal halus dapat diaktifkan/dimatikan. Normal map sengaja dibuat lemah agar tidak plastik.
- Exposure dan kecepatan animasi dapat disetel. Kamera orbit/zoom/reset.
- File FBX dan tekstur lokal bisa diimpor sebagai opsi.

Model/UV dan animasi tidak diubah oleh preset lighting. Nilai gaya sebaiknya
menggunakan Day / Neutral + Albedo Asli untuk baseline warna, lalu Anime Soft Toon.

File repo: tools/run-3d-browser/ , dipublikasikan oleh workflow existing tanpa
mengubah project.godot/game utama. Aset tetap dari assets.zip existing.