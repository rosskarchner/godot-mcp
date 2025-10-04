# Docker MCP Gateway - Quick Start

Get up and running with Godot MCP Server using Docker MCP Gateway in under 5 minutes!

## Prerequisites

- Docker Desktop with MCP Toolkit enabled
- Godot Editor running on your machine

## 1. Build the Image (30 seconds)

```bash
docker build -t godot-mcp-server .
```

## 2. Run with Gateway (Immediate)

```bash
docker mcp gateway run --server docker://godot-mcp-server:latest
```

That's it! The gateway is now running and available for your AI assistant.

## 3. Configure Your AI Client

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Add to your workspace settings:

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

## 4. Start Debugging!

Open Godot Editor and start your project. Your AI assistant can now:

- 🐛 Set breakpoints and debug your game
- 📊 Inspect variables and stack traces  
- 📝 Get code documentation and completion
- 🔍 Search for symbols across your project
- ⚡ Evaluate GDScript expressions

## Alternative: Using Docker Compose

For persistent gateway:

```bash
# Run with gateway profile
docker compose --profile gateway up -d

# View logs
docker compose logs -f godot-mcp-gateway
```

## Alternative: Direct Run (No Gateway)

```bash
# Simple Docker run
docker run -i --network host godot-mcp-server

# Or with docker-compose
docker compose --profile direct up -d
```

## Verification

Test that the gateway can reach Godot:

```bash
# Check if ports are accessible
docker run --rm alpine sh -c "apk add --no-cache netcat-openbsd && nc -zv host.docker.internal 6006"
```

Expected output: `Connection to host.docker.internal (192.168.65.2) 6006 port [tcp/*] succeeded!`

## What's Available?

The server provides 22 tools:

**Debugging (14 tools)**:
- Thread and stack inspection
- Variable viewing
- Breakpoint management
- Step over/into/out
- Expression evaluation

**Code Intelligence (6 tools)**:
- Real-time diagnostics
- Hover documentation
- Go-to-definition
- Code completion
- Symbol search

**Connection (2 tools each for DAP and LSP)**

## Troubleshooting

### Can't connect to Godot?

1. Make sure Godot is running
2. Check ports are correct (6006 for DAP, 6005 for LSP)
3. On Linux, use `172.17.0.1` instead of `host.docker.internal`

### Want verbose logging?

```bash
docker mcp gateway run \
  --server docker://godot-mcp-server:latest \
  --verbose \
  --log-calls
```

## Next Steps

- Read [DOCKER_MCP_GATEWAY.md](DOCKER_MCP_GATEWAY.md) for advanced configuration
- Check [USAGE.md](USAGE.md) for tool examples
- See [docker-mcp-catalog.yaml](docker-mcp-catalog.yaml) to customize the catalog

## Need Help?

- 📖 [Full Documentation](DOCKER_MCP_GATEWAY.md)
- 🐛 [Report Issues](https://github.com/rosskarchner/godot-mcp/issues)
- 💬 [Discussions](https://github.com/rosskarchner/godot-mcp/discussions)
