extends Node

var tcp_server: TCPServer
var connections: Array[StreamPeerTCP] = []
var editor_interface: EditorInterface
var editor_plugin: EditorPlugin
var port: int

# Tool instances
var scene_tools
var node_tools
var script_tools
var resource_tools
var editor_tools
var project_tools
var input_map_tools

func _ready():
	_init_tools()

func start(listen_port: int) -> bool:
	_init_tools() # Ensure tools are ready
	tcp_server = TCPServer.new()
	var err := tcp_server.listen(listen_port, "127.0.0.1")
	if err != OK:
		return false
	port = listen_port
	return true

func stop():
	if tcp_server:
		tcp_server.stop()
	for conn in connections:
		if conn.get_status() != StreamPeerTCP.STATUS_NONE:
			conn.disconnect_from_host()
	connections.clear()

func _init_tools():
	if scene_tools: return # Already initialized
	
	var tools_dir = "res://addons/godot_mcp_bridge/tools/"
	
	# Helper to safely load tools
	var load_tool = func(name):
		if FileAccess.file_exists(tools_dir + name):
			return load(tools_dir + name).new()
		return null

	scene_tools = load_tool.call("scene_tools.gd")
	node_tools = load_tool.call("node_tools.gd")
	script_tools = load_tool.call("script_tools.gd")
	resource_tools = load_tool.call("resource_tools.gd")
	editor_tools = load_tool.call("editor_tools.gd")
	project_tools = load_tool.call("project_tools.gd")
	input_map_tools = load_tool.call("input_map_tools.gd")
	
	# Inject editor interface
	var all_tools = [scene_tools, node_tools, script_tools, resource_tools, editor_tools, project_tools, input_map_tools]
	for tool in all_tools:
		if tool and "editor_interface" in tool:
			tool.editor_interface = editor_interface

func _process(_delta):
	if not tcp_server: return
	
	if tcp_server.is_connection_available():
		var conn = tcp_server.take_connection()
		connections.append(conn)
	
	var to_remove = []
	for i in range(connections.size()):
		var conn = connections[i]
		conn.poll()
		var status = conn.get_status()
		if status == StreamPeerTCP.STATUS_CONNECTED:
			if conn.get_available_bytes() > 0:
				_handle_request(conn)
				to_remove.append(i)
		elif status != StreamPeerTCP.STATUS_CONNECTED:
			to_remove.append(i)
			
	to_remove.reverse()
	for i in to_remove:
		connections.remove_at(i)

func _handle_request(conn: StreamPeerTCP):
	var available = conn.get_available_bytes()
	var data = conn.get_partial_data(available)
	if data[0] != OK:
		conn.disconnect_from_host()
		return
		
	var text = data[1].get_string_from_utf8()
	
	# Simple parsing
	var lines = text.split("\r\n")
	if lines.size() < 1:
		conn.disconnect_from_host() # Malformed
		return
		
	var request_line = lines[0].split(" ")
	if request_line.size() < 2:
		conn.disconnect_from_host()
		return
	
	var method = request_line[0]
	var path = request_line[1]
	
	# Get body
	var body = ""
	var body_pos = text.find("\r\n\r\n")
	if body_pos > 0:
		body = text.substr(body_pos + 4)
	
	var args = {}
	if not body.is_empty():
		var json = JSON.new()
		if json.parse(body) == OK:
			if json.data is Dictionary:
				args = json.data
	
	var response = null
	
	if method == "POST":
		response = _route_request(path, args)
	elif method == "GET" and path == "/health":
		response = {"status": "ok", "editor_bridge": true}
	
	if response == null:
		_send_response(conn, 404, {"error": "Not Found or Handler Error"})
	else:
		_send_response(conn, 200, response)

var debugger_plugin

# ... existing code ...

func _route_request(path: String, args: Dictionary):
	if not scene_tools: return {"error": "Tools not initialized"}

	match path:
		"/scene/tree": return scene_tools.get_scene_tree(args)
		"/scene/current": return scene_tools.get_current_scene()
		"/scene/save": return scene_tools.save_scene()
		"/scene/load": return scene_tools.load_scene(args)
		"/node/info": return node_tools.get_node_info(args)
		"/node/properties": return node_tools.get_node_properties(args)
		"/node/set": return node_tools.set_node_property(args)
		"/node/create": return node_tools.create_node(args)
		"/node/delete": return node_tools.delete_node(args)
		"/node/rename": return node_tools.rename_node(args)
		"/script/get": return script_tools.get_node_script(args)
		"/script/attach": return script_tools.set_node_script(args)
		"/script/source": return script_tools.get_script_source(args)
		"/resources/list": return resource_tools.list_resources(args)
		"/project/settings": return project_tools.list_project_settings(args)
		"/project/get": return project_tools.get_project_setting(args)
		"/project/set": return project_tools.set_project_setting(args)
		"/input/actions": return input_map_tools.list_input_actions(args)
		"/game/play": return resource_tools.run_scene(editor_plugin, args)
		"/game/stop": return resource_tools.stop_scene(editor_plugin)
		"/editor/output": return editor_tools.read_editor_logs(args)
		"/editor/dialogs": return editor_tools.list_dialogs(args)
		"/editor/dialog/dismiss": return editor_tools.dismiss_dialog(args)
		"/debugger/sessions":
			if debugger_plugin: return debugger_plugin.get_sessions_info()
			return {"error": "Debugger plugin not available"}
		"/debugger/continue":
			if debugger_plugin: return {"success": debugger_plugin.resume_session(args.get("session_id", 0))}
			return {"error": "Debugger plugin not available"}
		"/debugger/next":
			if debugger_plugin: return {"success": debugger_plugin.step_over(args.get("session_id", 0))}
			return {"error": "Debugger plugin not available"}
		"/debugger/step":
			if debugger_plugin: return {"success": debugger_plugin.step_into(args.get("session_id", 0))}
			return {"error": "Debugger plugin not available"}
		_: return null

func _send_response(conn, code, data):
	var json = JSON.stringify(data)
	var resp = "HTTP/1.1 %d OK\r\n" % code
	resp += "Content-Type: application/json\r\n"
	resp += "Content-Length: %d\r\n\r\n" % json.length()
	resp += json
	conn.put_data(resp.to_utf8_buffer())
	# We disconnect inside the loop in _process usually, but doing it here is fine
