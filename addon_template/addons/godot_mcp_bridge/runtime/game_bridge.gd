extends Node

## MCP Game Bridge HTTP Server
##
## This autoload provides an HTTP API for interacting with the running game.
## Features:
## - Screenshots: GET /screenshot (with max_width, max_height, save_to_disk params)
## - Input Events: POST /input (JSON body with event details)
##
## It only runs when the game is being debugged (not in exported builds).
## Screenshots larger than 1MB are written to disk instead of returned directly.

var configured_port := 8766
const MAX_MEMORY_SIZE := 1048576  # 1MB in bytes
const SCREENSHOT_DIR := "user://mcp_screenshots"

var http_server: TCPServer
var client_connection: StreamPeerTCP
var is_running := false
var temp_screenshot_counter := 0

func _ready() -> void:
	# Only run when debugging
	if not OS.is_debug_build():
		queue_free()
		return

	# Create screenshot directory
	var dir := DirAccess.open("user://")
	if dir and not dir.dir_exists("mcp_screenshots"):
		dir.make_dir("mcp_screenshots")

	# Check for port override in command line args
	for arg in OS.get_cmdline_args():
		if arg.begins_with("--game-bridge-port="):
			configured_port = int(arg.trim_prefix("--game-bridge-port="))
	
	# Or via configuration
	if FileAccess.file_exists("res://addons/godot_mcp_bridge/mcp_config.gd"):
		var config_script = load("res://addons/godot_mcp_bridge/mcp_config.gd")
		if config_script:
			var config = config_script.new()
			# Check if property exists/is accessible
			var script_vars = config.get_script().get_script_constant_map()
			if script_vars.has("GAME_BRIDGE_PORT"):
				configured_port = script_vars["GAME_BRIDGE_PORT"]

	# Start HTTP server
	http_server = TCPServer.new()
	var err := http_server.listen(configured_port)

	if err == OK:
		is_running = true
		print("[MCP] Game bridge server started on port ", configured_port)
	else:
		push_error("[MCP] Failed to start game bridge server on port " + str(configured_port) + ": " + error_string(err))
		queue_free()

func _process(_delta: float) -> void:
	if not is_running:
		return

	# Accept new connections
	if http_server.is_connection_available():
		if client_connection and client_connection.get_status() == StreamPeerTCP.STATUS_CONNECTED:
			client_connection.disconnect_from_host()

		client_connection = http_server.take_connection()

	# Handle client requests
	if client_connection and client_connection.get_status() == StreamPeerTCP.STATUS_CONNECTED:
		if client_connection.get_available_bytes() > 0:
			_handle_request()

func _handle_request() -> void:
	var request_text := ""

	# Read the HTTP request
	while client_connection.get_available_bytes() > 0:
		request_text += client_connection.get_string(client_connection.get_available_bytes())
		await get_tree().process_frame

	# Parse request line to get path and method
	var lines := request_text.split("\r\n")
	if lines.size() == 0:
		_send_error_response(400, "Bad Request")
		return

	var request_line := lines[0].split(" ")
	if request_line.size() < 2:
		_send_error_response(400, "Bad Request")
		return

	var method := request_line[0]
	var path := request_line[1]

	# Extract body for POST requests
	var body := ""
	var body_start_idx := request_text.find("\r\n\r\n")
	if body_start_idx != -1:
		body = request_text.substr(body_start_idx + 4)

	# Route the request
	if method == "GET" and path.begins_with("/screenshot"):
		_handle_screenshot_request(path)
	elif method == "GET" and path.begins_with("/scene_tree"):
		_handle_scene_tree_request(path)
	elif method == "POST" and path.begins_with("/input-sequence"):
		_handle_input_sequence_request(body)
	elif method == "POST" and path.begins_with("/input"):
		_handle_input_request(body)
	else:
		_send_error_response(404, "Not Found")

func _handle_screenshot_request(path: String) -> void:
	# Parse query parameters
	var params := _parse_query_params(path)
	var max_width := int(params.get("max_width", "1280"))
	var max_height := int(params.get("max_height", "720"))
	var save_to_disk: bool = params.get("save_to_disk", "false") == "true"

	# Capture screenshot
	var viewport := get_viewport()
	if not viewport:
		_send_error_response(500, "No viewport available")
		return

	# Get viewport texture
	var image := viewport.get_texture().get_image()
	if not image:
		_send_error_response(500, "Failed to capture viewport image")
		return

	var original_width := image.get_width()
	var original_height := image.get_height()

	# Apply resolution scaling if needed
	if original_width > max_width or original_height > max_height:
		var scale_x := float(max_width) / float(original_width)
		var scale_y := float(max_height) / float(original_height)
		var scale := min(scale_x, scale_y)

		var new_width := int(original_width * scale)
		var new_height := int(original_height * scale)

		image.resize(new_width, new_height, Image.INTERPOLATE_LANCZOS)

	# Convert to PNG
	var png_data := image.save_png_to_buffer()
	var data_size := png_data.size()

	# Save to disk if explicitly requested OR if data is larger than 1MB
	if save_to_disk or data_size > MAX_MEMORY_SIZE:
		var file_path := _save_screenshot_to_disk(png_data)
		var note := "Screenshot saved to disk (explicitly requested)" if save_to_disk else "Screenshot saved to disk (exceeds 1MB limit)"
		_send_json_response({
			"success": true,
			"format": "png",
			"width": image.get_width(),
			"height": image.get_height(),
			"original_size": {"width": original_width, "height": original_height},
			"size_bytes": data_size,
			"file_path": file_path,
			"note": note
		})
	else:
		# Return base64-encoded data
		var base64 := Marshalls.raw_to_base64(png_data)
		_send_json_response({
			"success": true,
			"format": "png",
			"width": image.get_width(),
			"height": image.get_height(),
			"original_size": {"width": original_width, "height": original_height},
			"size_bytes": data_size,
			"data": base64
		})

func _handle_scene_tree_request(path: String) -> void:
	# Parse query parameters
	var params := _parse_query_params(path)
	var max_depth := int(params.get("max_depth", "10"))
	
	# Get the root of the running game's scene tree
	var root := get_tree().root
	if not root:
		_send_error_response(500, "No scene tree available")
		return
	
	# Build the tree structure
	var tree := _build_node_tree(root, 0, max_depth)
	
	var response_data := {
		"success": true,
		"root": tree
	}
	
	_send_json_response(response_data)

func _build_node_tree(node: Node, current_depth: int, max_depth: int) -> Dictionary:
	var result := {
		"name": node.name,
		"type": node.get_class(),
		"path": str(node.get_path()),
		"children": []
	}
	
	# Add basic transform info for spatial nodes
	if node is Node2D:
		result["position"] = [node.position.x, node.position.y]
		result["rotation"] = node.rotation
		result["scale"] = [node.scale.x, node.scale.y]
	elif node is Node3D:
		result["position"] = [node.position.x, node.position.y, node.position.z]
		result["rotation"] = [node.rotation.x, node.rotation.y, node.rotation.z]
		result["scale"] = [node.scale.x, node.scale.y, node.scale.z]
	
	# Recursively add children if not at max depth
	if current_depth < max_depth:
		for child in node.get_children():
			result.children.append(_build_node_tree(child, current_depth + 1, max_depth))
	
	return result

func _handle_input_request(body: String) -> void:
	# Parse JSON body
	var json := JSON.new()
	var parse_err := json.parse(body)

	if parse_err != OK:
		_send_error_response(400, "Invalid JSON: " + json.get_error_message())
		return

	var data = json.data
	if not data is Dictionary:
		_send_error_response(400, "Expected JSON object")
		return

	var event_type: String = data.get("event_type", "")

	# Create the appropriate event based on type
	var event: InputEvent = null

	match event_type:
		"action":
			event = _create_action_event(data)
		"key":
			event = _create_key_event(data)
		"mouse_button":
			event = _create_mouse_button_event(data)
		"mouse_motion":
			event = _create_mouse_motion_event(data)
		"joypad_button":
			event = _create_joypad_button_event(data)
		"joypad_motion":
			event = _create_joypad_motion_event(data)
		_:
			_send_error_response(400, "Unknown event_type: " + event_type)
			return

	if not event:
		_send_error_response(400, "Failed to create event")
		return

	# Send the event to the running game
	print("[MCP] Sending input event: ", event_type)

	# Mouse button events currently require proper GUI routing setup
	# For now, send them through the standard input system
	if event is InputEventMouseButton:
		var mouse_event = event as InputEventMouseButton
		print("[MCP] Mouse button event at position: ", mouse_event.position)
		print("[MCP] Note: UI element click detection requires further setup")

	# Route through the input system
	get_tree().root.push_input(event)

	var response_msg = "Input event sent to game"
	if event_type == "mouse_button":
		response_msg = "Mouse button event sent. Note: UI element click detection is not yet fully supported. Use input actions or keyboard events for UI interaction."

	_send_json_response({
		"success": true,
		"event_type": event_type,
		"message": response_msg
	})


func _handle_input_sequence_request(body: String) -> void:
	# Parse JSON body
	var json := JSON.new()
	var parse_err := json.parse(body)

	if parse_err != OK:
		_send_error_response(400, "Invalid JSON: " + json.get_error_message())
		return

	var data = json.data
	if not data is Dictionary:
		_send_error_response(400, "Expected JSON object")
		return

	var sequence: Array = data.get("sequence", [])
	if sequence.is_empty():
		_send_error_response(400, "Sequence is empty")
		return

	var capture_screenshot: bool = data.get("capture_screenshot", false)

	# Process the sequence of input events
	var events_sent := 0
	for i in range(sequence.size()):
		var event_data = sequence[i]
		if not event_data is Dictionary:
			_send_error_response(400, "Sequence item %d is not an object" % i)
			return

		var delay_ms: int = event_data.get("delay_ms", 0)

		# Wait before sending this event (except for the first one at index 0 with no delay)
		if delay_ms > 0:
			await get_tree().create_timer(delay_ms / 1000.0).timeout

		# Create and send the event
		var event_type: String = event_data.get("event_type", "")
		var event: InputEvent = null

		match event_type:
			"action":
				event = _create_action_event(event_data)
			"key":
				event = _create_key_event(event_data)
			"mouse_button":
				event = _create_mouse_button_event(event_data)
			"mouse_motion":
				event = _create_mouse_motion_event(event_data)
			"joypad_button":
				event = _create_joypad_button_event(event_data)
			"joypad_motion":
				event = _create_joypad_motion_event(event_data)
			_:
				_send_error_response(400, "Unknown event_type at index %d: %s" % [i, event_type])
				return

		if not event:
			_send_error_response(400, "Failed to create event at index %d" % i)
			return

		print("[MCP] Sending sequence event %d: %s" % [i, event_type])
		get_tree().root.push_input(event)
		events_sent += 1

	# Optionally capture screenshot at the end
	var response_data := {
		"success": true,
		"events_sent": events_sent,
		"message": "Input sequence sent to game"
	}

	if capture_screenshot:
		var viewport := get_viewport()
		if viewport:
			var image := viewport.get_texture().get_image()
			if image:
				var max_width := 1280
				var max_height := 720

				# Apply resolution scaling if needed
				var original_width := image.get_width()
				var original_height := image.get_height()

				if original_width > max_width or original_height > max_height:
					var scale_x := float(max_width) / float(original_width)
					var scale_y := float(max_height) / float(original_height)
					var scale := min(scale_x, scale_y)

					var new_width := int(original_width * scale)
					var new_height := int(original_height * scale)

					image.resize(new_width, new_height, Image.INTERPOLATE_LANCZOS)

				# Convert to PNG
				var png_data := image.save_png_to_buffer()
				var data_size := png_data.size()

				# Save to disk if data is larger than 1MB
				if data_size > MAX_MEMORY_SIZE:
					var file_path := _save_screenshot_to_disk(png_data)
					response_data["screenshot"] = {
						"format": "png",
						"width": image.get_width(),
						"height": image.get_height(),
						"original_size": {"width": original_width, "height": original_height},
						"size_bytes": data_size,
						"file_path": file_path
					}
				else:
					# Return base64-encoded data
					var base64 := Marshalls.raw_to_base64(png_data)
					response_data["screenshot"] = {
						"format": "png",
						"width": image.get_width(),
						"height": image.get_height(),
						"original_size": {"width": original_width, "height": original_height},
						"size_bytes": data_size,
						"data": base64
					}

	_send_json_response(response_data)


func _create_action_event(data: Dictionary) -> InputEventAction:
	var event := InputEventAction.new()
	event.action = data.get("action_name", "")
	event.pressed = data.get("pressed", true)
	event.strength = data.get("strength", 1.0)
	return event

func _create_key_event(data: Dictionary) -> InputEventKey:
	var event := InputEventKey.new()
	event.keycode = data.get("keycode", 0)
	event.physical_keycode = data.get("physical_keycode", 0)
	event.pressed = data.get("pressed", true)
	event.echo = data.get("echo", false)
	event.alt_pressed = data.get("alt_pressed", false)
	event.shift_pressed = data.get("shift_pressed", false)
	event.ctrl_pressed = data.get("ctrl_pressed", false)
	event.meta_pressed = data.get("meta_pressed", false)
	return event

func _create_mouse_button_event(data: Dictionary) -> InputEventMouseButton:
	var event := InputEventMouseButton.new()
	event.button_index = data.get("button_index", 1)
	event.pressed = data.get("pressed", true)
	event.position = Vector2(data.get("position_x", 0.0), data.get("position_y", 0.0))
	event.double_click = data.get("double_click", false)
	event.alt_pressed = data.get("alt_pressed", false)
	event.shift_pressed = data.get("shift_pressed", false)
	event.ctrl_pressed = data.get("ctrl_pressed", false)
	event.meta_pressed = data.get("meta_pressed", false)
	print("[MCP] Created mouse button event: button=%d, pressed=%s, position=%v" % [event.button_index, event.pressed, event.position])
	return event

func _create_mouse_motion_event(data: Dictionary) -> InputEventMouseMotion:
	var event := InputEventMouseMotion.new()
	event.position = Vector2(data.get("position_x", 0.0), data.get("position_y", 0.0))
	event.relative = Vector2(data.get("relative_x", 0.0), data.get("relative_y", 0.0))
	event.velocity = Vector2(data.get("velocity_x", 0.0), data.get("velocity_y", 0.0))
	event.alt_pressed = data.get("alt_pressed", false)
	event.shift_pressed = data.get("shift_pressed", false)
	event.ctrl_pressed = data.get("ctrl_pressed", false)
	event.meta_pressed = data.get("meta_pressed", false)
	return event

func _create_joypad_button_event(data: Dictionary) -> InputEventJoypadButton:
	var event := InputEventJoypadButton.new()
	event.button_index = data.get("button_index", 0)
	event.pressed = data.get("pressed", true)
	event.pressure = data.get("pressure", 1.0)
	event.device = data.get("device", 0)
	return event

func _create_joypad_motion_event(data: Dictionary) -> InputEventJoypadMotion:
	var event := InputEventJoypadMotion.new()
	event.axis = data.get("axis", 0)
	event.axis_value = data.get("axis_value", 0.0)
	event.device = data.get("device", 0)
	return event

func _save_screenshot_to_disk(png_data: PackedByteArray) -> String:
	temp_screenshot_counter += 1
	var timestamp := Time.get_unix_time_from_system()
	var filename := "screenshot_%d_%d.png" % [timestamp, temp_screenshot_counter]
	var file_path := SCREENSHOT_DIR.path_join(filename)

	var file := FileAccess.open(file_path, FileAccess.WRITE)
	if not file:
		push_error("[MCP] Failed to save screenshot to disk")
		return ""

	file.store_buffer(png_data)
	file.close()

	# Convert to absolute path for client
	var absolute_path := ProjectSettings.globalize_path(file_path)
	return absolute_path

func _parse_query_params(path: String) -> Dictionary:
	var params := {}
	var query_start := path.find("?")

	if query_start == -1:
		return params

	var query := path.substr(query_start + 1)
	var pairs := query.split("&")

	for pair in pairs:
		var kv := pair.split("=")
		if kv.size() == 2:
			params[kv[0]] = kv[1]

	return params

func _send_json_response(data: Dictionary) -> void:
	var json := JSON.stringify(data)
	var response := "HTTP/1.1 200 OK\r\n"
	response += "Content-Type: application/json\r\n"
	response += "Content-Length: " + str(json.length()) + "\r\n"
	response += "Access-Control-Allow-Origin: *\r\n"
	response += "\r\n"
	response += json

	client_connection.put_data(response.to_utf8_buffer())
	client_connection.disconnect_from_host()

func _send_error_response(code: int, message: String) -> void:
	var json := JSON.stringify({"error": message})
	var response := "HTTP/1.1 " + str(code) + " " + message + "\r\n"
	response += "Content-Type: application/json\r\n"
	response += "Content-Length: " + str(json.length()) + "\r\n"
	response += "Access-Control-Allow-Origin: *\r\n"
	response += "\r\n"
	response += json

	client_connection.put_data(response.to_utf8_buffer())
	client_connection.disconnect_from_host()

func _exit_tree() -> void:
	if http_server:
		http_server.stop()

	if client_connection:
		client_connection.disconnect_from_host()

	print("[MCP] Game bridge server stopped")
