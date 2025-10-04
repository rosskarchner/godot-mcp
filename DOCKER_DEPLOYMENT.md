# Docker Deployment Guide

This guide covers building the Docker container and deploying it with Docker MCP Gateway.

## Quick Start

### 1. Build the Container

```bash
docker build -t godot-mcp-server .
```

The build is fully self-contained and installs all dependencies automatically.

### 2. Run with Docker MCP Gateway

```bash
docker mcp gateway run --server docker://godot-mcp-server:latest
```

That's it! The server is now available for your AI assistant.

## Prerequisites

- **Docker Desktop** with MCP Toolkit enabled
- **Godot Editor** running on your host machine (with DAP on port 6006 and/or LSP on port 6005)

## Configuration

### Environment Variables

The server connects to Godot running on your host machine using these variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `GODOT_DEBUG_HOST` | Host where Godot is running | `host.docker.internal` |
| `GODOT_DEBUG_PORT` | Godot DAP debug port | `6006` |
| `GODOT_LSP_HOST` | Host where Godot is running | `host.docker.internal` |
| `GODOT_LSP_PORT` | Godot LSP port | `6005` |

### Custom Ports Example

```bash
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --env GODOT_DEBUG_PORT=7006 \
  --env GODOT_LSP_PORT=7005
```

## Deployment Options

### Option 1: Direct Gateway Run (Recommended)

```bash
docker mcp gateway run --server docker://godot-mcp-server:latest
```

**For streaming mode (multiple AI clients):**

```bash
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --transport streaming \
  --port 8080
```

### Option 2: Using Custom Catalog

```bash
# Import the catalog
docker mcp catalog import ./docker-mcp-catalog.yaml

# Run with catalog
docker mcp gateway run --catalog ./docker-mcp-catalog.yaml
```

### Option 3: Docker Compose

**For persistent gateway:**

```bash
docker compose --profile gateway up -d
```

**For direct server:**

```bash
docker compose --profile direct up -d
```

### Option 4: Direct Docker Run (No Gateway)

```bash
docker run -i --network host godot-mcp-server
```

## AI Client Configuration

### Claude Desktop

Edit your config file:
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "godot": {
      "command": "docker",
      "args": ["mcp", "gateway", "run", "--server", "docker://godot-mcp-server:latest"]
    }
  }
}
```

### VS Code with Copilot

Add to workspace settings:

```json
{
  "github.copilot.advanced": {
    "mcp": {
      "enabled": true,
      "servers": {
        "godot": {
          "command": "docker",
          "args": ["mcp", "gateway", "run", "--server", "docker://godot-mcp-server:latest"]
        }
      }
    }
  }
}
```

## Publishing to Docker Hub

### 1. Build and Tag

```bash
docker build -t yourusername/godot-mcp-server:latest .
docker tag yourusername/godot-mcp-server:latest yourusername/godot-mcp-server:2.0.0
```

### 2. Push

```bash
docker login
docker push yourusername/godot-mcp-server:latest
docker push yourusername/godot-mcp-server:2.0.0
```

### 3. Users Can Run Directly

```bash
docker mcp gateway run --server docker://yourusername/godot-mcp-server:latest
```

## Troubleshooting

### Can't Connect to Godot

**Symptoms:** "Connection timeout" or "ECONNREFUSED" errors

**Solutions:**
1. Verify Godot is running
2. Check ports are correct (6006 for DAP, 6005 for LSP)
3. On Linux, try `172.17.0.1` instead of `host.docker.internal`
4. Check firewall settings

**Test connectivity:**

```bash
# Test if Godot DAP port is accessible from Docker
docker run --rm alpine sh -c "apk add --no-cache netcat-openbsd && nc -zv host.docker.internal 6006"

# Test LSP port
docker run --rm alpine sh -c "apk add --no-cache netcat-openbsd && nc -zv host.docker.internal 6005"
```

### Verbose Logging

```bash
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --verbose \
  --log-calls
```

### View Container Logs

```bash
# List MCP containers
docker ps --filter "label=io.docker.mcp.server"

# View logs
docker logs <container-id>
```

## Available Tools

The server provides **22 tools** for debugging and code intelligence:

### Connection Management (4)
- `connect_debugger`, `disconnect_debugger` - DAP connection
- `connect_lsp`, `disconnect_lsp` - LSP connection

### Debugging - DAP (12)
- `get_threads`, `get_stack_trace`, `get_scopes`, `get_variables`
- `evaluate_expression` - Run GDScript in context
- `set_breakpoint`, `remove_breakpoints`
- `pause_execution`, `continue_execution`
- `step_over`, `step_into`, `step_out`

### Code Intelligence - LSP (6)
- `lsp_get_diagnostics` - Real-time errors/warnings
- `lsp_hover` - Documentation and signatures
- `lsp_goto_definition` - Navigate to definitions
- `lsp_completion` - Code completion
- `lsp_document_symbols` - List symbols in file
- `lsp_workspace_symbols` - Search workspace

## Advanced Usage

### Run Specific Tools Only

```bash
# Only debugging tools
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --tools godot-mcp-server:get_* \
  --tools godot-mcp-server:step_*

# Only LSP tools
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --tools godot-mcp-server:lsp_*
```

### Watch Mode (Auto-reload)

```bash
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --watch
```

## Network Configuration

**Docker Desktop (Mac/Windows):** Use `host.docker.internal` (default)

**Linux:** Use `host.docker.internal` (Docker 20.10+) or `172.17.0.1`

## Benefits of Docker MCP Gateway

1. **Isolation** - Runs in secure container
2. **Management** - Easy start/stop/update
3. **Security** - Proper resource limits
4. **Multiple Clients** - Streaming mode for concurrent access
5. **Monitoring** - Built-in logging and tracing
6. **Consistency** - Same setup across machines

## Resources

- [Docker MCP Gateway](https://github.com/docker/mcp-gateway)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Project Repository](https://github.com/rosskarchner/godot-mcp)
