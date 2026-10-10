# Player utama 8 arah — atlas Godot 4
- Binary: `atlas.webp`, 576 x 1344 px (8 kolom x 16 baris).
- Kolom: right, down_right, down, down_left, left, up_left, up, up_right.
- Baris 0–3: idle (4 frame); 4–9: walk (6 frame); 10–15: run (6 frame).
- Tiap frame: 72x84 px, di-upscale halus pada stage.
- Playback: 12 FPS; default menghadap kamera 3/4 `down_right`.
- Shift + arah: lari. WASD/panah: jalan. E: interaksi tetap aktif.
- Atlas ringan untuk web; sprite PNG resolusi penuh disimpan pada paket produksi terpisah.
- Catatan: tahap prototipe sprite; kualitas transisi/artefak visual masih perlu pass animator.
