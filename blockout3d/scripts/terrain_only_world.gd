extends "res://scripts/world.gd"
## Dedicated uploaded-terrain preview. Reuse the existing playable character,
## controls, camera and lighting, but never instantiate old island scenery.
func _load_island() -> void:
    pass

func _make_hud() -> void:
    super._make_hud()
    var title := get_node_or_null("BlockoutHUD/Title") as Label
    if title != null:
        title.text = "LEMBAH ASRI | TERRAIN BASE V2 | CHARACTER TEST"
    var house_status := get_node_or_null("BlockoutHUD/HouseAssetStatus") as Label
    if house_status != null:
        house_status.text = "Hanya terrain baru dan karakter | Tanpa objek atau collision lama"

var terrain_spawn_position := Vector3(0.0, 15.0, 0.0)

func _physics_process(_delta: float) -> void:
    if is_instance_valid(player) and player.global_position.y < -8.0:
        player.global_position = terrain_spawn_position
        player.velocity = Vector3.ZERO
