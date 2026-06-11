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

*   **Python** (3.11 or higher) and [uv](https://docs.astral.sh/uv/) (recommended) or pip
*   **Godot Engine (4.x)** installed and available in your system PATH (or provide absolute path during launch).

## Installation

1.  Clone this repository:
    ```bash
    git clone <repo-url>
    cd godot-mcp
    ```
2.  Install dependencies:
    ```bash
    uv venv && uv pip install -e .
    ```

## Configuration (Claude Desktop)

Add the server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "godot": {
      "command": "uv",
      "args": ["run", "--directory", "/absolute/path/to/godot-mcp", "godot-mcp-server"]
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
    > "Resume execution"
    > "Step over current line"

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
*   `godot_game_scene_tree`: Inspect runtime node hierarchy. Control nodes include a `screen_rect` (viewport coordinates) and Node2D nodes a `screen_position`, so you can see where things actually are on screen.
*   `godot_game_click`: Click a node by scene path (resolves its screen center through all canvas transforms) or explicit viewport x/y. Sends hover + press + release so GUI buttons, `_gui_input`, and `mouse_entered` all fire.
*   `godot_game_send_sequence`: Simulate raw keyboard/mouse/joypad event sequences with delays (mouse drags via `mouse_motion` with `button_mask`).

### Debugging (`godot_dap_*`, `godot_debugger_*`) & LSP (`godot_lsp_*`)
*   Breakpoints and flow control: `godot_dap_set_breakpoint`, `godot_debugger_resume`, `godot_debugger_step_over` / `step_into`.
*   Inspection (works for both breakpoints and runtime errors like `assert(false)`): `godot_dap_stack_trace`, `godot_dap_scopes`, `godot_dap_variables`, `godot_dap_evaluate`. These auto-connect — when the game pauses on a bad line, `godot_debugger_sessions` reports the pause with its stack and you can inspect frames/variables and evaluate expressions without any prior setup.
*   LSP: autocomplete, go-to-definition, diagnostics, hover, document symbols.

### Editor Dialogs (`godot_editor_*`)
*   `godot_editor_dialogs`: list modal dialogs blocking the editor (an action that seems to do nothing may be stuck behind an alert).
*   `godot_editor_dialog_dismiss`: accept or cancel a dialog to unblock.

## Prompts & Resources

Beyond tools, the server exposes MCP **resources** (read-only state, @-mentionable in Claude Code):

*   `godot://instances` — running instances with ports and status
*   `godot://active/scene-tree` — scene tree of the active editor instance
*   `godot://active/logs` — recent editor output
*   `godot://active/screenshot` — live PNG of the running game (rendered natively by clients, no disk round-trip)

And MCP **prompts** (guided workflows, surfaced as slash commands like `/mcp__godot__playtest` in Claude Code):

*   `debug_breakpoint(project_path, script_path, line)` — the full break-and-inspect sequence: launch, DAP connect, breakpoint, play, trigger, poll, step/resume
*   `playtest(project_path, scene_mode)` — launch, play, observe via screenshots/scene tree, interact with `godot_game_click`, report findings

## Troubleshooting

*   **Large Screenshots**: Screenshots are automatically saved to disk (`./screenshot_*.png`) and the path is returned to the agent to avoid overflowing the context window.
*   **Ports**: The server uses ports starting at 6005 (LSP), 6006 (DAP), 8765 (Editor), 8766 (Game) and increments by 10 for each new instance. Ensure these ports are free.
*   **Symbol Search**: `godot_lsp_search_symbols` (`workspace/symbol`) is not supported by the Godot 4.6 language server (`workspaceSymbolProvider: false`); use `godot_lsp_list_symbols` per file instead.

## License

MIT
