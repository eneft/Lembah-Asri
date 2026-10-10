# Lembah Asri — Game Concept

## Premise
A young adult returns from city life to the village of happy childhood memories. Their old family home is unmaintained and empty. Nostalgia inspires the visit; over time they decide to settle, restore the home and build a quiet village life. **They did not return on a grand mission to develop the village.**

## Primary game loop
Prepare soil → plant → water → tend → harvest → sell/cook; plus fishing, livestock, pets, relationships, trading, village events, house repair, and possible marriage.

## Plants typical of Indonesian rural life
- Sawah: padi.
- Quick crops: kangkung, bayam, sawi, cabai, tomat, terong, kacang panjang, timun, bawang.
- Ladang: jagung, singkong, ubi jalar, kacang tanah.
- Spices: serai, jahe, kunyit, kencur, lengkuas.
- Orchard: pepaya, pisang, kelapa, mangga, rambutan, jambu, nangka, durian.
Plants are regionally familiar, not necessarily botanically indigenous. Natural growth stages and repeating harvests vary by crop.

## Livestock
Ayam, bebek, kambing, domba, sapi, kerbau; kucing, anjing and optional other pets. Player can feed, bond, and collect products without punishing micromanagement.

## Locations
Rumah masa kecil, kebun sayur, sawah, kandang, pasar desa, tepi sungai memancing, hunian warga, dan interior rumah.

## Starter implementation
Current Stage 1 is a layered 2D house-and-garden scene with Camera2D, obstacle collision, 8-direction HD protagonist and interaction with Bu Sari. Walk/run gait is shader-assisted from one canonical HD pose per facing direction, not a full authored animation set. Farming economy, real animals, crop lifecycle, NPC schedules, interiors, and complete animations remain future milestones.
