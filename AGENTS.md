# Godot MCP Unified Server

This server acts as a unified bridge between AI agents and the Godot Engine. It consolidates debug (DAP), code intelligence (LSP), editor manipulation (API), and runtime interaction (Game Bridge) into a single MCP endpoint.

## Capabilities

*   **Instance Management**: Launch and control multiple Godot Editor instances with isolated port configurations (`godot_launch`, `godot_terminate`).
*   **Editor Control**: Access scene tree, nodes, scripts, resources, and output logs in the editor via an injected HTTP bridge (`godot_scene_*`, `godot_node_*`, `godot_editor_*`).
*   **Game Interaction**: Interact with the running game (screenshots, input simulation, runtime scene tree) via an injected autoload (`godot_game_*`).
*   **Debugging (DAP)**: Set breakpoints, inspect variables, control execution, and view stack traces (`godot_dap_*`).
*   **Code Intelligence (LSP)**: Autocomplete, go-to-definition, diagnostics, and symbol search (`godot_lsp_*`).

## Architecture

The server runs on Node.js and orchestrates communication:

1.  **Node.js Server**: Handles MCP requests, manages Godot processes, and routes commands to the appropriate client.
2.  **Godot Addon (`godot_mcp_bridge`)**: Automatically injected into targeted projects to provide a REST API for editor tools.
3.  **Godot Autoload (`game_bridge.gd`)**: Automatically injected to provide a REST API for running games.
4.  **LSP/DAP Clients**: Connect to standard Godot ports (configured per-instance).

## Usage

1.  **Start the Server**: `npm start`
2.  **Launch Godot**: Use `godot_launch` with the path to your project.
3.  **Use Tools**: Call any `godot_*` tool. The server handles the routing.

## Configuration

No manual configuration of ports is required. The `instance-manager` automatically assigns unique port blocks for each launched instance (LSP, DAP, Editor API, Game Bridge).
