# Godot MCP Server Usage Guide

## Quick Start

1. **Start Godot with debugging enabled**
   - Open your Godot project
   - Run the project in debug mode (F5) or enable remote debugging
   - The debug port will open at `tcp://127.0.0.1:6007` for a running game
   - Or connect to the editor at `tcp://127.0.0.1:6006`

2. **Run the MCP server**
   ```bash
   npm start
   ```

3. **Connect from your MCP client**
   - Use the `connect_debugger` tool to establish a connection
   - Start debugging with the available tools

## Tool Reference

### Connection Tools

#### connect_debugger
Establishes a connection to the Godot debug port.

**Parameters:**
- `host` (string, optional): Debug port host (default: "127.0.0.1")
- `port` (number, optional): Debug port number (default: 6006)

**Example:**
```json
{
  "tool": "connect_debugger",
  "arguments": {
    "host": "127.0.0.1",
    "port": 6007
  }
}
```

#### disconnect_debugger
Closes the connection to the Godot debug port.

**Example:**
```json
{
  "tool": "disconnect_debugger",
  "arguments": {}
}
```

### Thread Management

#### get_threads
Lists all threads in the running Godot instance.

**Returns:**
```json
{
  "threads": [
    {
      "id": 1,
      "name": "Main Thread"
    }
  ]
}
```

### Stack Inspection

#### get_stack_trace
Retrieves the call stack for a specific thread. Essential for understanding where execution is paused.

**Parameters:**
- `threadId` (number, required): The thread ID

**Example:**
```json
{
  "tool": "get_stack_trace",
  "arguments": {
    "threadId": 1
  }
}
```

**Returns:**
```json
{
  "stackFrames": [
    {
      "id": 0,
      "name": "_process",
      "source": {
        "path": "res://scripts/player.gd"
      },
      "line": 42,
      "column": 1
    }
  ]
}
```

#### get_scopes
Gets variable scopes (local, global, etc.) for a stack frame.

**Parameters:**
- `frameId` (number, required): Stack frame ID from get_stack_trace

**Example:**
```json
{
  "tool": "get_scopes",
  "arguments": {
    "frameId": 0
  }
}
```

#### get_variables
Retrieves variables from a scope.

**Parameters:**
- `variablesReference` (number, required): Reference from scope or parent variable

**Example:**
```json
{
  "tool": "get_variables",
  "arguments": {
    "variablesReference": 1
  }
}
```

### Expression Evaluation

#### evaluate_expression
Evaluates a GDScript expression in the running game context.

**Parameters:**
- `expression` (string, required): GDScript expression
- `frameId` (number, optional): Stack frame context
- `context` (string, optional): Evaluation context ('repl', 'watch', 'hover', 'clipboard')

**Examples:**

Get player position:
```json
{
  "tool": "evaluate_expression",
  "arguments": {
    "expression": "get_node('/root/Player').position"
  }
}
```

Check health:
```json
{
  "tool": "evaluate_expression",
  "arguments": {
    "expression": "health",
    "frameId": 0,
    "context": "watch"
  }
}
```

### Breakpoint Management

#### set_breakpoint
Sets a breakpoint in a source file.

**Parameters:**
- `source` (string, required): Path to source file (e.g., "res://scripts/player.gd")
- `line` (number, required): Line number (1-indexed)
- `condition` (string, optional): Conditional breakpoint expression

**Examples:**

Simple breakpoint:
```json
{
  "tool": "set_breakpoint",
  "arguments": {
    "source": "res://scripts/player.gd",
    "line": 42
  }
}
```

Conditional breakpoint:
```json
{
  "tool": "set_breakpoint",
  "arguments": {
    "source": "res://scripts/enemy.gd",
    "line": 100,
    "condition": "health <= 0"
  }
}
```

#### remove_breakpoints
Removes all breakpoints from a source file.

**Parameters:**
- `source` (string, required): Path to source file

**Example:**
```json
{
  "tool": "remove_breakpoints",
  "arguments": {
    "source": "res://scripts/player.gd"
  }
}
```

### Execution Control

#### pause_execution
Pauses game execution.

**Parameters:**
- `threadId` (number, optional): Specific thread to pause

**Example:**
```json
{
  "tool": "pause_execution",
  "arguments": {
    "threadId": 1
  }
}
```

#### continue_execution
Resumes execution after a pause or breakpoint.

**Parameters:**
- `threadId` (number, required): Thread to continue

**Example:**
```json
{
  "tool": "continue_execution",
  "arguments": {
    "threadId": 1
  }
}
```

#### step_over
Steps over the current line (doesn't enter function calls).

**Parameters:**
- `threadId` (number, required): Thread to step

**Example:**
```json
{
  "tool": "step_over",
  "arguments": {
    "threadId": 1
  }
}
```

#### step_into
Steps into function calls.

**Parameters:**
- `threadId` (number, required): Thread to step

**Example:**
```json
{
  "tool": "step_into",
  "arguments": {
    "threadId": 1
  }
}
```

#### step_out
Steps out of the current function.

**Parameters:**
- `threadId` (number, required): Thread to step

**Example:**
```json
{
  "tool": "step_out",
  "arguments": {
    "threadId": 1
  }
}
```

## Common Workflows

### Debugging a Crash

1. Connect to the running game:
   ```json
   {"tool": "connect_debugger", "arguments": {"port": 6007}}
   ```

2. Set a breakpoint before the suspected issue:
   ```json
   {"tool": "set_breakpoint", "arguments": {"source": "res://scripts/player.gd", "line": 100}}
   ```

3. When hit, get the stack trace:
   ```json
   {"tool": "get_stack_trace", "arguments": {"threadId": 1}}
   ```

4. Inspect variables:
   ```json
   {"tool": "get_scopes", "arguments": {"frameId": 0}}
   {"tool": "get_variables", "arguments": {"variablesReference": 1}}
   ```

### Performance Analysis

1. Connect and pause execution:
   ```json
   {"tool": "connect_debugger", "arguments": {}}
   {"tool": "pause_execution", "arguments": {"threadId": 1}}
   ```

2. Evaluate performance-related expressions:
   ```json
   {"tool": "evaluate_expression", "arguments": {"expression": "Performance.get_monitor(Performance.TIME_FPS)"}}
   {"tool": "evaluate_expression", "arguments": {"expression": "Engine.get_frames_per_second()"}}
   ```

3. Continue and repeat to sample:
   ```json
   {"tool": "continue_execution", "arguments": {"threadId": 1}}
   ```

### Inspecting Scene Tree

1. Connect to the editor or running game
2. Evaluate scene tree queries:
   ```json
   {"tool": "evaluate_expression", "arguments": {"expression": "get_tree().get_root().get_child_count()"}}
   {"tool": "evaluate_expression", "arguments": {"expression": "get_tree().get_nodes_in_group('enemies').size()"}}
   ```

## Troubleshooting

### Cannot Connect

**Problem:** Connection timeout or refused

**Solutions:**
- Verify Godot is running with debug mode enabled
- Check the correct port (6006 for editor, 6007 for running game)
- Ensure no firewall is blocking the connection
- Try telnet to verify port is open: `telnet 127.0.0.1 6006`

### No Response from DAP

**Problem:** Commands hang or timeout

**Solutions:**
- Verify the game is actually paused at a breakpoint
- Check that you're using the correct thread ID
- Some commands only work when execution is paused

### Docker Connection Issues

**Problem:** Cannot connect to Godot from Docker

**Solutions:**
- Use `--network host` mode: `docker run -i --network host godot-mcp-server`
- Or set `GODOT_DEBUG_HOST=host.docker.internal` for Docker Desktop
- On Linux, `127.0.0.1` from container won't reach host

## Integration Examples

### Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "godot": {
      "command": "node",
      "args": ["/absolute/path/to/godot-mcp/src/index.js"],
      "env": {
        "GODOT_DEBUG_PORT": "6007"
      }
    }
  }
}
```

### Docker with MCP

```bash
docker mcp install godot-mcp-server
```

Then reference it in your MCP client configuration.
