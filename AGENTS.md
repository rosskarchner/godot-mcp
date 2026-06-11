# Godot MCP Unified Server

This server acts as a unified bridge between AI agents and the Godot Engine. It consolidates debug (DAP), code intelligence (LSP), editor manipulation (API), and runtime interaction (Game Bridge) into a single MCP endpoint.

## Capabilities

*   **Instance Management**: Launch and control multiple Godot Editor instances with isolated port configurations (`godot_launch`, `godot_terminate`).
*   **Editor Control**: Access scene tree, nodes, scripts, resources, and output logs in the editor via an injected HTTP bridge (`godot_scene_*`, `godot_node_*`, `godot_editor_*`).
*   **Game Interaction**: Interact with the running game (screenshots, input simulation, runtime scene tree) via an injected autoload (`godot_game_*`).
*   **Debugging (DAP/Bridge)**: Set breakpoints, control execution (pause/resume/step), and monitor debug sessions (`godot_dap_*`, `godot_debugger_*`).
*   **Code Intelligence (LSP)**: Autocomplete, go-to-definition, diagnostics, and symbol search (`godot_lsp_*`).

## Architecture

The server runs on Python (official MCP Python SDK / FastMCP) and orchestrates communication:

1.  **Python Server** (`src/godot_mcp/`): Handles MCP requests, manages Godot processes, and routes commands to the appropriate client.
2.  **Godot Addon (`godot_mcp_bridge`)**: Automatically injected into targeted projects to provide a REST API for editor tools.
3.  **Godot Autoload (`game_bridge.gd`)**: Automatically injected to provide a REST API for running games.
4.  **LSP/DAP Clients**: Connect to standard Godot ports (configured per-instance).

## Usage

1.  **Install**: `uv venv && uv pip install -e .`
2.  **Start the Server**: `uv run godot-mcp-server` (stdio)
3.  **Launch Godot**: Use `godot_launch` with the path to your project.
4.  **Use Tools**: Call any `godot_*` tool. The server handles the routing.

## Tests

Integration tests (require Godot in PATH and a display) live in `test/`:

*   `test/test_bootstrap.py` — project bootstrap (no Godot instance needed)
*   `test/test_editor_ops.py` — editor tool operations against a live editor
*   `test/test_all_features.py` — full flow: launch, DAP breakpoints, game play, input, debugger, LSP
*   `test/test_mouse_input.py` — synthetic mouse clicks reaching GUI controls (by node path, coordinates, and raw sequences)
*   `test/test_prompts_resources.py` — MCP resources (including binary screenshot) and prompt rendering against a live game
*   `test/test_debugger_inspection.py` — runtime error pauses the game; agent inspects stack/variables/evaluate, steps, and resumes with no debugger setup

Run with `.venv/bin/python test/<name>.py`.

## Configuration

No manual configuration of ports is required. The `instance-manager` automatically assigns unique port blocks for each launched instance (LSP, DAP, Editor API, Game Bridge).
