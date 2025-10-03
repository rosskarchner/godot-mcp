# Architecture

## Overview

The Godot MCP Server is a bridge between the Model Context Protocol (MCP) and Godot's Debug Adapter Protocol (DAP). It enables AI assistants and other MCP clients to interact with running Godot instances for debugging, performance analysis, and project inspection.

## Components

### 1. MCP Server (`src/index.js`)

The main server implements the Model Context Protocol specification:

- **Transport**: Uses stdio for communication with MCP clients
- **Tools**: Exposes 14 debugging and inspection tools
- **Connection Management**: Maintains a persistent DAP client connection

#### Available Tools

**Connection Tools:**
- `connect_debugger` - Establish connection to Godot debug port
- `disconnect_debugger` - Close connection

**Thread Management:**
- `get_threads` - List all threads

**Stack Inspection:**
- `get_stack_trace` - Get call stack for a thread
- `get_scopes` - Get variable scopes for a frame
- `get_variables` - Get variables in a scope

**Expression Evaluation:**
- `evaluate_expression` - Evaluate GDScript in runtime context

**Breakpoint Management:**
- `set_breakpoint` - Set breakpoint (including conditional)
- `remove_breakpoints` - Remove breakpoints from file

**Execution Control:**
- `pause_execution` - Pause game execution
- `continue_execution` - Resume execution
- `step_over` - Step over current line
- `step_into` - Step into function call
- `step_out` - Step out of function

### 2. DAP Client (`src/dap-client.js`)

A custom implementation of the Debug Adapter Protocol client:

- **Protocol**: Implements DAP message framing (Content-Length headers + JSON)
- **Connection**: TCP socket to Godot's debug port (default: 127.0.0.1:6006)
- **Message Queue**: Handles async request/response pairs
- **Event Handling**: Processes DAP events from Godot

#### DAP Message Flow

```
MCP Client → MCP Server → DAP Client → Godot (TCP 6006/6007)
                ↓              ↓              ↓
            Tool Call      DAP Request    Debugger Action
                ↑              ↑              ↑
            Response      DAP Response    Debug Info
```

#### Message Format

DAP messages use HTTP-like headers:
```
Content-Length: 123\r\n
\r\n
{"type":"request","seq":1,"command":"threads",...}
```

### 3. Docker Container

The Dockerfile packages the server for portable deployment:

- **Base Image**: `node:20-slim` for minimal size
- **Dependencies**: Pre-installed node_modules (workaround for npm Docker bug)
- **Network**: Can use host network or map ports
- **Environment**: Configurable via GODOT_DEBUG_HOST and GODOT_DEBUG_PORT

## Connection Flow

### Initial Connection

1. MCP client starts the server via stdio
2. Client calls `connect_debugger` tool with host/port
3. DAP client creates TCP connection to Godot
4. DAP client sends `initialize` request
5. Connection is ready for debugging commands

### Request Handling

1. MCP client sends tool call request
2. MCP server validates and routes to appropriate handler
3. Handler calls DAP client method
4. DAP client sends formatted DAP request over TCP
5. Godot processes request and sends response
6. DAP client parses response and resolves promise
7. MCP server formats response and returns to client

### Error Handling

- Connection errors: Caught and reported with helpful messages
- Timeout: 10 seconds for DAP requests, 5 seconds for connection
- Invalid requests: Validated by MCP schema
- DAP errors: Error messages passed through to client

## Debugging Workflow

### Setting Up

```
1. Start Godot with debugging enabled
2. Run MCP server (npm start or docker run)
3. Connect via MCP client
4. Call connect_debugger tool
```

### Inspecting State

```
1. Call get_threads to find thread IDs
2. Call get_stack_trace with thread ID
3. Call get_scopes with frame ID
4. Call get_variables with variables reference
```

### Expression Evaluation

```
1. Call evaluate_expression with GDScript code
2. Optionally provide frameId for context
3. Get result with value and type info
```

### Breakpoint Debugging

```
1. Call set_breakpoint with file path and line
2. Continue execution until breakpoint hit
3. Inspect state using stack/scope/variable tools
4. Step through code with step_over/into/out
5. Continue execution or set more breakpoints
```

## Protocol Details

### DAP Commands Used

- `initialize` - Initialize debug session
- `threads` - List threads
- `stackTrace` - Get call stack
- `scopes` - Get variable scopes
- `variables` - Get variable values
- `evaluate` - Evaluate expressions
- `setBreakpoints` - Set/update breakpoints
- `pause` - Pause execution
- `continue` - Resume execution
- `next` - Step over
- `stepIn` - Step into
- `stepOut` - Step out

### MCP Schema

Tools follow MCP schema with:
- `name` - Tool identifier
- `description` - Human-readable description
- `inputSchema` - JSON Schema for parameters
- `required` - List of required parameters

## Performance Considerations

### Connection Management

- Single persistent connection to Godot
- Automatic reconnection on disconnect
- Connection reuse across multiple requests

### Message Buffering

- Efficient buffer handling for TCP data
- Processes complete messages immediately
- No unnecessary memory allocation

### Request Timeout

- Configurable timeouts prevent hanging
- Default 10s for DAP requests
- 5s for initial connection

## Security

### Network

- Connects only to localhost by default
- No external network exposure
- TCP connection not encrypted (localhost only)

### Code Execution

- Expression evaluation runs in Godot context
- No direct file system access from server
- All operations require active Godot instance

### Docker

- Minimal base image
- No unnecessary packages
- Runs as non-root (inherited from base)

## Limitations

### Current Limitations

1. **Single Connection**: Only one Godot instance at a time
2. **No Authentication**: Assumes trusted local network
3. **Limited Error Context**: Some DAP errors lack detail
4. **Sync Only**: No async event streaming to MCP clients

### Known Issues

1. **npm Docker Bug**: Requires pre-installed node_modules for Docker build
2. **Connection Timeout**: Initial connection limited to 5 seconds
3. **Thread ID Discovery**: Must call get_threads first to get IDs

## Future Enhancements

### Potential Improvements

1. **Multi-Instance**: Support multiple Godot connections
2. **Event Streaming**: Push DAP events to MCP clients
3. **Performance Tools**: Dedicated profiling commands
4. **Scene Inspector**: Direct scene tree inspection tools
5. **Remote Debugging**: Support for remote Godot instances
6. **Authentication**: Optional auth for remote connections

### Protocol Extensions

1. **Custom DAP Commands**: Godot-specific debug commands
2. **Resource Inspection**: Direct asset inspection
3. **Live Editing**: Hot reload support
4. **Crash Analysis**: Post-mortem debugging

## Testing

### Unit Tests

Currently manual testing with:
- `test-tools.sh` - Tests MCP server functionality
- `test-connection.sh` - Tests Godot connectivity

### Integration Tests

Manual workflow tests:
1. Connect to running Godot
2. Set breakpoints
3. Inspect variables
4. Evaluate expressions
5. Control execution

### Docker Tests

Verify Docker build and runtime:
1. Build image: `docker build -t godot-mcp-server .`
2. Run container: `docker run -i --network host godot-mcp-server`
3. Test initialization via stdio

## Deployment

### Local Development

```bash
npm install
npm start
```

### Production Docker

```bash
npm install  # Required for Docker build
docker build -t godot-mcp-server .
docker run -i --network host godot-mcp-server
```

### MCP Client Integration

Add to MCP client config:
```json
{
  "mcpServers": {
    "godot": {
      "command": "node",
      "args": ["/path/to/src/index.js"]
    }
  }
}
```

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/)
- [Godot Debug Documentation](https://docs.godotengine.org/en/stable/tutorials/scripting/debug_adapter_protocol.html)
