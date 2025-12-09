extends RefCounted

## Input Event Tools
##
## Handles sending simulated input events to the running game or editor.

var editor_interface: EditorInterface
var editor_plugin: EditorPlugin

## Helper function to send input to the running game via HTTP
func _send_input_via_http(event_data: Dictionary) -> Dictionary:
	# Send input via HTTP to the game bridge server running in the game process
	var port := 8766
	var http := HTTPClient.new()
	var err := http.connect_to_host("127.0.0.1", port)

	if err != OK:
		return {
			"error": "Failed to connect to game bridge server. Is the game running?",
			"details": error_string(err)
		}

	# Wait for connection
	var timeout := 30  # 3 seconds timeout (100ms per poll * 30)
	var poll_count := 0

	while http.get_status() == HTTPClient.STATUS_CONNECTING or http.get_status() == HTTPClient.STATUS_RESOLVING:
		http.poll()
		OS.delay_msec(100)
		poll_count += 1
		if poll_count > timeout:
			return {"error": "Connection timeout. Is the game running with the game bridge enabled?"}

	if http.get_status() != HTTPClient.STATUS_CONNECTED:
		return {
			"error": "Failed to connect to game bridge server",
			"status": http.get_status()
		}

	# Prepare JSON body
	var json_body := JSON.stringify(event_data)
	var headers := [
		"Content-Type: application/json",
		"Content-Length: " + str(json_body.length())
	]

	# Send POST request
	err = http.request(HTTPClient.METHOD_POST, "/input", headers, json_body)

	if err != OK:
		return {"error": "Failed to send request: " + error_string(err)}

	# Wait for response
	poll_count = 0
	while http.get_status() == HTTPClient.STATUS_REQUESTING:
		http.poll()
		OS.delay_msec(100)
		poll_count += 1
		if poll_count > timeout:
			return {"error": "Request timeout"}

	if not http.has_response():
		return {"error": "No response from server"}

	# Read response
	var response_body := PackedByteArray()
	while http.get_status() == HTTPClient.STATUS_BODY:
		http.poll()
		var chunk := http.read_response_body_chunk()
		if chunk.size() == 0:
			OS.delay_msec(100)
		else:
			response_body.append_array(chunk)

	# Parse JSON response
	var json := JSON.new()
	var parse_err := json.parse(response_body.get_string_from_utf8())

	if parse_err != OK:
		return {"error": "Failed to parse response: " + json.get_error_message()}

	return json.data if json.data is Dictionary else {"error": "Invalid response format"}

func send_input_action(args: Dictionary) -> Variant:
	"""Send an input action event (as if the player pressed a mapped action)."""
	if not args.has("action_name"):
		return {"error": "Missing required argument: action_name"}

	var action_name: String = args.action_name
	var pressed: bool = args.get("pressed", true)
	var strength: float = args.get("strength", 1.0)

	if not InputMap.has_action(action_name):
		return {"error": "Action not found: " + action_name}

	# Send via HTTP to game bridge
	var event_data := {
		"event_type": "action",
		"action_name": action_name,
		"pressed": pressed,
		"strength": strength
	}

	var result := _send_input_via_http(event_data)

	if result.has("error"):
		return result

	return {
		"success": true,
		"action_name": action_name,
		"pressed": pressed,
		"strength": strength,
		"message": "Input action sent to running game"
	}

func send_key_event(args: Dictionary) -> Variant:
	"""Send a keyboard key event."""
	if not args.has("keycode") and not args.has("physical_keycode"):
		return {"error": "Missing required argument: keycode or physical_keycode"}

	var keycode: int = args.get("keycode", 0)
	var physical_keycode: int = args.get("physical_keycode", 0)
	var pressed: bool = args.get("pressed", true)
	var echo: bool = args.get("echo", false)

	# Modifiers
	var alt: bool = args.get("alt_pressed", false)
	var shift: bool = args.get("shift_pressed", false)
	var ctrl: bool = args.get("ctrl_pressed", false)
	var meta: bool = args.get("meta_pressed", false)

	# Send via HTTP to game bridge
	var event_data := {
		"event_type": "key",
		"keycode": keycode,
		"physical_keycode": physical_keycode,
		"pressed": pressed,
		"echo": echo,
		"alt_pressed": alt,
		"shift_pressed": shift,
		"ctrl_pressed": ctrl,
		"meta_pressed": meta
	}

	var result := _send_input_via_http(event_data)

	if result.has("error"):
		return result

	return {
		"success": true,
		"keycode": keycode,
		"physical_keycode": physical_keycode,
		"pressed": pressed,
		"key_label": OS.get_keycode_string(keycode if keycode != 0 else physical_keycode),
		"message": "Key event sent to running game"
	}

func send_mouse_button_event(args: Dictionary) -> Variant:
	"""Send a mouse button event."""
	if not args.has("button_index"):
		return {"error": "Missing required argument: button_index"}

	var button_index: int = args.button_index
	var pressed: bool = args.get("pressed", true)
	var position_x: float = args.get("position_x", 0.0)
	var position_y: float = args.get("position_y", 0.0)
	var double_click: bool = args.get("double_click", false)

	# Modifiers
	var alt: bool = args.get("alt_pressed", false)
	var shift: bool = args.get("shift_pressed", false)
	var ctrl: bool = args.get("ctrl_pressed", false)
	var meta: bool = args.get("meta_pressed", false)

	# Send via HTTP to game bridge
	var event_data := {
		"event_type": "mouse_button",
		"button_index": button_index,
		"pressed": pressed,
		"position_x": position_x,
		"position_y": position_y,
		"double_click": double_click,
		"alt_pressed": alt,
		"shift_pressed": shift,
		"ctrl_pressed": ctrl,
		"meta_pressed": meta
	}

	var result := _send_input_via_http(event_data)

	if result.has("error"):
		return result

	return {
		"success": true,
		"button_index": button_index,
		"pressed": pressed,
		"position": {"x": position_x, "y": position_y},
		"message": "Mouse button event sent to running game"
	}

func send_mouse_motion_event(args: Dictionary) -> Variant:
	"""Send a mouse motion event."""
	var position_x: float = args.get("position_x", 0.0)
	var position_y: float = args.get("position_y", 0.0)
	var relative_x: float = args.get("relative_x", 0.0)
	var relative_y: float = args.get("relative_y", 0.0)
	var velocity_x: float = args.get("velocity_x", 0.0)
	var velocity_y: float = args.get("velocity_y", 0.0)

	# Modifiers
	var alt: bool = args.get("alt_pressed", false)
	var shift: bool = args.get("shift_pressed", false)
	var ctrl: bool = args.get("ctrl_pressed", false)
	var meta: bool = args.get("meta_pressed", false)

	# Send via HTTP to game bridge
	var event_data := {
		"event_type": "mouse_motion",
		"position_x": position_x,
		"position_y": position_y,
		"relative_x": relative_x,
		"relative_y": relative_y,
		"velocity_x": velocity_x,
		"velocity_y": velocity_y,
		"alt_pressed": alt,
		"shift_pressed": shift,
		"ctrl_pressed": ctrl,
		"meta_pressed": meta
	}

	var result := _send_input_via_http(event_data)

	if result.has("error"):
		return result

	return {
		"success": true,
		"position": {"x": position_x, "y": position_y},
		"relative": {"x": relative_x, "y": relative_y},
		"message": "Mouse motion event sent to running game"
	}

func send_joypad_button_event(args: Dictionary) -> Variant:
	"""Send a joypad button event."""
	if not args.has("button_index"):
		return {"error": "Missing required argument: button_index"}

	var button_index: int = args.button_index
	var pressed: bool = args.get("pressed", true)
	var pressure: float = args.get("pressure", 1.0)
	var device: int = args.get("device", 0)

	# Send via HTTP to game bridge
	var event_data := {
		"event_type": "joypad_button",
		"button_index": button_index,
		"pressed": pressed,
		"pressure": pressure,
		"device": device
	}

	var result := _send_input_via_http(event_data)

	if result.has("error"):
		return result

	return {
		"success": true,
		"button_index": button_index,
		"pressed": pressed,
		"device": device,
		"message": "Joypad button event sent to running game"
	}

func send_joypad_motion_event(args: Dictionary) -> Variant:
	"""Send a joypad axis motion event."""
	if not args.has("axis"):
		return {"error": "Missing required argument: axis"}
	if not args.has("axis_value"):
		return {"error": "Missing required argument: axis_value"}

	var axis: int = args.axis
	var axis_value: float = args.axis_value
	var device: int = args.get("device", 0)

	# Send via HTTP to game bridge
	var event_data := {
		"event_type": "joypad_motion",
		"axis": axis,
		"axis_value": axis_value,
		"device": device
	}

	var result := _send_input_via_http(event_data)

	if result.has("error"):
		return result

	return {
		"success": true,
		"axis": axis,
		"axis_value": axis_value,
		"device": device,
		"message": "Joypad motion event sent to running game"
	}

func get_input_constants(args: Dictionary) -> Variant:
	"""Get helpful constants for key codes, mouse buttons, and joypad buttons."""
	var constant_type: String = args.get("type", "all")
	
	var result := {
		"success": true
	}
	
	if constant_type == "all" or constant_type == "keys":
		result["keys"] = {
			"KEY_ESCAPE": KEY_ESCAPE,
			"KEY_ENTER": KEY_ENTER,
			"KEY_SPACE": KEY_SPACE,
			"KEY_A": KEY_A,
			"KEY_B": KEY_B,
			"KEY_C": KEY_C,
			"KEY_D": KEY_D,
			"KEY_E": KEY_E,
			"KEY_F": KEY_F,
			"KEY_W": KEY_W,
			"KEY_S": KEY_S,
			"KEY_LEFT": KEY_LEFT,
			"KEY_RIGHT": KEY_RIGHT,
			"KEY_UP": KEY_UP,
			"KEY_DOWN": KEY_DOWN,
			"KEY_SHIFT": KEY_SHIFT,
			"KEY_CTRL": KEY_CTRL,
			"KEY_ALT": KEY_ALT,
			"KEY_0": KEY_0,
			"KEY_1": KEY_1,
			"KEY_2": KEY_2,
			"KEY_3": KEY_3,
			"KEY_4": KEY_4,
			"KEY_5": KEY_5,
			"KEY_6": KEY_6,
			"KEY_7": KEY_7,
			"KEY_8": KEY_8,
			"KEY_9": KEY_9
		}
	
	if constant_type == "all" or constant_type == "mouse":
		result["mouse_buttons"] = {
			"MOUSE_BUTTON_LEFT": MOUSE_BUTTON_LEFT,
			"MOUSE_BUTTON_RIGHT": MOUSE_BUTTON_RIGHT,
			"MOUSE_BUTTON_MIDDLE": MOUSE_BUTTON_MIDDLE,
			"MOUSE_BUTTON_WHEEL_UP": MOUSE_BUTTON_WHEEL_UP,
			"MOUSE_BUTTON_WHEEL_DOWN": MOUSE_BUTTON_WHEEL_DOWN
		}
	
	if constant_type == "all" or constant_type == "joypad":
		result["joypad_buttons"] = {
			"JOY_BUTTON_A": JOY_BUTTON_A,
			"JOY_BUTTON_B": JOY_BUTTON_B,
			"JOY_BUTTON_X": JOY_BUTTON_X,
			"JOY_BUTTON_Y": JOY_BUTTON_Y,
			"JOY_BUTTON_BACK": JOY_BUTTON_BACK,
			"JOY_BUTTON_START": JOY_BUTTON_START,
			"JOY_BUTTON_LEFT_SHOULDER": JOY_BUTTON_LEFT_SHOULDER,
			"JOY_BUTTON_RIGHT_SHOULDER": JOY_BUTTON_RIGHT_SHOULDER
		}
		result["joypad_axes"] = {
			"JOY_AXIS_LEFT_X": JOY_AXIS_LEFT_X,
			"JOY_AXIS_LEFT_Y": JOY_AXIS_LEFT_Y,
			"JOY_AXIS_RIGHT_X": JOY_AXIS_RIGHT_X,
			"JOY_AXIS_RIGHT_Y": JOY_AXIS_RIGHT_Y,
			"JOY_AXIS_TRIGGER_LEFT": JOY_AXIS_TRIGGER_LEFT,
			"JOY_AXIS_TRIGGER_RIGHT": JOY_AXIS_TRIGGER_RIGHT
		}

	return result

func send_input_sequence(args: Dictionary) -> Variant:
	"""Send a sequence of input events with optional delays between them and optional screenshot at the end."""
	if not args.has("sequence"):
		return {"error": "Missing required argument: sequence"}

	var sequence: Array = args.sequence
	if not sequence is Array or sequence.is_empty():
		return {"error": "Sequence must be a non-empty array"}

	var capture_screenshot: bool = args.get("capture_screenshot", false)

	# Validate each event in the sequence before sending
	for i in range(sequence.size()):
		var event_data = sequence[i]
		if not event_data is Dictionary:
			return {"error": "Sequence item %d is not an object" % i}

		var event_type: String = event_data.get("event_type", "")
		if event_type.is_empty():
			return {"error": "Sequence item %d is missing event_type" % i}

		# Validate specific event types
		match event_type:
			"action":
				if not event_data.has("action_name"):
					return {"error": "Sequence item %d (action event) missing action_name" % i}
				if not InputMap.has_action(event_data.action_name):
					return {"error": "Sequence item %d: Action not found: %s" % [i, event_data.action_name]}
			"key":
				if event_data.get("keycode", 0) == 0 and event_data.get("physical_keycode", 0) == 0:
					return {"error": "Sequence item %d (key event) must have keycode or physical_keycode" % i}
			"mouse_button":
				if not event_data.has("button_index"):
					return {"error": "Sequence item %d (mouse_button event) missing button_index" % i}
			"joypad_button":
				if not event_data.has("button_index"):
					return {"error": "Sequence item %d (joypad_button event) missing button_index" % i}
			"joypad_motion":
				if not event_data.has("axis") or not event_data.has("axis_value"):
					return {"error": "Sequence item %d (joypad_motion event) missing axis or axis_value" % i}
			"mouse_motion", _:
				# mouse_motion has all optional parameters
				pass

	# Send via HTTP to game bridge
	var request_data := {
		"sequence": sequence,
		"capture_screenshot": capture_screenshot
	}

	var port := 8766
	var http := HTTPClient.new()
	var err := http.connect_to_host("127.0.0.1", port)

	if err != OK:
		return {
			"error": "Failed to connect to game bridge server. Is the game running?",
			"details": error_string(err)
		}

	# Wait for connection
	var timeout := 30  # 3 seconds timeout (100ms per poll * 30)
	var poll_count := 0

	while http.get_status() == HTTPClient.STATUS_CONNECTING or http.get_status() == HTTPClient.STATUS_RESOLVING:
		http.poll()
		OS.delay_msec(100)
		poll_count += 1
		if poll_count > timeout:
			return {"error": "Connection timeout. Is the game running with the game bridge enabled?"}

	if http.get_status() != HTTPClient.STATUS_CONNECTED:
		return {
			"error": "Failed to connect to game bridge server",
			"status": http.get_status()
		}

	# Prepare JSON body
	var json_body := JSON.stringify(request_data)
	var headers := [
		"Content-Type: application/json",
		"Content-Length: " + str(json_body.length())
	]

	# Send POST request
	err = http.request(HTTPClient.METHOD_POST, "/input-sequence", headers, json_body)

	if err != OK:
		return {"error": "Failed to send request: " + error_string(err)}

	# Wait for response
	poll_count = 0
	while http.get_status() == HTTPClient.STATUS_REQUESTING:
		http.poll()
		OS.delay_msec(100)
		poll_count += 1
		if poll_count > timeout:
			return {"error": "Request timeout"}

	if not http.has_response():
		return {"error": "No response from server"}

	# Read response
	var response_body := PackedByteArray()
	while http.get_status() == HTTPClient.STATUS_BODY:
		http.poll()
		var chunk := http.read_response_body_chunk()
		if chunk.size() == 0:
			OS.delay_msec(100)
		else:
			response_body.append_array(chunk)

	# Parse JSON response
	var json := JSON.new()
	var parse_err := json.parse(response_body.get_string_from_utf8())

	if parse_err != OK:
		return {"error": "Failed to parse response: " + json.get_error_message()}

	var result = json.data if json.data is Dictionary else {"error": "Invalid response format"}

	if result.has("error"):
		return result

	return {
		"success": true,
		"events_sent": result.get("events_sent", sequence.size()),
		"message": result.get("message", "Input sequence sent to running game"),
		"screenshot": result.get("screenshot", null)
	}
