@tool
extends EditorDebuggerPlugin

# Dictionary to store session state: session_id -> { paused: bool, can_debug: bool }
var active_sessions = {}

func _setup_session(session_id):
	var session = get_session(session_id)
	active_sessions[session_id] = {
		"paused": false,
		"can_debug": false
	}
	
	# Connect signals using callables
	session.breaked.connect(func(can_debug): _on_session_breaked(can_debug, session_id))
	session.continued.connect(func(): _on_session_continued(session_id))

func _on_session_breaked(can_debug, session_id):
	if active_sessions.has(session_id):
		active_sessions[session_id]["paused"] = true
		active_sessions[session_id]["can_debug"] = can_debug
		print("[MCP Debugger] Session ", session_id, " breaked. Can debug: ", can_debug)

func _on_session_continued(session_id):
	if active_sessions.has(session_id):
		active_sessions[session_id]["paused"] = false
		print("[MCP Debugger] Session ", session_id, " continued.")

func _has_capture(capture):
	return false

func _capture(message, data, session_id):
	return false

# Public API for MCP Bridge
func get_sessions_info():
	var valid_sessions = []
	for id in active_sessions.keys():
		# Verify session is still valid? get_session might return null if closed?
		# But we rely on stored ID.
		valid_sessions.append({
			"id": id,
			"paused": active_sessions[id]["paused"],
			"can_debug": active_sessions[id]["can_debug"]
		})
	return valid_sessions

func resume_session(session_id):
	if active_sessions.has(session_id):
		var session = get_session(session_id)
		# "continue" is the standard command for resuming
		session.send_message("scene:continue", [])
		return true
	return false

func step_over(session_id):
	if active_sessions.has(session_id):
		var session = get_session(session_id)
		# "next" is step over
		session.send_message("scene:next", [])
		return true
	return false

func step_into(session_id):
	if active_sessions.has(session_id):
		var session = get_session(session_id)
		# "step" is step into
		session.send_message("scene:step", [])
		return true
	return false
