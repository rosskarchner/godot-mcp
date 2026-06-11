@tool
extends EditorDebuggerPlugin

# Dictionary to store session state: session_id -> { paused: bool, can_debug: bool, error: String, stack: Array }
var active_sessions = {}

# Message prefixes we want to capture for debugging info
const CAPTURED_PREFIXES = ["debug", "error", "scene"]

func _setup_session(session_id):
	var session = get_session(session_id)
	active_sessions[session_id] = {
		"paused": false,
		"can_debug": false,
		"error": "",
		"reason": "",
		"stack": [],
		"break_file": "",
		"break_line": -1
	}
	
	# Connect signals using callables
	session.breaked.connect(func(can_debug): _on_session_breaked(can_debug, session_id))
	session.continued.connect(func(): _on_session_continued(session_id))

func _on_session_breaked(can_debug, session_id):
	if active_sessions.has(session_id):
		active_sessions[session_id]["paused"] = true
		active_sessions[session_id]["can_debug"] = can_debug
		# Reset previous error info when newly breaked (will be populated by _capture)
		active_sessions[session_id]["error"] = ""
		active_sessions[session_id]["stack"] = []
		print("[MCP Debugger] Session ", session_id, " breaked. Can debug: ", can_debug)

func _on_session_continued(session_id):
	if active_sessions.has(session_id):
		active_sessions[session_id]["paused"] = false
		# Clear error info on continue
		active_sessions[session_id]["error"] = ""
		active_sessions[session_id]["reason"] = ""
		active_sessions[session_id]["stack"] = []
		active_sessions[session_id]["break_file"] = ""
		active_sessions[session_id]["break_line"] = -1
		print("[MCP Debugger] Session ", session_id, " continued.")

func _has_capture(capture: String) -> bool:
	# Capture debug messages to extract error/stack info
	for prefix in CAPTURED_PREFIXES:
		if capture.begins_with(prefix):
			return true
	return false

func _capture(message: String, data: Array, session_id: int) -> bool:
	if not active_sessions.has(session_id):
		return false
	
	# Handle various debug messages to extract useful info
	match message:
		"debug:error":
			# Error message: data[0] is type, data[1] is script, data[2] is func, data[3] is line, data[4] is error text
			if data.size() >= 5:
				var error_text = str(data[4]) if data.size() > 4 else ""
				var script_path = str(data[1]) if data.size() > 1 else ""
				var function_name = str(data[2]) if data.size() > 2 else ""
				var line_num = data[3] if data.size() > 3 else -1
				active_sessions[session_id]["error"] = error_text
				active_sessions[session_id]["break_file"] = script_path
				active_sessions[session_id]["break_line"] = line_num
				active_sessions[session_id]["reason"] = "error"
				print("[MCP Debugger] Captured error: ", error_text, " at ", script_path, ":", line_num)
			elif data.size() >= 1:
				active_sessions[session_id]["error"] = str(data[0])
			return true
		
		"debug:stack_dump":
			# Stack dump: array of stack frames
			var stack_frames = []
			for frame_data in data:
				if frame_data is Dictionary:
					stack_frames.append(frame_data)
				elif frame_data is Array and frame_data.size() >= 3:
					# Format: [file, line, function]
					stack_frames.append({
						"file": str(frame_data[0]),
						"line": int(frame_data[1]) if frame_data[1] is int else -1,
						"function": str(frame_data[2]) if frame_data.size() > 2 else ""
					})
			active_sessions[session_id]["stack"] = stack_frames
			print("[MCP Debugger] Captured stack with ", stack_frames.size(), " frames")
			return true
		
		"debug:break_reason":
			# Reason for break: "breakpoint", "error", "exception", etc.
			if data.size() >= 1:
				active_sessions[session_id]["reason"] = str(data[0])
				print("[MCP Debugger] Break reason: ", data[0])
			return true
		
		"scene:stack_dump":
			# Alternative stack dump format from scene debugger
			var stack_frames = []
			var i = 0
			while i < data.size():
				# Format: script, line, function (in groups of 3)
				if i + 2 < data.size():
					stack_frames.append({
						"file": str(data[i]),
						"line": int(data[i + 1]) if data[i + 1] is int else -1,
						"function": str(data[i + 2])
					})
					i += 3
				else:
					break
			if stack_frames.size() > 0:
				active_sessions[session_id]["stack"] = stack_frames
				print("[MCP Debugger] Captured scene stack with ", stack_frames.size(), " frames")
			return true
		
		"error:error", "error:warning":
			# Runtime errors/warnings
			if data.size() >= 1:
				var error_msg = str(data[0])
				if active_sessions[session_id]["error"].is_empty():
					active_sessions[session_id]["error"] = error_msg
				else:
					active_sessions[session_id]["error"] += "\n" + error_msg
			return true
	
	# Don't consume unhandled messages so other plugins can process them
	return false

# Public API for MCP Bridge
func get_sessions_info():
	var valid_sessions = []
	for id in active_sessions.keys():
		var session_data = active_sessions[id]
		var info = {
			"id": id,
			"paused": session_data["paused"],
			"can_debug": session_data["can_debug"]
		}
		
		# Include error/stack info if session is paused
		if session_data["paused"]:
			if not session_data["error"].is_empty():
				info["error"] = session_data["error"]
			if not session_data["reason"].is_empty():
				info["reason"] = session_data["reason"]
			if session_data["stack"].size() > 0:
				info["stack"] = session_data["stack"]
			if not session_data["break_file"].is_empty():
				info["break_file"] = session_data["break_file"]
			if session_data["break_line"] >= 0:
				info["break_line"] = session_data["break_line"]
		
		valid_sessions.append(info)
	return valid_sessions

# Flow-control messages are unprefixed: the game-side RemoteDebugger handles
# "continue"/"next"/"step" directly while paused in its debug loop.
func resume_session(session_id):
	session_id = int(session_id)
	if active_sessions.has(session_id):
		var session = get_session(session_id)
		session.send_message("continue", [])
		return true
	return false

func step_over(session_id):
	session_id = int(session_id)
	if active_sessions.has(session_id):
		var session = get_session(session_id)
		session.send_message("next", [])
		return true
	return false

func step_into(session_id):
	session_id = int(session_id)
	if active_sessions.has(session_id):
		var session = get_session(session_id)
		session.send_message("step", [])
		return true
	return false
