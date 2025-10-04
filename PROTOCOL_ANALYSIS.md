# Godot Debug Protocol Analysis

## Summary

Godot uses **TWO DIFFERENT** debug protocols on different ports:

| Port | Protocol | Status | Use Case |
|------|----------|--------|----------|
| 6006 | **DAP** (Debug Adapter Protocol) | ✅ **Working** | Editor debugging (plugins, tool scripts) |
| 6007 | **Custom Binary Protocol** | ❌ Not implemented | Game instance remote debugging |
| 6005 | **LSP** (Language Server Protocol) | 🌟 Recommended addition | Code intelligence |

## Port 6006 - Editor Debug (DAP)

### Protocol: Debug Adapter Protocol (JSON-RPC over TCP)
### Status: ✅ **FULLY FUNCTIONAL** - Current implementation works!

The current `dap-client.js` implementation is **correct** for port 6006. This port uses standard DAP protocol with:
- Content-Length headers
- JSON-RPC messages
- Standard DAP commands (initialize, threads, stackTrace, scopes, variables, evaluate, etc.)

**Evidence from TEST_RESULTS.md:**
- All 13 debugging tools work correctly on port 6006
- Stack traces, variables, expressions, breakpoints all functional
- Standard DAP request/response pattern works

**Current Implementation:** `src/dap-client.js` - **DO NOT MODIFY** (it works!)

## Port 6007 - Game Remote Debug (Custom Protocol)

### Protocol: Godot Custom Binary Protocol
### Status: ❌ **NOT COMPATIBLE** with current DAP implementation

This port uses a completely different protocol:

### Message Format
```
[4 bytes: length (uint32 LE)] [N bytes: Godot Variant (binary)]
```

### Message Structure (Array Variant)
```javascript
[command_string, thread_id_int, data_array]
```

### Available Commands
From `core/debugger/remote_debugger.cpp`:
- `"step"` - Step over one line
- `"next"` - Step over (same as step in this context)
- `"continue"` - Continue execution
- `"break"` - Break execution
- `"get_stack_dump"` - Get full stack trace
- `"get_stack_frame_vars"` - Get variables for a frame
- `"breakpoint"` - Set/remove breakpoint: [file, line, set_bool]
- `"set_skip_breakpoints"` - Toggle breakpoint skipping
- `"set_ignore_error_breaks"` - Toggle error break ignoring
- `"evaluate"` - Evaluate expression in frame context
- `"reload_scripts"` - Reload specific scripts
- `"reload_all_scripts"` - Reload all scripts

### Implementation Challenge

To support port 6007, you would need:

1. **Variant Encoder/Decoder** - Implement Godot's binary Variant format
   - See: `core/io/marshalls.cpp` in Godot source
   - Complex binary format with type tags
   - Supports all Godot types (int, float, String, Array, Dictionary, Objects, etc.)

2. **Protocol Handler** - Different from DAP
   - No Content-Length headers
   - Binary length prefix (4 bytes LE)
   - Array-based command structure
   - Different response format

3. **Command Mapping** - Map DAP-like API to Godot commands
   - Current MCP tools would need translation layer
   - Response formats differ significantly

### Feasibility Assessment

**Effort Level:** High
- Would require ~500-1000 lines of Variant encoding/decoding code
- Testing with various data types
- Potential for subtle binary format bugs

**Recommendation:** 
- Keep port 6006 (DAP) implementation as-is - it works great!
- Document that port 6007 requires different implementation
- Consider port 6007 support as future enhancement if needed
- **Most debugging can be done via port 6006 (editor)**

## Port 6005 - Language Server (LSP)

### Protocol: Language Server Protocol (JSON-RPC over TCP)
### Status: 🌟 **RECOMMENDED ADDITION**

As discovered in testing, Godot's LSP port provides valuable code intelligence:
- Function signatures and documentation
- Real-time diagnostics across project
- Go-to-definition support
- Code completion
- Workspace symbol search

**Adding LSP support would be straightforward** since:
1. It's JSON-RPC like DAP (similar to port 6006)
2. Standard LSP protocol with existing Node.js libraries
3. Complements debugging with static analysis

## Answering Your Question

> "Will this mess up the working DAP interface to port 6007?"

**Answer:** No! Because:

1. **Port 6007 doesn't use DAP** - It uses Godot's custom binary protocol
2. **Port 6006 DOES use DAP** - And it works perfectly with current code
3. **The current implementation is correct** for port 6006

The confusion comes from documentation mentioning "6007 for running game" but the actual working implementation is for port 6006 (editor). Port 6007 has never worked with the current DAP implementation because it uses a completely different protocol.

## Recommendation

**DO NOT modify the current `dap-client.js`** - it works correctly for port 6006!

Instead, if you want to support both protocols:

1. **Keep current implementation for port 6006** (DAP - Editor debugging)
2. **Create separate client for port 6007** (Custom - Game debugging)
   - New file: `src/godot-remote-client.js`
   - Implement Variant encoding/decoding
   - Expose as separate set of tools or auto-detect protocol

3. **Consider adding port 6005** (LSP - Code intelligence)
   - New file: `src/lsp-client.js`
   - Use existing LSP libraries
   - Add code intelligence tools

## Current Working Configuration

```javascript
// This works and should not be changed:
const dapClient = new DAPClient('127.0.0.1', 6006); // Editor debugging
await dapClient.connect(); // Uses DAP protocol ✅
```

```javascript
// This has never worked (different protocol):
const dapClient = new DAPClient('127.0.0.1', 6007); // Game debugging
await dapClient.connect(); // Tries DAP but Godot speaks custom protocol ❌
```

## Source References

1. **DAP Server (Port 6006)**: `editor/debugger/debug_adapter/debug_adapter_server.cpp`
2. **Remote Debugger (Port 6007)**: `core/debugger/remote_debugger_peer.cpp`
3. **LSP Server (Port 6005)**: `modules/gdscript/language_server/gdscript_language_server.cpp`

All source references are from the Godot Engine repository: https://github.com/godotengine/godot
