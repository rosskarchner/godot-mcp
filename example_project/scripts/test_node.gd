extends Node
## Test node script for MCP testing

var test_value: int = 42
var test_string: String = "Hello from test node"
var is_active: bool = true


func _ready() -> void:
	print("TestNode ready: %s" % name)


func test_method() -> String:
	return "Method called successfully"


func get_test_data() -> Dictionary:
	return {
		"value": test_value,
		"string": test_string,
		"active": is_active
	}
