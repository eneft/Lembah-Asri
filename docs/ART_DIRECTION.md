# Lembah Asri — Visual Identity (locked baseline)

**Source of truth:** user-approved gameplay mockup with camera 3/4 from above and the locked HD protagonist turnaround. Source PNG 8 arah dan master HD sekarang ada di `assets/characters/player_hd/`. Gameplay utama berupa lingkungan dan karakter **2D ilustratif**, bukan tampilan game 3D realistik.

## Character
- Protagonist: rambut medium-brown agak berantakan, wajah ramah bergaya anime **proporsi tubuh SD yang konsisten (bukan chibi)**; outer hijau zaitun, kaos krem, celana cokelat lipat, boots cokelat, dan ransel kecil. 8 PNG `512 × 640` merupakan acuan visual resmi. Jangan memperbesar kepala atau memperpendek kaki tanpa persetujuan.
- Do not redesign any established main character or NPC when changing media between 2D and 3D. Preserve facial identity, clothes, and proportions.
- NPCs must share in-game scale and coherent rendering with the protagonist. Handpainted 2D elements are fine.
- Cows, sheep, buffalo, chickens, ducks, dogs and cats: rounded, adorable silhouettes.

## Camera and playability
- Elevated three-quarter perspective, looking downward across a substantial visible area.
- Marketplace camera must show multiple stalls and open navigation lanes, NOT eye-level dialogue portraits.
- Player character is relatively small within the environment. Paths, plants, houses, and NPC positions must be readable.
- Keep foliage from blocking the player and interaction prompts; use clear walking routes.

## Indonesian architecture and ecology
Clay tile roofs, bamboo and timber, kampung houses, sawah, irrigation, coconut, banana, papaya, tropical hills, pasar desa, local signs, and waterways.

## Color and climate
Warm morning sun, vibrant but matte greenery, gentle shadows, earthen colors. Use **musim hujan / musim kemarau**; avoid snowy Euro-style four seasons or fantasy windmills as core art.

## Asset performance
- Gameplay utama menggunakan layer ilustrasi PNG 2D di scene Godot 2D, dengan kedalaman `z_index`, collision objek yang benar dan Camera2D. Komponen 3D hanya sandbox/lab terpisah, bukan karakter utama.
- Hero memakai delapan PNG RGBA lossless di `assets/characters/player_hd/`; jangan upscale dari atlas resolusi rendah, kompres ulang atau campur gaya chibi dari generasi lain.
- Animasi saat ini deformasi shader dari 1 pose/arah untuk walk/run dan belum setara spritesheet gerak anatomi penuh. Tampilan gerak harus dievaluasi manual pada gameplay.
- Pertahankan alpha foliage/props, skala antarobjek, area pijakan dan jalur collision; hindari props yang terlihat menutupi pemain tanpa logika depth.
