# Using Godot MCP Server with Docker MCP Gateway

This guide explains how to use the Godot MCP Server with [Docker's MCP Gateway](https://github.com/docker/mcp-gateway), which provides a robust way to run and manage MCP servers in Docker containers.

## What is Docker MCP Gateway?

Docker MCP Gateway is a CLI tool that:
- 🐳 Runs MCP servers as isolated Docker containers
- 🔧 Manages server lifecycle and configuration
- 🔐 Handles secrets securely via Docker Desktop
- 🌐 Provides unified interface for AI clients
- 📋 Supports dynamic tool discovery
- 🔍 Built-in logging and monitoring

## Prerequisites

- **Docker Desktop** with MCP Toolkit feature enabled
- **Godot Editor** running on your host machine
- **`docker mcp` CLI** (included in recent Docker Desktop versions)

## Quick Start

### 1. Build the Docker Image

```bash
docker build -t godot-mcp-server .
```

### 2. Run with Docker MCP Gateway (Self-Contained)

The image includes metadata labels that allow it to run without a catalog:

```bash
docker mcp gateway run --server docker://godot-mcp-server:latest
```

This works immediately without any additional configuration!

### 3. Connect from AI Client

Configure your AI client (e.g., Claude Desktop, VS Code Copilot) to use the gateway:

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

## Using with Custom Catalog

For more control and reusability, add the server to a custom catalog:

### 1. Create a Custom Catalog

```bash
# Import the provided catalog
docker mcp catalog import ./docker-mcp-catalog.yaml

# Or create manually
docker mcp catalog create my-godot-catalog
docker mcp catalog add my-godot-catalog godot-mcp-server ./docker-mcp-catalog.yaml
```

### 2. Enable the Server

```bash
docker mcp server enable godot-mcp-server
```

### 3. Configure (Optional)

If Godot is running on non-default ports:

```bash
docker mcp config write '
godot-mcp-server:
  debug_host: "host.docker.internal"
  debug_port: "6006"
  lsp_host: "host.docker.internal"
  lsp_port: "6005"
'
```

### 4. Run the Gateway

```bash
# With stdio (for single AI client)
docker mcp gateway run --catalog ./docker-mcp-catalog.yaml

# With streaming (for multiple AI clients)
docker mcp gateway run --catalog ./docker-mcp-catalog.yaml --port 8080 --transport streaming
```

## Using with Docker Compose

Create a `docker-compose.yml` for persistent gateway:

```yaml
version: '3.8'

services:
  godot-mcp-gateway:
    image: docker/mcp-gateway
    command:
      - gateway
      - run
      - --server
      - docker://godot-mcp-server:latest
      - --transport
      - streaming
      - --port
      - "8080"
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - GODOT_DEBUG_HOST=host.docker.internal
      - GODOT_DEBUG_PORT=6006
      - GODOT_LSP_HOST=host.docker.internal
      - GODOT_LSP_PORT=6005
    restart: unless-stopped

  # Your Godot MCP server (if running as separate service)
  godot-mcp-server:
    build: .
    network_mode: host
    restart: unless-stopped
```

Then start with:

```bash
docker compose up -d
```

## Configuration Options

### Environment Variables

The server accepts these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `GODOT_DEBUG_HOST` | Host where Godot editor is running | `host.docker.internal` |
| `GODOT_DEBUG_PORT` | Godot DAP debug port | `6006` |
| `GODOT_LSP_HOST` | Host where Godot editor is running | `host.docker.internal` |
| `GODOT_LSP_PORT` | Godot LSP port | `6005` |

### Network Configuration

**Important**: The server needs to connect to Godot running on your host machine.

- **Docker Desktop (Mac/Windows)**: Use `host.docker.internal`
- **Linux**: Use `host.docker.internal` (recent Docker versions) or `172.17.0.1`

### Custom Ports

If Godot uses non-default ports, configure via environment variables:

```bash
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --env GODOT_DEBUG_PORT=7006 \
  --env GODOT_LSP_PORT=7005
```

## Advanced Usage

### Running with Specific Tools Only

```bash
# Only enable debugging tools (not LSP)
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --tools godot-mcp-server:connect_debugger \
  --tools godot-mcp-server:get_* \
  --tools godot-mcp-server:set_* \
  --tools godot-mcp-server:step_*

# Only enable LSP tools
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --tools godot-mcp-server:lsp_*
```

### Verbose Logging

```bash
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --verbose \
  --log-calls
```

### Watch Mode

Auto-reload on configuration changes:

```bash
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --watch
```

## Publishing to Docker Hub

To make the server available in Docker Hub for easier distribution:

### 1. Build and Tag

```bash
docker build -t yourusername/godot-mcp-server:latest .
docker tag yourusername/godot-mcp-server:latest yourusername/godot-mcp-server:2.0.0
```

### 2. Push to Docker Hub

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

### Server Can't Connect to Godot

**Symptom**: "Connection timeout" or "ECONNREFUSED" errors

**Solutions**:
1. Verify Godot is running with debug/LSP enabled
2. Check ports are correct (6006 for DAP, 6005 for LSP)
3. On Linux, try `172.17.0.1` instead of `host.docker.internal`
4. Check firewall isn't blocking connections

### Testing Connection

```bash
# Test if Godot ports are accessible from Docker
docker run --rm alpine sh -c "apk add --no-cache netcat-openbsd && nc -zv host.docker.internal 6006"
```

### Viewing Server Logs

```bash
# With gateway
docker mcp gateway run --server docker://godot-mcp-server:latest --verbose

# Direct container
docker logs <container-id>
```

### Checking Server Status

```bash
# List running MCP containers
docker ps --filter "label=io.docker.mcp.server"

# Inspect server details
docker mcp server inspect godot-mcp-server
```

## Available Tools

The server provides 22 tools across debugging and code intelligence:

### Connection Management (4 tools)
- `connect_debugger`, `disconnect_debugger`
- `connect_lsp`, `disconnect_lsp`

### Debugging - DAP (12 tools)
- `get_threads`, `get_stack_trace`, `get_scopes`, `get_variables`
- `evaluate_expression`
- `set_breakpoint`, `remove_breakpoints`
- `pause_execution`, `continue_execution`
- `step_over`, `step_into`, `step_out`

### Code Intelligence - LSP (6 tools)
- `lsp_get_diagnostics` - Real-time errors/warnings
- `lsp_hover` - Documentation and signatures
- `lsp_goto_definition` - Navigate to definitions
- `lsp_completion` - Code completion
- `lsp_document_symbols` - List symbols in file
- `lsp_workspace_symbols` - Search workspace symbols

## Benefits of Using Docker MCP Gateway

1. **Isolation** - Server runs in its own container
2. **Security** - Proper resource limits and network isolation
3. **Management** - Easy start/stop/update workflow
4. **Consistency** - Same setup across different machines
5. **Integration** - Works with multiple AI clients simultaneously
6. **Monitoring** - Built-in logging and call tracing

## Examples

### Example 1: Development Workflow

```bash
# Start the gateway in one terminal
docker mcp gateway run --server docker://godot-mcp-server:latest --verbose

# Gateway is now available for your AI assistant to use
# Your AI can now help debug Godot projects!
```

### Example 2: Team Shared Gateway

```yaml
# docker-compose.yml for team
version: '3.8'
services:
  godot-gateway:
    image: docker/mcp-gateway
    command:
      - gateway
      - run
      - --server
      - docker://godot-mcp-server:latest
      - --transport
      - streaming
      - --port
      - "8080"
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

Team members connect to `http://gateway-host:8080`

### Example 3: Multiple Godot Instances

```bash
# Instance 1 (default ports)
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --port 8080

# Instance 2 (custom ports)
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --port 8081 \
  --env GODOT_DEBUG_PORT=6016 \
  --env GODOT_LSP_PORT=6015
```

## Resources

- [Docker MCP Gateway Documentation](https://github.com/docker/mcp-gateway)
- [Docker Hub MCP Catalog](https://hub.docker.com/mcp)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Godot Engine](https://godotengine.org/)

## Contributing

To add this server to the official Docker MCP Catalog, submit a PR to the catalog repository with the `docker-mcp-catalog.yaml` file.
