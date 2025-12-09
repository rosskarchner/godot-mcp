# Godot Unified MCP Server

A powerful **Model Context Protocol (MCP)** server that connects AI agents directly to the **Godot Engine**. It unifies four distinct capabilities into a single interface:

1.  **Editor Control**: Manipulate scenes, nodes, scripts, and resources directly in the editor.
2.  **Game Interaction**: Interact with the running game (screenshots, input simulation, runtime scene tree).
3.  **Debugging (DAP)**: Set breakpoints, inspect variables, and step through code.
4.  **Code Intelligence (LSP)**: Autocomplete, go-to-definition, and symbol search.

## Features

*   **Zero-Config Injection**: Automatically injects the necessary bridge plugin into your Godot project when you launch it via this server. No manual addon installation required.
*   **Instance Management**: Launch, monitor, and control multiple Godot Editor instances simultaneously.
*   **Port Isolation**: Automatically manages ports for LSP, DAP, and HTTP bridges for each instance to prevent conflicts.
*   **Resilience**: Restores sessions after server restart and handles external process monitoring.
*   **Context-Aware**: Tools can target specific instances or default to the active one.

## Prerequisites

*   **Node.js** (v18 or higher)
*   **Godot Engine (4.x)** installed and available in your system PATH (or provide absolute path during launch).

## Installation

1.  Clone this repository:
    ```bash
    git clone <repo-url>
    cd godot-mcp-unified
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build (optional, if using TypeScript source later, currently strictly JS):
    ```bash
    # No build step required for current JS version
    ```

## Configuration (Claude Desktop)

Add the server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "godot": {
      "command": "node",
      "args": ["/absolute/path/to/godot-mcp-unified/src/index.js"]
    }
  }
}
```

## Usage

Once connected to your agent (e.g. Claude):

1.  **Launch a Project**:
    > "Launch Godot for the project at /home/user/my_game"
    
    The server will:
    *   Inject the `godot_mcp_bridge` addon into the project.
    *   Configure `project.godot` to enable the plugin and autoloads.
    *   Spawn the Godot Editor process with dedicated ports.

2.  **Interact with the Editor**:
    > "Get the scene tree for the current scene"
    > "Attach a script to the Player node"
    
3.  **Play & Test**:
    > "Start the game"
    > "Wait 5 seconds and take a screenshot"
    
4.  **Debug**:
    > "Set a breakpoint in player.gd at line 10"
    > "Inspect local variables"

## Tool Categories

### Instance Management
*   `godot_launch`: Start a new editor instance.
*   `godot_list_instances`: See running projects.
*   `godot_switch_instance`: Switch active focus.
*   `godot_terminate`: Close an instance.
*   `godot_adopt_instance`: Connect to an externally launched Godot (requires plugin already present).

### Editor Tools (`godot_scene_*`, `godot_node_*`, etc.)
*   Manage scenes (load, save, get tree).
*   Manage nodes (create, delete, rename, properties).
*   manage scripts (attach, read source).
*   Project settings & resources.

### Game Bridge (`godot_game_*`)
*   `godot_game_play` / `stop`: Control game execution from editor.
*   `godot_game_screenshot`: Capture game view (saves to disk to preserve context).
*   `godot_game_scene_tree`: Inspect runtime node hierarchy.
*   `godot_game_send_input`: Simulate mouse/keyboard/joypad events.

### Debugging & LSP (`godot_dap_*`, `godot_lsp_*`)
*   Standard protocol implementations for debugging and code intelligence.

## Troubleshooting

*   **Large Screenshots**: Screenshots are automatically saved to disk (`./screenshot_*.png`) and the path is returned to the agent to avoid overflowing the context window.
*   **Ports**: The server uses ports starting at 6005 (LSP), 6006 (DAP), 8765 (Editor), 8766 (Game) and increments by 10 for each new instance. Ensure these ports are free.

## License

MIT
