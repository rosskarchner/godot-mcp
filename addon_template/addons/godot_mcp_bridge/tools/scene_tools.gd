extends RefCounted

## Scene Management Tools
##
## Tools for managing scenes in the Godot editor.

var editor_interface: EditorInterface

func get_scene_tree(args: Dictionary) -> Dictionary:
	var max_depth: int = args.get("max_depth", 10)
	
	var edited_scene := editor_interface.get_edited_scene_root()
	if not edited_scene:
		return {"error": "No scene is currently open"}
	
	var tree := _build_node_tree(edited_scene, 0, max_depth)
	
	return {
		"scene_path": edited_scene.scene_file_path,
		"root": tree
	}

func get_current_scene() -> Dictionary:
	var edited_scene := editor_interface.get_edited_scene_root()
	if not edited_scene:
		return {"error": "No scene is currently open"}
	
	return {
		"path": edited_scene.scene_file_path,
		"name": edited_scene.name,
		"type": edited_scene.get_class(),
		"modified": editor_interface.is_plugin_enabled("mcp_server")  # Placeholder
	}

func save_scene() -> Dictionary:
	var edited_scene := editor_interface.get_edited_scene_root()
	if not edited_scene:
		return {"error": "No scene is currently open"}
	
	var err := editor_interface.save_scene()
	
	if err != OK:
		return {"error": "Failed to save scene: " + error_string(err)}
	
	return {
		"success": true,
		"path": edited_scene.scene_file_path
	}

func load_scene(args: Dictionary) -> Dictionary:
	if not args.has("path"):
		return {"error": "Missing required parameter: path"}
	
	var path: String = args.path
	
	if not FileAccess.file_exists(path):
		return {"error": "Scene file not found: " + path}

	editor_interface.open_scene_from_path(path)

	return {
		"success": true,
		"path": path
	}

func _build_node_tree(node: Node, current_depth: int, max_depth: int) -> Dictionary:
	var result := {
		"name": node.name,
		"type": node.get_class(),
		"path": str(node.get_path()),
		"children": []
	}
	
	# Add basic transform info for spatial nodes
	if node is Node2D:
		result["position"] = _vector2_to_array(node.position)
		result["rotation"] = node.rotation
		result["scale"] = _vector2_to_array(node.scale)
	elif node is Node3D:
		result["position"] = _vector3_to_array(node.position)
		result["rotation"] = _vector3_to_array(node.rotation)
		result["scale"] = _vector3_to_array(node.scale)
	
	# Recursively add children if not at max depth
	if current_depth < max_depth:
		for child in node.get_children():
			result.children.append(_build_node_tree(child, current_depth + 1, max_depth))
	
	return result

func _vector2_to_array(v: Vector2) -> Array:
	return [v.x, v.y]

func _vector3_to_array(v: Vector3) -> Array:
	return [v.x, v.y, v.z]

