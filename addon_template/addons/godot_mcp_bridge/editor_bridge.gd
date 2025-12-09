@tool
extends EditorPlugin

const HTTPApi = preload("res://addons/godot_mcp_bridge/http_api.gd")
var http_api: HTTPApi
var debugger_plugin

func _enter_tree() -> void:
	var port := 8765
	
	# Try to load configuration
	if FileAccess.file_exists("res://addons/godot_mcp_bridge/mcp_config.gd"):
		var config_script = load("res://addons/godot_mcp_bridge/mcp_config.gd")
		if config_script:
			var config = config_script.new()
			# Check if property exists/is accessible
			var script_vars = config.get_script().get_script_constant_map()
			if script_vars.has("EDITOR_API_PORT"):
				port = script_vars["EDITOR_API_PORT"]
	
	# Load and register debugger plugin
	debugger_plugin = load("res://addons/godot_mcp_bridge/mcp_debugger.gd").new()
	add_debugger_plugin(debugger_plugin)
	
	# Create and start HTTP API server
	http_api = HTTPApi.new()
	http_api.name = "MCPHTTPBridge"
	http_api.editor_interface = get_editor_interface()
	http_api.editor_plugin = self
	http_api.debugger_plugin = debugger_plugin
	
	add_child(http_api)
	
	if http_api.start(port):
		print("[MCP] Editor Bridge started on port ", port)
	else:
		push_error("[MCP] Failed to start Editor Bridge on port ", port)

func _exit_tree() -> void:
	if debugger_plugin:
		remove_debugger_plugin(debugger_plugin)
		debugger_plugin = null

	if http_api:
		http_api.stop()
		remove_child(http_api)
		http_api.queue_free()
		http_api = null
