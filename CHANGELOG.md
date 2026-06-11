# Changelog

## [3.0.0] - 2026-06-10

### Added
- **Runtime-error debugging now actually works.** When a bad line pauses the game (e.g. `assert(false)`), an agent is informed (timeout diagnostic + `godot_debugger_sessions`) *and* can inspect it: `godot_debugger_sessions` enriches paused sessions with the real stack via DAP, and new `godot_dap_stack_trace` / `godot_dap_scopes` / `godot_dap_variables` / `godot_dap_evaluate` tools (auto-connecting, no `godot_dap_connect` needed) expose frames, variables, and expression evaluation. Added `godot_debugger_step_into`.
- **Editor dialog handling**: `godot_editor_dialogs` lists visible modal dialogs (title, text, buttons) and `godot_editor_dialog_dismiss` closes them — so agent actions blocked behind an invisible alert can be detected and unblocked.
- **MCP resources**: `godot://instances`, `godot://active/scene-tree`, `godot://active/logs`, and `godot://active/screenshot` (binary PNG with proper MIME type, so clients render it inline instead of reading a file path).
- **MCP prompts**: `debug_breakpoint` and `playtest` encode the validated multi-step workflows (DAP setup ordering, current-vs-main scene choice, debugger polling, click-by-node-path interaction) as client slash commands.
- **Mouse input simulation**: new `godot_game_click` tool clicks a node by scene path (computing its on-screen center through all canvas transforms) or explicit viewport coordinates, sending hover + press + release so GUI buttons, `_gui_input`, and `mouse_entered` fire. Verified end-to-end against a live Button.
- Runtime scene tree (`godot_game_scene_tree`) now reports `screen_rect` for Control nodes and `screen_position` for Node2D nodes, giving agents real click coordinates.
- Raw mouse events now set `global_position` and `button_mask` (enabling drags via `mouse_motion` + `button_mask`), and the misleading "UI click detection not supported" responses were removed — coordinate-space confusion, not the input path, was the actual blocker.

### Changed
- **Rewritten in Python** using the official MCP Python SDK (FastMCP), replacing the Node.js implementation. All 42 tool names and schemas are unchanged.
- `godot_dap_connect` no longer fails when no game session is running yet ("not_running" from Godot's DAP attach); breakpoints can still be configured before launch.
- Server entry point is now `godot-mcp-server` (installed via `uv pip install -e .`); see `mcp-config-example.json`.

### Fixed
- `godot_input_actions_list` always returned 404: the addon HTTP route called a nonexistent method (`list_actions` instead of `list_input_actions`).
- Bridge debugger resume/step silently no-op'd: the session id arrived as a JSON float and missed the integer dictionary key, and the flow-control messages were wrongly prefixed (`scene:continue` → `continue`). Resume and step now actually move/unpause the game (verified).
- `godot_game_play` no longer fails silently when the scene can't run. It pre-checks for a defined, existing scene (or an open scene for `scene_mode="current"`) and returns an error instead of letting the editor pop a modal alert the agent can't see; the Python tool raises on that error rather than reporting "started".

## [2.0.0] - 2025

### Added
- **LSP Support**: Full Language Server Protocol integration (port 6005)
  - Code diagnostics, hover info, go-to-definition, completion, symbols

### Changed
- Clarified port usage: 6006 for DAP (debugging), 6005 for LSP
- Streamlined documentation

## [1.0.0] - 2025

### Initial Release
- Debug Adapter Protocol (DAP) support (port 6006)
- 14 debugging tools: breakpoints, execution control, variable inspection
- Thread management and stack traces
- Expression evaluation in GDScript
