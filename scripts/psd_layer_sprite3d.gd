@tool
extends Sprite3D
## Native editable Sprite3D, one PNG texture per original Photoshop layer.
@export_file("*.png") var psd_texture_path: String = "":
 set(value):
  psd_texture_path = value
  if is_inside_tree():
   _refresh_texture()

func _ready() -> void:
 _refresh_texture()

func _refresh_texture() -> void:
 if psd_texture_path.is_empty() or not ResourceLoader.exists(psd_texture_path):
  texture = null
  return
 texture = load(psd_texture_path) as Texture2D
