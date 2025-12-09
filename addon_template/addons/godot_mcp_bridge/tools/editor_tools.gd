extends RefCounted

## Editor Utility Tools
##
## Tools for accessing editor output, logs, and other editor-specific functionality.

var editor_interface: EditorInterface
var editor_plugin: EditorPlugin

# Store recent output messages
var output_history: Array[Dictionary] = []
const MAX_OUTPUT_HISTORY: int = 1000

func get_output_log(args: Dictionary) -> Dictionary:
	var max_lines: int = args.get("max_lines", 100)
	var filter_type: String = "all"
	if args.has("filter_type") and args.filter_type != null:
		filter_type = args.filter_type
	
	# Note: This returns messages that were explicitly logged through the MCP server's
	# logging mechanism. Standard print() statements go directly to Godot's output panel
	# and cannot be intercepted without modifying engine code.
	
	# Get recent messages from history
	var filtered_messages: Array[Dictionary] = []
	
	for msg in output_history:
		if filter_type == "all" or msg.type == filter_type:
			filtered_messages.append(msg)
	
	# Return most recent max_lines messages
	var start_idx := max(0, filtered_messages.size() - max_lines)
	var result_messages := filtered_messages.slice(start_idx)
	
	return {
		"success": true,
		"total_lines": result_messages.size(),
		"max_lines": max_lines,
		"filter_type": filter_type,
		"messages": result_messages,
		"note": "This captures errors and warnings from the editor. For print() output, use the godot_editor_read_logs tool to read the log file directly."
	}

func get_editor_log_path(_args: Dictionary) -> Dictionary:
	# Get the path to the Godot editor log file
	var log_path := OS.get_user_data_dir().path_join("logs")
	
	# Try to find the most recent log file
	var dir := DirAccess.open(log_path)
	if not dir:
		return {
			"error": "Could not access log directory",
			"path": log_path
		}
	
	# Get the godot.log file (or most recent one)
	var log_file := log_path.path_join("godot.log")
	
	return {
		"success": true,
		"log_path": log_file,
		"log_directory": log_path,
		"note": "Read this file to see all print() statements and engine output"
	}

func read_editor_logs(args: Dictionary) -> Dictionary:
	var max_lines: int = args.get("max_lines", 100)
	var filter_text: String = ""
	if args.has("filter_text") and args.filter_text != null:
		filter_text = args.filter_text
	
	# Get log file path
	var log_info := get_editor_log_path({})
	if log_info.has("error"):
		return log_info
	
	var log_path: String = log_info.log_path
	
	# Read the log file
	var file := FileAccess.open(log_path, FileAccess.READ)
	if not file:
		return {
			"error": "Could not open log file",
			"path": log_path
		}
	
	# Read all lines
	var all_lines: Array[String] = []
	while not file.eof_reached():
		var line := file.get_line()
		if not line.is_empty():
			if filter_text.is_empty() or filter_text.to_lower() in line.to_lower():
				all_lines.append(line)
	
	file.close()
	
	# Return most recent max_lines
	var start_idx := max(0, all_lines.size() - max_lines)
	var result_lines := all_lines.slice(start_idx)
	
	return {
		"success": true,
		"total_lines": result_lines.size(),
		"max_lines": max_lines,
		"log_path": log_path,
		"lines": result_lines
	}

func clear_output_log(_args: Dictionary) -> Dictionary:
	output_history.clear()
	return {
		"success": true,
		"message": "Output log cleared"
	}

func add_output_message(message: String, type: String = "print") -> void:
	var msg := {
		"type": type,
		"message": message,
		"timestamp": Time.get_unix_time_from_system()
	}
	
	output_history.append(msg)
	
	# Keep history size manageable
	if output_history.size() > MAX_OUTPUT_HISTORY:
		output_history = output_history.slice(output_history.size() - MAX_OUTPUT_HISTORY)
