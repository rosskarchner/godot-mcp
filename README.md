# Godot MCP Server

An MCP (Model Context Protocol) server that connects to Godot's Debug Adapter Protocol (DAP) port, enabling AI assistants to interact with running Godot instances for debugging, performance monitoring, and project inspection.

## Features

- **Debug Operations**: Set breakpoints, step through code, inspect variables
- **Execution Control**: Pause, continue, step over/into/out
- **Variable Inspection**: Get stack traces, scopes, and variable values
- **Expression Evaluation**: Evaluate GDScript expressions in the running game context
- **Thread Management**: List and control threads in the Godot instance

## Prerequisites

- Node.js 20 or higher
- A running Godot instance with debugging enabled
- Godot must be running with the debug port open:
  - Editor debug port: `tcp://127.0.0.1:6006` (default)
  - Running game debug port: `tcp://127.0.0.1:6007`

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
- `GODOT_DEBUG_PORT`: The port number (default: `6006` for editor, `6007` for running game)

Example:

```bash
GODOT_DEBUG_HOST=127.0.0.1 GODOT_DEBUG_PORT=6007 npm start
```

## Available Tools

### Connection Management

- **connect_debugger**: Connect to the Godot debug port at a specific host and port
- **disconnect_debugger**: Disconnect from the Godot debug port

### Debugging

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

## Usage Examples

### Connecting to Godot

First, ensure Godot is running with debugging enabled. Then connect:

```json
{
  "tool": "connect_debugger",
  "arguments": {
    "host": "127.0.0.1",
    "port": 6006
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

## How It Works

The server implements the Model Context Protocol (MCP) and communicates with Godot's Debug Adapter Protocol (DAP) port. When Godot runs with debugging enabled, it opens a TCP socket that implements the DAP protocol, which this server uses to send commands and receive responses.

The Debug Adapter Protocol is a standardized protocol for debuggers, allowing this server to:
- Set and manage breakpoints
- Control execution flow (pause, continue, step)
- Inspect the runtime state (variables, stack traces)
- Evaluate expressions in the running game context

## Troubleshooting

### Connection Issues

If you can't connect to Godot:

1. Ensure Godot is running with debugging enabled
2. Check that the debug port is open (default 6006 for editor, 6007 for game)
3. Verify no firewall is blocking the connection
4. Try connecting manually with telnet: `telnet 127.0.0.1 6006`

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