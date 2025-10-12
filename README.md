# Godot MCP Server

MCP server for debugging and code intelligence with Godot Engine. Connects to Godot's Debug Adapter Protocol (DAP) and Language Server Protocol (LSP) for AI-assisted development.

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
  - **DAP (debugging)**: Port 6006 (default)
  - **LSP (code intelligence)**: Port 6005 (default)

## Available Tools

### Debugging (DAP)
- **Execution Control**: `pause_execution`, `continue_execution`, `step_over`, `step_into`, `step_out`
- **Inspection**: `get_threads`, `get_stack_trace`, `get_scopes`, `get_variables`
- **Breakpoints**: `set_breakpoint`, `remove_breakpoints`

### Code Intelligence (LSP)
- **Diagnostics**: `lsp_get_diagnostics`
- **Navigation**: `lsp_hover`, `lsp_goto_definition`
- **Completion**: `lsp_completion`
- **Symbols**: `lsp_document_symbols`, `lsp_workspace_symbols`

## Environment Variables

- `GODOT_DEBUG_HOST`: DAP host (default: `127.0.0.1`)
- `GODOT_DEBUG_PORT`: DAP port (default: `6006`)
- `GODOT_LSP_HOST`: LSP host (default: `127.0.0.1`)
- `GODOT_LSP_PORT`: LSP port (default: `6005`)

## License

MIT
