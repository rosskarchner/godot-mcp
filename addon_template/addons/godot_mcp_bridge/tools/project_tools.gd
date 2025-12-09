extends RefCounted

## Project Configuration Tools
##
## Handles getting and setting Godot project settings and configuration.

var editor_interface: EditorInterface

func get_project_setting(args: Dictionary) -> Variant:
	"""Get a project setting value."""
	if not args.has("setting_name"):
		return {"error": "Missing required argument: setting_name"}
	
	var setting_name: String = args.setting_name
	
	if not ProjectSettings.has_setting(setting_name):
		return {"error": "Setting not found: " + setting_name}
	
	var value = ProjectSettings.get_setting(setting_name)
	
	return {
		"success": true,
		"setting_name": setting_name,
		"value": _serialize_value(value),
		"type": _get_type_name(value)
	}

func set_project_setting(args: Dictionary) -> Variant:
	"""Set a project setting value."""
	if not args.has("setting_name"):
		return {"error": "Missing required argument: setting_name"}
	if not args.has("value"):
		return {"error": "Missing required argument: value"}
	
	var setting_name: String = args.setting_name
	var value = _deserialize_value(args.value)
	
	# Set the setting
	ProjectSettings.set_setting(setting_name, value)
	
	# Save to project.godot
	var save_result := ProjectSettings.save()
	if save_result != OK:
		return {"error": "Failed to save project settings: " + str(save_result)}
	
	return {
		"success": true,
		"setting_name": setting_name,
		"value": _serialize_value(value),
		"message": "Project setting updated and saved"
	}

func list_project_settings(args: Dictionary) -> Variant:
	"""List all project settings or filter by prefix."""
	var prefix: String = args.get("prefix", "")
	var settings: Array[Dictionary] = []
	
	for setting in ProjectSettings.get_property_list():
		var name: String = setting.name
		
		# Skip internal settings
		if name.begins_with("_"):
			continue
		
		# Apply prefix filter
		if prefix != "" and not name.begins_with(prefix):
			continue
		
		# Get the value
		var value = ProjectSettings.get_setting(name)
		
		settings.append({
			"name": name,
			"value": _serialize_value(value),
			"type": _get_type_name(value)
		})
	
	return {
		"success": true,
		"count": len(settings),
		"settings": settings
	}

func _serialize_value(value: Variant) -> Variant:
	"""Convert Godot types to JSON-compatible format."""
	if value is Vector2:
		return {"type": "Vector2", "x": value.x, "y": value.y}
	elif value is Vector3:
		return {"type": "Vector3", "x": value.x, "y": value.y, "z": value.z}
	elif value is Color:
		return {"type": "Color", "r": value.r, "g": value.g, "b": value.b, "a": value.a}
	elif value is Array:
		var arr: Array = []
		for item in value:
			arr.append(_serialize_value(item))
		return arr
	elif value is Dictionary:
		var dict: Dictionary = {}
		for key in value:
			dict[str(key)] = _serialize_value(value[key])
		return dict
	else:
		return value

func _deserialize_value(value: Variant) -> Variant:
	"""Convert JSON values to Godot types."""
	if value is Dictionary:
		if value.has("type"):
			match value.type:
				"Vector2":
					return Vector2(value.get("x", 0), value.get("y", 0))
				"Vector3":
					return Vector3(value.get("x", 0), value.get("y", 0), value.get("z", 0))
				"Color":
					return Color(value.get("r", 0), value.get("g", 0), value.get("b", 0), value.get("a", 1))
		# Regular dictionary
		var dict: Dictionary = {}
		for key in value:
			dict[key] = _deserialize_value(value[key])
		return dict
	elif value is Array:
		var arr: Array = []
		for item in value:
			arr.append(_deserialize_value(item))
		return arr
	else:
		return value

func _get_type_name(value: Variant) -> String:
	"""Get human-readable type name."""
	var type_id := typeof(value)
	match type_id:
		TYPE_NIL: return "null"
		TYPE_BOOL: return "bool"
		TYPE_INT: return "int"
		TYPE_FLOAT: return "float"
		TYPE_STRING: return "string"
		TYPE_VECTOR2: return "Vector2"
		TYPE_VECTOR3: return "Vector3"
		TYPE_COLOR: return "Color"
		TYPE_ARRAY: return "Array"
		TYPE_DICTIONARY: return "Dictionary"
		_: return "Variant"
