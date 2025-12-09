extends RefCounted

## Input Map Tools
##
## Handles getting and modifying Godot input action mappings.

var editor_interface: EditorInterface

func list_input_actions(args: Dictionary) -> Variant:
	"""List all input actions and their key bindings."""
	var actions: Array[Dictionary] = []
	
	for action_name in InputMap.get_actions():
		var action_data := {
			"name": str(action_name),
			"events": []
		}
		
		# Get all events for this action
		for event in InputMap.action_get_events(action_name):
			action_data.events.append(_serialize_input_event(event))
		
		actions.append(action_data)
	
	return {
		"success": true,
		"count": len(actions),
		"actions": actions
	}

func get_input_action(args: Dictionary) -> Variant:
	"""Get details about a specific input action."""
	if not args.has("action_name"):
		return {"error": "Missing required argument: action_name"}
	
	var action_name: String = args.action_name
	
	if not InputMap.has_action(action_name):
		return {"error": "Action not found: " + action_name}
	
	var events: Array[Dictionary] = []
	for event in InputMap.action_get_events(action_name):
		events.append(_serialize_input_event(event))
	
	var deadzone := InputMap.action_get_deadzone(action_name)
	
	return {
		"success": true,
		"name": action_name,
		"events": events,
		"deadzone": deadzone
	}

func add_input_action(args: Dictionary) -> Variant:
	"""Create a new input action."""
	if not args.has("action_name"):
		return {"error": "Missing required argument: action_name"}
	
	var action_name: String = args.action_name
	var deadzone: float = args.get("deadzone", 0.5)
	
	if InputMap.has_action(action_name):
		return {"error": "Action already exists: " + action_name}
	
	InputMap.add_action(action_name, deadzone)
	
	# Save to project settings
	_save_input_map()
	
	return {
		"success": true,
		"action_name": action_name,
		"deadzone": deadzone,
		"message": "Input action created"
	}

func remove_input_action(args: Dictionary) -> Variant:
	"""Delete an input action."""
	if not args.has("action_name"):
		return {"error": "Missing required argument: action_name"}
	
	var action_name: String = args.action_name
	
	if not InputMap.has_action(action_name):
		return {"error": "Action not found: " + action_name}
	
	InputMap.erase_action(action_name)
	
	# Save to project settings
	_save_input_map()
	
	return {
		"success": true,
		"action_name": action_name,
		"message": "Input action removed"
	}

func add_input_event_to_action(args: Dictionary) -> Variant:
	"""Add an input event (key, mouse button, etc.) to an action."""
	if not args.has("action_name"):
		return {"error": "Missing required argument: action_name"}
	if not args.has("event"):
		return {"error": "Missing required argument: event"}
	
	var action_name: String = args.action_name
	
	if not InputMap.has_action(action_name):
		return {"error": "Action not found: " + action_name}
	
	var event := _deserialize_input_event(args.event)
	if event == null:
		return {"error": "Invalid event specification"}
	
	InputMap.action_add_event(action_name, event)
	
	# Save to project settings
	_save_input_map()
	
	return {
		"success": true,
		"action_name": action_name,
		"event": _serialize_input_event(event),
		"message": "Input event added to action"
	}

func remove_input_event_from_action(args: Dictionary) -> Variant:
	"""Remove an input event from an action."""
	if not args.has("action_name"):
		return {"error": "Missing required argument: action_name"}
	if not args.has("event"):
		return {"error": "Missing required argument: event"}
	
	var action_name: String = args.action_name
	
	if not InputMap.has_action(action_name):
		return {"error": "Action not found: " + action_name}
	
	var event := _deserialize_input_event(args.event)
	if event == null:
		return {"error": "Invalid event specification"}
	
	InputMap.action_erase_event(action_name, event)
	
	# Save to project settings
	_save_input_map()
	
	return {
		"success": true,
		"action_name": action_name,
		"message": "Input event removed from action"
	}

func _serialize_input_event(event: InputEvent) -> Dictionary:
	"""Convert an InputEvent to a JSON-compatible dictionary."""
	var data := {
		"class": event.get_class()
	}
	
	if event is InputEventKey:
		data["type"] = "key"
		data["keycode"] = event.keycode
		data["physical_keycode"] = event.physical_keycode
		data["unicode"] = event.unicode
		data["pressed"] = event.pressed
		data["echo"] = event.echo
		data["key_label"] = OS.get_keycode_string(event.keycode)
	elif event is InputEventMouseButton:
		data["type"] = "mouse_button"
		data["button_index"] = event.button_index
		data["pressed"] = event.pressed
		data["double_click"] = event.double_click
	elif event is InputEventJoypadButton:
		data["type"] = "joypad_button"
		data["button_index"] = event.button_index
		data["pressed"] = event.pressed
	elif event is InputEventJoypadMotion:
		data["type"] = "joypad_motion"
		data["axis"] = event.axis
		data["axis_value"] = event.axis_value
	
	# Common modifiers
	if event is InputEventWithModifiers:
		data["alt_pressed"] = event.alt_pressed
		data["shift_pressed"] = event.shift_pressed
		data["ctrl_pressed"] = event.ctrl_pressed
		data["meta_pressed"] = event.meta_pressed
	
	return data

func _deserialize_input_event(data: Dictionary) -> InputEvent:
	"""Convert a dictionary to an InputEvent."""
	var event_type: String = data.get("type", "")
	var event: InputEvent = null
	
	match event_type:
		"key":
			var key_event := InputEventKey.new()
			key_event.keycode = data.get("keycode", 0)
			key_event.physical_keycode = data.get("physical_keycode", 0)
			key_event.pressed = data.get("pressed", true)
			key_event.echo = data.get("echo", false)
			
			# Set modifiers if present
			key_event.alt_pressed = data.get("alt_pressed", false)
			key_event.shift_pressed = data.get("shift_pressed", false)
			key_event.ctrl_pressed = data.get("ctrl_pressed", false)
			key_event.meta_pressed = data.get("meta_pressed", false)
			
			event = key_event
			
		"mouse_button":
			var mouse_event := InputEventMouseButton.new()
			mouse_event.button_index = data.get("button_index", 1)
			mouse_event.pressed = data.get("pressed", true)
			mouse_event.double_click = data.get("double_click", false)
			
			# Set modifiers if present
			mouse_event.alt_pressed = data.get("alt_pressed", false)
			mouse_event.shift_pressed = data.get("shift_pressed", false)
			mouse_event.ctrl_pressed = data.get("ctrl_pressed", false)
			mouse_event.meta_pressed = data.get("meta_pressed", false)
			
			event = mouse_event
			
		"joypad_button":
			var joy_button := InputEventJoypadButton.new()
			joy_button.button_index = data.get("button_index", 0)
			joy_button.pressed = data.get("pressed", true)
			event = joy_button
			
		"joypad_motion":
			var joy_motion := InputEventJoypadMotion.new()
			joy_motion.axis = data.get("axis", 0)
			joy_motion.axis_value = data.get("axis_value", 0.0)
			event = joy_motion
	
	return event

func _save_input_map() -> void:
	"""Save input map changes to project settings."""
	# The InputMap changes are automatically saved to ProjectSettings
	# We just need to trigger a save
	ProjectSettings.save()
