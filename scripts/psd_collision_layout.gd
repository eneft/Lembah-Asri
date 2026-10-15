extends RefCounted
## Original 1672x941 Photoshop pixel coordinates: player FOOT, not sprite center.
## Trace hand-painted safe ground, bridge deck, and exit bank independently.
## Footprint clearance and segmented swept motion are applied in gameplay.
static func regions() -> Dictionary:
 return {
  "Halaman dalam pagar": PackedVector2Array([
   Vector2(326,397), Vector2(415,400), Vector2(570,402), Vector2(710,403),
   Vector2(845,362), Vector2(943,352), Vector2(1000,359), Vector2(1070,391),
   Vector2(1150,427), Vector2(1208,461), Vector2(1325,509), Vector2(1345,530),
   Vector2(1290,549), Vector2(1200,561), Vector2(1140,576), Vector2(1090,596),
   Vector2(1050,604), Vector2(990,599), Vector2(930,605), Vector2(845,628),
   Vector2(765,648), Vector2(690,669), Vector2(625,685), Vector2(555,662),
   Vector2(495,636), Vector2(440,604), Vector2(387,575), Vector2(350,527),
   Vector2(319,468)
  ]),
  "Jalur papan jembatan": PackedVector2Array([
   Vector2(1090,584), Vector2(1140,577), Vector2(1205,590),
   Vector2(1300,622), Vector2(1380,650), Vector2(1500,692),
   Vector2(1620,735), Vector2(1620,790), Vector2(1550,813),
   Vector2(1450,778), Vector2(1350,746), Vector2(1240,710),
   Vector2(1145,674), Vector2(1097,630)
  ]),
  "Akses seberang": PackedVector2Array([
   Vector2(1560,755), Vector2(1670,752), Vector2(1670,884),
   Vector2(1620,889), Vector2(1530,827)
  ])
 }
