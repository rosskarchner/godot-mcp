extends Button
## Test button script for MCP mouse input testing.
## Prints distinctive markers when the button is hovered/pressed so tests
## can verify synthetic mouse events reach GUI controls.

func _ready() -> void:
	mouse_entered.connect(func(): print("BUTTON_HOVERED"))
	pressed.connect(func(): print("BUTTON_CLICKED"))

func _gui_input(event: InputEvent) -> void:
	print("BUTTON_GUI_INPUT: ", event)
