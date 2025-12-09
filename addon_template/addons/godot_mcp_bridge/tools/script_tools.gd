extends RefCounted

## Script Operation Tools
##
## Tools for working with scripts in the editor.

var editor_interface: EditorInterface

func get_node_script(args: Dictionary) -> Dictionary:
	if not args.has("node_path"):
		return {"error": "Missing required parameter: node_path"}
	
	var node := _get_node_from_path(args.node_path)
	if not node:
		return {"error": "Node not found: " + str(args.node_path)}
	
	var script = node.get_script()
	if not script:
		return {
			"has_script": false,
			"node_path": str(node.get_path())
		}
	
	var script_path := ""
	if script.resource_path:
		script_path = script.resource_path
	
	return {
		"has_script": true,
		"script_path": script_path,
		"node_path": str(node.get_path())
	}

func set_node_script(args: Dictionary) -> Dictionary:
	if not args.has("node_path"):
		return {"error": "Missing required parameter: node_path"}
	if not args.has("script_path"):
		return {"error": "Missing required parameter: script_path"}
	
	var node := _get_node_from_path(args.node_path)
	if not node:
		return {"error": "Node not found: " + str(args.node_path)}
	
	var script_path: String = args.script_path
	
	# Empty path removes the script
	if script_path.is_empty():
		node.set_script(null)
		return {
			"success": true,
			"node_path": str(node.get_path()),
			"action": "removed"
		}
	
	# Load the script
	if not FileAccess.file_exists(script_path):
		return {"error": "Script file not found: " + script_path}
	
	var script := load(script_path)
	if not script:
		return {"error": "Failed to load script: " + script_path}
	
	node.set_script(script)
	
	return {
		"success": true,
		"node_path": str(node.get_path()),
		"script_path": script_path,
		"action": "attached"
	}

func get_script_source(args: Dictionary) -> Dictionary:
	if not args.has("script_path"):
		return {"error": "Missing required parameter: script_path"}
	
	var script_path: String = args.script_path
	
	if not FileAccess.file_exists(script_path):
		return {"error": "Script file not found: " + script_path}
	
	var file := FileAccess.open(script_path, FileAccess.READ)
	if not file:
		return {"error": "Failed to open script file: " + script_path}
	
	var source := file.get_as_text()
	file.close()
	
	return {
		"script_path": script_path,
		"source": source
	}

func _get_node_from_path(path: String) -> Node:
	var edited_scene := editor_interface.get_edited_scene_root()
	if not edited_scene:
		return null
	
	if path.begins_with("/root/"):
		return edited_scene.get_node_or_null(path)
	else:
		return edited_scene.get_node_or_null(path)
