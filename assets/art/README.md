# Konsep 2D — wajib upload satu file

**Upload foto/gambar konsep yang disetujui** ke path persis:
`assets/art/concept_farm.png`

Gambar ini digunakan langsung sebagai background level oleh `scripts/world_2d.gd`.
Jika tersedia, Godot otomatis memuat gambar dan menyesuaikannya menjadi 1650 x 928.
Foto konsep masih memiliki tokoh/UI yang menyatu dengan gambar; ini adalah **prototipe konsep interaktif**,
bukan level berlapis final. Untuk production, rumah, foliage foreground,
karakter, NPC, dan HUD akan dipisahkan dari ilustrasi menjadi sprite/layer agar
animasi dan depth sorting benar.

Player akan memakai `assets/art/player.png` jika kamu menyediakan sprite transparan
dengan desain tokoh asli. Bila belum ada, karakter 2D placeholder sementara digunakan.

Repositori sumber tidak menyimpan gambar biner yang belum berhasil diupload.
