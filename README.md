# Godot MCP Server

An MCP (Model Context Protocol) server that connects to Godot's Debug Adapter Protocol (DAP) and Language Server Protocol (LSP) ports, enabling AI assistants to interact with running Godot instances for debugging, code intelligence, and project inspection.

## Features

### Debugging (DAP - Port 6006)
- **Debug Operations**: Set breakpoints, step through code, inspect variables
- **Execution Control**: Pause, continue, step over/into/out
- **Variable Inspection**: Get stack traces, scopes, and variable values
- **Expression Evaluation**: Evaluate GDScript expressions in the running game context
- **Thread Management**: List and control threads in the Godot instance

### Code Intelligence (LSP - Port 6005)
- **Diagnostics**: Real-time error and warning detection across the project
- **Hover Information**: Get function signatures and documentation
- **Go to Definition**: Navigate to symbol definitions
- **Code Completion**: Get completion suggestions for code
- **Symbol Search**: Find symbols across the workspace
- **Document Symbols**: List all symbols in a file

## Prerequisites

- Node.js 20 or higher
- A running Godot instance with debugging and/or LSP enabled
- Godot ports:
  - Editor debug port (DAP): `tcp://127.0.0.1:6006` (default)
  - Language server port (LSP): `tcp://127.0.0.1:6005` (default)

## Installation

### Using npm

```bash
npm install
npm start
```

### Using Docker

First, ensure dependencies are installed locally (required for Docker build):

```bash
npm install
```

Build the Docker image:

```bash
docker build -t godot-mcp-server .
```

Run with Docker:

```bash
docker run -i --network host godot-mcp-server
```

Or deploy with `docker mcp`:

```bash
docker mcp install godot-mcp-server
```

**Note**: Due to an npm bug in Docker builds, the Dockerfile copies the pre-installed `node_modules` directory. Make sure to run `npm install` on the host before building the Docker image.

## Configuration

Set environment variables to configure the connection:

- `GODOT_DEBUG_HOST`: The host address of the Godot debug port (default: `127.0.0.1`)
- `GODOT_DEBUG_PORT`: The debug port number (default: `6006`)
- `GODOT_LSP_HOST`: The host address of the Godot LSP port (default: `127.0.0.1`)
- `GODOT_LSP_PORT`: The LSP port number (default: `6005`)

Example:

```bash
GODOT_DEBUG_HOST=127.0.0.1 GODOT_DEBUG_PORT=6006 GODOT_LSP_PORT=6005 npm start
```

## Available Tools

### Connection Management

- **connect_debugger**: Connect to the Godot debug port at a specific host and port
- **disconnect_debugger**: Disconnect from the Godot debug port
- **connect_lsp**: Connect to the Godot Language Server Protocol port
- **disconnect_lsp**: Disconnect from the Godot LSP port

### Debugging (DAP)

- **get_threads**: List all threads in the running Godot instance
- **get_stack_trace**: Get the stack trace for a specific thread
- **get_scopes**: Get variable scopes (local, global, etc.) for a stack frame
- **get_variables**: Get variables in a specific scope
- **evaluate_expression**: Evaluate a GDScript expression in the running game context

### Breakpoints

- **set_breakpoint**: Set a breakpoint at a specific line in a source file
- **remove_breakpoints**: Remove all breakpoints from a source file

### Execution Control

- **pause_execution**: Pause the execution of the running game
- **continue_execution**: Continue execution after a pause or breakpoint
- **step_over**: Step over the current line
- **step_into**: Step into a function call
- **step_out**: Step out of the current function

### Code Intelligence (LSP)

- **lsp_get_diagnostics**: Get all diagnostics (errors and warnings) for a file or entire workspace
- **lsp_hover**: Get hover information (documentation, signatures) for a symbol at a position
- **lsp_goto_definition**: Get the definition location of a symbol
- **lsp_completion**: Get code completion suggestions at a position
- **lsp_document_symbols**: Get all symbols (functions, classes, variables) in a document
- **lsp_workspace_symbols**: Search for symbols across the entire workspace

## Usage Examples

### Connecting to Godot

First, ensure Godot is running with debugging and/or LSP enabled. Then connect:

```json
{
  "tool": "connect_debugger",
  "arguments": {
    "host": "127.0.0.1",
    "port": 6006
  }
}
```

To connect to LSP:
```json
{
  "tool": "connect_lsp",
  "arguments": {
    "host": "127.0.0.1",
    "port": 6005
  }
}
```

### Inspecting Variables

1. Get the list of threads:
```json
{
  "tool": "get_threads"
}
```

2. Get the stack trace for a thread:
```json
{
  "tool": "get_stack_trace",
  "arguments": {
    "threadId": 1
  }
}
```

3. Get scopes for a frame:
```json
{
  "tool": "get_scopes",
  "arguments": {
    "frameId": 0
  }
}
```

4. Get variables in a scope:
```json
{
  "tool": "get_variables",
  "arguments": {
    "variablesReference": 1
  }
}
```

### Setting Breakpoints

**Note**: Breakpoints require the full filesystem path, not the `res://` format. You can obtain the correct path from stack traces.

```json
{
  "tool": "set_breakpoint",
  "arguments": {
    "source": "/absolute/path/to/project/scripts/player.gd",
    "line": 42,
    "condition": "health < 10"
  }
}
```

### Evaluating Expressions

```json
{
  "tool": "evaluate_expression",
  "arguments": {
    "expression": "get_node('/root/Player').position",
    "context": "repl"
  }
}
```

### Using Code Intelligence (LSP)

1. Get diagnostics for a file:
```json
{
  "tool": "lsp_get_diagnostics",
  "arguments": {
    "uri": "file:///path/to/project/scripts/player.gd"
  }
}
```

2. Get hover information:
```json
{
  "tool": "lsp_hover",
  "arguments": {
    "uri": "file:///path/to/project/scripts/player.gd",
    "line": 10,
    "character": 5
  }
}
```

3. Find symbol definition:
```json
{
  "tool": "lsp_goto_definition",
  "arguments": {
    "uri": "file:///path/to/project/scripts/player.gd",
    "line": 15,
    "character": 10
  }
}
```

4. Search for symbols:
```json
{
  "tool": "lsp_workspace_symbols",
  "arguments": {
    "query": "Player"
  }
}
```

## How It Works

The server implements the Model Context Protocol (MCP) and communicates with Godot using two standardized protocols:

### Debug Adapter Protocol (DAP - Port 6006)
When Godot runs with debugging enabled, it opens a TCP socket that implements the DAP protocol, which this server uses to:
- Set and manage breakpoints
- Control execution flow (pause, continue, step)
- Inspect the runtime state (variables, stack traces)
- Evaluate expressions in the running game context

### Language Server Protocol (LSP - Port 6005)
Godot's built-in LSP server provides code intelligence features:
- Real-time diagnostics across the entire project
- Hover documentation with function signatures
- Go-to-definition navigation
- Code completion suggestions
- Symbol search and navigation

## Troubleshooting

### Connection Issues

If you can't connect to Godot:

1. Ensure Godot is running
2. For debugging: Ensure debugging is enabled in the editor
3. For LSP: The language server starts automatically when the editor opens
4. Check that the ports are open (6006 for DAP, 6005 for LSP)
5. Verify no firewall is blocking the connection
6. Try connecting manually with telnet: `telnet 127.0.0.1 6006` or `telnet 127.0.0.1 6005`

### Docker Networking

When running in Docker, use `host.docker.internal` instead of `127.0.0.1` to access the host machine:

```bash
docker run -i -e GODOT_DEBUG_HOST=host.docker.internal godot-mcp-server
```

Or use `--network host` to share the host's network:

```bash
docker run -i --network host godot-mcp-server
```

## License

MIT