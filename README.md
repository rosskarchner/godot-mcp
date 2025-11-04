# Godot DAP/LSP MCP Server

MCP server for **runtime debugging** and **code intelligence** with Godot Engine. Connects to Godot's Debug Adapter Protocol (DAP) and Language Server Protocol (LSP) for AI-assisted development.

> **Note**: This server provides DAP/LSP debugging and code intelligence. For editor manipulation (scene/node management), use [godot-mcp-plugin](https://github.com/rosskarchner/godot-mcp-plugin).

## Quick Start

```bash
npm install
node src/index.js
```

Configure via environment variables if needed:
```bash
GODOT_DEBUG_HOST=127.0.0.1 GODOT_DEBUG_PORT=6006 node src/index.js
```

## Prerequisites

- Godot Engine running with debugging/LSP enabled
- Godot exposes two ports:
  - **DAP (debugging)**: Port 6006 (default) - for runtime debugging
  - **LSP (code intelligence)**: Port 6005 (default) - for code analysis

## Available Tools

### DAP - Debug Adapter Protocol (Runtime Debugging)

All tools prefixed with `godot_dap_` - for debugging **running games**:

- **Connection**: `godot_dap_connect`, `godot_dap_disconnect`
- **Execution Control**: `godot_dap_pause`, `godot_dap_continue`, `godot_dap_step_over`, `godot_dap_step_into`, `godot_dap_step_out`
- **Inspection**: `godot_dap_list_threads`, `godot_dap_get_stacktrace`, `godot_dap_get_scopes`, `godot_dap_inspect_variables`
- **Breakpoints**: `godot_dap_set_breakpoint`, `godot_dap_clear_breakpoints`

### LSP - Language Server Protocol (Code Intelligence)

All tools prefixed with `godot_lsp_` - for **static code analysis**:

- **Connection**: `godot_lsp_connect`, `godot_lsp_disconnect`
- **Diagnostics**: `godot_lsp_get_errors`
- **Navigation**: `godot_lsp_get_symbol_info`, `godot_lsp_find_definition`
- **Completion**: `godot_lsp_autocomplete`
- **Symbols**: `godot_lsp_list_symbols`, `godot_lsp_search_symbols`

## Tool Naming Convention

- `godot_dap_*` - Runtime debugging via Debug Adapter Protocol
- `godot_lsp_*` - Code intelligence via Language Server Protocol
- For editor manipulation (scenes, nodes, properties), use the separate [godot-mcp-plugin](https://github.com/rosskarchner/godot-mcp-plugin)

## Environment Variables

- `GODOT_DEBUG_HOST`: DAP host (default: `127.0.0.1`)
- `GODOT_DEBUG_PORT`: DAP port (default: `6006`)
- `GODOT_LSP_HOST`: LSP host (default: `127.0.0.1`)
- `GODOT_LSP_PORT`: LSP port (default: `6005`)

## License

MIT
