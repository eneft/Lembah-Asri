# Audit RUN 8 arah — penyebab jeda Left/Right dan Back Diagonal

**Tanggal audit:** 13 Oktober 2026. **Ruang lingkup:** isolated `scenes/run8_uploaded.tscn`, bukan scene utama.

## Temuan terverifikasi dari artwork sumber

1. **Side Left/Right (26 pose source)**: `lembah_asri_run_49_frames_7x7_lossless.tres` bukan satu loop 26 pose. Urutannya terdiri dari `row_3` (7), `row_4` (7), `row_6` (5), dan `row_7` (7). `row_5` tidak ada. Sekadar memotong daftar menjadi 12 pose tidak membuktikan bahwa frame terakhir cocok dengan yang pertama.
2. **Perbaikan side:** potongan 14–25 (`row_6+row_7`) diganti dengan **2–13** (`row_3+row_4`), tetap 12 pose yang berasal dari atlas asli. Pengukuran praktis pada gambar PNG alpha-composited yang dikecilkan menjadi 128×194 menemukan jarak gambar last→first turun dari **0,230** ke **0,193** (sekitar 16% lebih rendah) dan mendekati jarak transisi antarframe rata-rata **0,188–0,191**. Angka ini hanya proxy perubahan piksel; bukan bukti final animasi pasti natural.
3. **Back Left/Right (21 pose source):** `back_left_right.tres` terdiri dari `row_1/2/3` × 7. Sumber menunjukkan **perubahan sudut karakter** dari belakang tiga-perempat menuju lebih samping, bukan satu loop run in-place dari kamera tetap. Banyak pasangan frame hampir sama lalu terjadi lompatan pose besar. Pada potongan 9–20, jarak antarframe bergantian kira-kira **0,036–0,056** dan **0,254–0,311**; jarak wrap 20→9 sekitar **0,296**. Itulah kemungkinan utama terjadinya visual pause/jerk. Memilih indeks lain saja tidak bisa memperbaiki rotasi sudut dan menciptakan pose in-between yang tidak ada.
4. **Tes Godot** hanya memastikan file dibaca, urutan/pilihan pose, jumlah 12 frame, kecepatan 12 FPS, delapan arah, mirror, proporsi, warna, dan idle baru. Tes ini **tidak membuktikan keluwesan visual**. Log CI dibuat jujur: `REAR RESOURCE PASS`, bukan `SEAM PASS` untuk belakang diagonal.

## Tindakan

- Patch side menggunakan 12 original `AtlasTexture` dari indeks 2..13 untuk kanan, dan mirror untuk kiri.
- Back diagonal tidak diganti secara acak agar pose dan sudut sumber yang sudah disetujui tidak rusak. Tetap 12 frame pada 12 FPS sebagai **versi sementara**.
- **Aset yang dibutuhkan untuk hasil belakang diagonal final:** satu siklus native belakang diagonal pada kamera tetap, minimal 12 pose dengan dua langkah kaki lengkap, orientasi/warna/ukuran dan titik pijak sama di awal/akhir; sisi lainnya dapat di-mirror. Bisa bersumber dari animasi baru atau pengeditan source khusus.
- Source PNG/TRES, idle user terbaru, shader warna dan scene utama tidak disentuh.

## Metode audit

Decode `AtlasTexture.region` bersama `margin`, kembalikan kanvas 768×1168 per pose, bandingkan komposit alpha dengan piksel latar netral. Hitung satu selisih rata-rata spasial RGB+alpha sebagai proxy jarak pose dan periksa perubahan orientasi secara visual. Jeda pada animasi tetap perlu dinilai dengan uji browser 12 FPS berulang (beberapa siklus), bukan hanya keberhasilan smoke test.
