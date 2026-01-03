extends Node
## Test node script for MCP testing

var test_value: int = 42
var test_string: String = "Hello from test node"
var is_active: bool = true

## If true, automatically trigger an error 3 seconds after _ready (for testing error capture)
@export var auto_trigger_error: bool = false

var _error_timer: float = 0.0
var _error_triggered: bool = false

func _ready() -> void:
	print("TestNode ready: %s" % name)
	# Check if we should auto-trigger error (set via scene or code)
	if auto_trigger_error:
		print("Auto-trigger error is enabled - will trigger in 3 seconds")


func _process(delta: float) -> void:
	# Auto-trigger error after 3 seconds if enabled
	if auto_trigger_error and not _error_triggered:
		_error_timer += delta
		if _error_timer >= 3.0:
			_error_triggered = true
			print("Auto-triggering error now!")
			trigger_error()


func test_method() -> String:
	return "Method called successfully"


func get_test_data() -> Dictionary:
	return {
		"value": test_value,
		"string": test_string,
		"active": is_active
	}

## Intentionally triggers an error for testing debugger error capture
## Using assert(false) which will BOTH pause the debugger AND send error messages
func trigger_error() -> void:
	print("About to trigger an assert failure...")
	push_error("Test error message from trigger_error()")
	# assert(false) will pause the debugger with an error
	assert(false, "Intentional test error for MCP debugging")


func _input(event):
	print("Input received: ", event)
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_SPACE:
				print("Space pressed!")
				test_method()  # Line 57 - set breakpoint here for breakpoint test
			KEY_ENTER:
				print("Enter pressed - triggering error!")
				trigger_error()  # This will cause a runtime error
