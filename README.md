# Godot MCP Server

MCP server for debugging and code intelligence with Godot Engine. Connects to Godot's Debug Adapter Protocol (DAP) and Language Server Protocol (LSP) for AI-assisted development.

## Quick Start

### Option 1: Docker MCP (Recommended)

**Add permanently to Docker MCP Gateway:**

Add this to your `~/.docker/mcp/config.yaml`:

```yaml
mcpServers:
  godot-mcp:
    image: ghcr.io/therossco/godot-mcp-server:latest
    env:
      GODOT_DEBUG_HOST: host.docker.internal
      GODOT_DEBUG_PORT: "6006"
      GODOT_LSP_HOST: host.docker.internal
      GODOT_LSP_PORT: "6005"
```

Then start the gateway:

```bash
docker mcp gateway run
```

**Or run temporarily:**

Using the included catalog:

```bash
docker mcp gateway run --catalog docker-mcp-catalog.yaml --servers godot-mcp-server
```

Using the GHCR image directly:

```bash
docker mcp gateway run --oci-ref ghcr.io/therossco/godot-mcp-server:latest
```

The server will automatically connect to Godot running on your host machine.

### Option 2: Run Directly with Node.js

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

## Docker Networking

### Linux
Use host networking for direct localhost access:
```bash
docker run -i --network host godot-mcp-server:latest
```

Or configure Godot to listen on `0.0.0.0` (Editor Settings → Network → Language Server) and use:
```bash
docker run -i --add-host host.docker.internal:host-gateway \
  -e GODOT_DEBUG_HOST=host.docker.internal \
  godot-mcp-server:latest
```

### Docker Desktop (Mac/Windows)
Works out of the box with `host.docker.internal`.

## Building

```bash
docker build -t godot-mcp-server:latest .
```

## Environment Variables

- `GODOT_DEBUG_HOST`: DAP host (default: `127.0.0.1`)
- `GODOT_DEBUG_PORT`: DAP port (default: `6006`)
- `GODOT_LSP_HOST`: LSP host (default: `127.0.0.1`)
- `GODOT_LSP_PORT`: LSP port (default: `6005`)

## License

MIT
