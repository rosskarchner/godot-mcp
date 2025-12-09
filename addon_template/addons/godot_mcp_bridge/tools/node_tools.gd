extends RefCounted

## Node Operation Tools
##
## Tools for manipulating nodes in the scene tree.

var editor_interface: EditorInterface

func get_node_info(args: Dictionary) -> Dictionary:
	if not args.has("node_path"):
		return {"error": "Missing required parameter: node_path"}
	
	var node := _get_node_from_path(args.node_path)
	if not node:
		return {"error": "Node not found: " + str(args.node_path)}
	
	var info := {
		"name": node.name,
		"type": node.get_class(),
		"path": str(node.get_path()),
		"child_count": node.get_child_count(),
		"children": []
	}
	
	# Add children names
	for child in node.get_children():
		info.children.append(child.name)
	
	# Add parent info
	var parent := node.get_parent()
	if parent:
		info["parent"] = parent.name
	
	# Add script info
	var script := node.get_script()
	if script:
		info["script"] = script.resource_path
	
	return info

func get_node_properties(args: Dictionary) -> Dictionary:
	if not args.has("node_path"):
		return {"error": "Missing required parameter: node_path"}
	
	var node := _get_node_from_path(args.node_path)
	if not node:
		return {"error": "Node not found: " + str(args.node_path)}
	
	var properties := {}
	var property_list := node.get_property_list()
	
	for prop in property_list:
		# Skip internal properties
		if prop.usage & PROPERTY_USAGE_EDITOR:
			var prop_name: String = prop.name
			var value = node.get(prop_name)
			properties[prop_name] = _serialize_value(value)
	
	return {
		"node_path": str(node.get_path()),
		"properties": properties
	}

func set_node_property(args: Dictionary) -> Dictionary:
	if not args.has("node_path"):
		return {"error": "Missing required parameter: node_path"}
	if not args.has("property"):
		return {"error": "Missing required parameter: property"}
	if not args.has("value"):
		return {"error": "Missing required parameter: value"}
	
	var node := _get_node_from_path(args.node_path)
	if not node:
		return {"error": "Node not found: " + str(args.node_path)}
	
	var property: String = args.property
	var value = args.value
	
	# Convert value if needed
	var converted_value = _deserialize_value(value, node, property)
	
	# Set the property
	if not property in node:
		return {"error": "Property not found: " + property}
	
	node.set(property, converted_value)
	
	return {
		"success": true,
		"node_path": str(node.get_path()),
		"property": property,
		"value": _serialize_value(converted_value)
	}

func create_node(args: Dictionary) -> Dictionary:
	if not args.has("parent_path"):
		return {"error": "Missing required parameter: parent_path"}
	if not args.has("node_type"):
		return {"error": "Missing required parameter: node_type"}
	if not args.has("node_name"):
		return {"error": "Missing required parameter: node_name"}
	
	var parent := _get_node_from_path(args.parent_path)
	if not parent:
		return {"error": "Parent node not found: " + str(args.parent_path)}
	
	var node_type: String = args.node_type
	var node_name: String = args.node_name
	
	# Check if class exists
	if not ClassDB.class_exists(node_type):
		return {"error": "Unknown node type: " + node_type}
	
	# Create the node
	var new_node: Node = ClassDB.instantiate(node_type)
	if not new_node:
		return {"error": "Failed to instantiate node of type: " + node_type}
	
	new_node.name = node_name
	parent.add_child(new_node)
	new_node.owner = editor_interface.get_edited_scene_root()
	
	return {
		"success": true,
		"node_path": str(new_node.get_path()),
		"name": new_node.name,
		"type": new_node.get_class()
	}

func delete_node(args: Dictionary) -> Dictionary:
	if not args.has("node_path"):
		return {"error": "Missing required parameter: node_path"}
	
	var node := _get_node_from_path(args.node_path)
	if not node:
		return {"error": "Node not found: " + str(args.node_path)}
	
	# Can't delete the root node
	if node == editor_interface.get_edited_scene_root():
		return {"error": "Cannot delete the root node"}
	
	var node_path := str(node.get_path())
	node.queue_free()
	
	return {
		"success": true,
		"deleted_path": node_path
	}

func rename_node(args: Dictionary) -> Dictionary:
	if not args.has("node_path"):
		return {"error": "Missing required parameter: node_path"}
	if not args.has("new_name"):
		return {"error": "Missing required parameter: new_name"}
	
	var node := _get_node_from_path(args.node_path)
	if not node:
		return {"error": "Node not found: " + str(args.node_path)}
	
	var old_name := node.name
	var new_name: String = args.new_name
	
	node.name = new_name
	
	return {
		"success": true,
		"old_name": old_name,
		"new_name": new_name,
		"new_path": str(node.get_path())
	}

func _get_node_from_path(path: String) -> Node:
	var edited_scene := editor_interface.get_edited_scene_root()
	if not edited_scene:
		return null
	
	# Handle both absolute and relative paths
	if path.begins_with("/root/"):
		return edited_scene.get_node_or_null(path)
	else:
		return edited_scene.get_node_or_null(path)

func _serialize_value(value: Variant) -> Variant:
	if value is Vector2:
		return {"type": "Vector2", "x": value.x, "y": value.y}
	elif value is Vector3:
		return {"type": "Vector3", "x": value.x, "y": value.y, "z": value.z}
	elif value is Color:
		return {"type": "Color", "r": value.r, "g": value.g, "b": value.b, "a": value.a}
	elif value is Transform2D:
		return {"type": "Transform2D", "x": [value.x.x, value.x.y], "y": [value.y.x, value.y.y], "origin": [value.origin.x, value.origin.y]}
	elif value is NodePath:
		return {"type": "NodePath", "path": str(value)}
	elif value is Object and value.has_method("get_class"):
		return {"type": "Object", "class": value.get_class()}
	else:
		return value

func _deserialize_value(value: Variant, node: Node, property: String) -> Variant:
	# If value is a dictionary with type info, convert it
	if value is Dictionary and value.has("type"):
		match value.type:
			"Vector2":
				return Vector2(value.get("x", 0), value.get("y", 0))
			"Vector3":
				return Vector3(value.get("x", 0), value.get("y", 0), value.get("z", 0))
			"Color":
				return Color(value.get("r", 0), value.get("g", 0), value.get("b", 0), value.get("a", 1))
			"NodePath":
				return NodePath(value.get("path", ""))
	
	# Try to convert arrays to vectors if the property expects them
	if value is Array:
		var current_value = node.get(property)
		if current_value is Vector2 and value.size() >= 2:
			return Vector2(value[0], value[1])
		elif current_value is Vector3 and value.size() >= 3:
			return Vector3(value[0], value[1], value[2])
	
	return value
