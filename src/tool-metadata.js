/**
 * Tool definitions and metadata for Godot MCP Server
 * Separates tool schemas from execution logic to enable:
 * - Tool search/discovery
 * - Deferred tool loading
 * - Usage examples for improved accuracy
 */

// DAP Connection Management Tools
const dapConnectTool = {
  name: "godot_dap_connect",
  description: "[DAP/Debugger] Connect to Godot's Debug Adapter Protocol server to enable runtime debugging operations like breakpoints, stepping, and variable inspection. Must be called before using any debug tools. Requires game to be running with --debug flag.",
  category: "connection",
  protocol: "dap",
  tags: ["connect", "setup", "initialize", "session", "debugging"],
  visibility: "always",
  inputSchema: {
    type: "object",
    properties: {
      host: {
        type: "string",
        description: "The host address of the Godot debug port (default: 127.0.0.1)",
        default: "127.0.0.1"
      },
      port: {
        type: "number",
        description: "The port number of the Godot debug port (default: 6006)",
        default: 6006
      }
    }
  }
};

const dapDisconnectTool = {
  name: "godot_dap_disconnect",
  description: "[DAP/Debugger] Disconnect from Godot's Debug Adapter Protocol server and clean up the debug session.",
  category: "connection",
  protocol: "dap",
  tags: ["disconnect", "cleanup", "session"],
  visibility: "always",
  inputSchema: {
    type: "object",
    properties: {}
  }
};

// LSP Connection Management Tools
const lspConnectTool = {
  name: "godot_lsp_connect",
  description: "[LSP/Language Server] Connect to Godot's Language Server Protocol server to enable code intelligence features like autocomplete, diagnostics, go-to-definition, and symbol search. Works with editor, not running game.",
  category: "connection",
  protocol: "lsp",
  tags: ["connect", "setup", "initialize", "session", "code-intelligence"],
  visibility: "always",
  inputSchema: {
    type: "object",
    properties: {
      host: {
        type: "string",
        description: "The host address of the Godot LSP port (default: 127.0.0.1)",
        default: "127.0.0.1"
      },
      port: {
        type: "number",
        description: "The port number of the Godot LSP port (default: 6005)",
        default: 6005
      }
    }
  }
};

const lspDisconnectTool = {
  name: "godot_lsp_disconnect",
  description: "[LSP/Language Server] Disconnect from Godot's Language Server Protocol and clear cached diagnostics.",
  category: "connection",
  protocol: "lsp",
  tags: ["disconnect", "cleanup", "session"],
  visibility: "always",
  inputSchema: {
    type: "object",
    properties: {}
  }
};

// DAP Debugging - State Inspection
// DAP Debugging - State Inspection (Removed unreliable DAP inspection tools in favor of Editor Bridge)
// The following tools were removed: list_threads, get_stacktrace, get_scopes, inspect_variables

// DAP Debugging - Breakpoints
const dapSetBreakpointTool = {
  name: "godot_dap_set_breakpoint",
  description: "[DAP/Debugger] Set a breakpoint at a specific line in a GDScript file. Execution will pause when this line is reached during runtime debugging. IMPORTANT: Use full filesystem paths (from godot_lsp_find_definition or similar), NOT res:// paths.",
  category: "dap-debugging",
  protocol: "dap",
  tags: ["breakpoint", "debug", "conditional", "stop", "pause"],
  visibility: "deferred",
  dependencies: ["godot_dap_connect"],
  inputSchema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description: "Full filesystem path to the GDScript file (e.g., '/home/user/project/scripts/player.gd')."
      },
      line: {
        type: "number",
        description: "Line number to set the breakpoint at (1-indexed, first line is 1)"
      },
      condition: {
        type: "string",
        description: "Optional: GDScript expression that must be true for breakpoint to trigger (e.g., 'health <= 0')"
      }
    },
    required: ["source", "line"]
  },
  examples: [
    {
      description: "Basic unconditional breakpoint at line 25",
      input: {
        source: "/home/user/godot-project/scripts/player.gd",
        line: 25
      }
    }
  ]
};

const dapClearBreakpointsTool = {
  name: "godot_dap_clear_breakpoints",
  description: "[DAP/Debugger] Remove all breakpoints from a specific GDScript file.",
  category: "dap-debugging",
  protocol: "dap",
  tags: ["breakpoint", "debug", "clear", "remove"],
  visibility: "deferred",
  dependencies: ["godot_dap_connect"],
  inputSchema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description: "Full filesystem path to the GDScript file to clear breakpoints from"
      }
    },
    required: ["source"]
  }
};

// ... existing LSP tools ...
const lspGetErrorsTool = {
  name: "godot_lsp_get_errors",
  // ... (rest of lspGetErrorsTool and subsequent LSP tools unchanged until exports) ...
  description: "[LSP/Language Server] Get syntax errors, type errors, and warnings for GDScript files. Returns diagnostics for a specific file or all open files. Use this to find and fix code issues before running the game.",
  category: "lsp-code-intelligence",
  protocol: "lsp",
  tags: ["errors", "diagnostics", "warnings", "syntax", "type-check", "issues"],
  visibility: "deferred",
  dependencies: ["godot_lsp_connect"],
  inputSchema: {
    type: "object",
    properties: {
      uri: {
        type: "string",
        description: "Optional: file URI to get diagnostics for (e.g., 'file:///path/to/file.gd'). If omitted, returns all diagnostics."
      }
    }
  },
  examples: [
    {
      description: "Get all diagnostics from all open files",
      input: {}
    },
    {
      description: "Get diagnostics for a specific file",
      input: {
        uri: "file:///home/user/project/scripts/player.gd"
      }
    }
  ]
};

// LSP Code Intelligence - Navigation
const lspGetSymbolInfoTool = {
  name: "godot_lsp_get_symbol_info",
  description: "[LSP/Language Server] Get documentation, type information, and usage details for a symbol (function, class, variable) at a cursor position. Equivalent to hovering in an IDE.",
  category: "lsp-code-intelligence",
  protocol: "lsp",
  tags: ["hover", "symbol", "documentation", "type", "info", "definition"],
  visibility: "deferred",
  dependencies: ["godot_lsp_connect"],
  inputSchema: {
    type: "object",
    properties: {
      uri: {
        type: "string",
        description: "File URI (e.g., 'file:///path/to/file.gd')"
      },
      line: {
        type: "number",
        description: "Line number where the symbol is (0-indexed, first line is 0)"
      },
      character: {
        type: "number",
        description: "Character position in the line (0-indexed, first character is 0)"
      }
    },
    required: ["uri", "line", "character"]
  },
  examples: [
    {
      description: "Get information about a function call",
      input: {
        uri: "file:///home/user/project/scripts/main.gd",
        line: 15,
        character: 5
      }
    }
  ]
};

const lspFindDefinitionTool = {
  name: "godot_lsp_find_definition",
  description: "[LSP/Language Server] Find where a symbol (function, class, variable) is defined. Returns the file location and line number of the definition.",
  category: "lsp-code-intelligence",
  protocol: "lsp",
  tags: ["definition", "navigation", "goto", "find", "symbol", "reference"],
  visibility: "deferred",
  dependencies: ["godot_lsp_connect"],
  inputSchema: {
    type: "object",
    properties: {
      uri: {
        type: "string",
        description: "File URI where the symbol reference is (e.g., 'file:///path/to/file.gd')"
      },
      line: {
        type: "number",
        description: "Line number of the symbol reference (0-indexed)"
      },
      character: {
        type: "number",
        description: "Character position of the symbol reference (0-indexed)"
      }
    },
    required: ["uri", "line", "character"]
  },
  examples: [
    {
      description: "Find definition of a function call",
      input: {
        uri: "file:///home/user/project/scripts/main.gd",
        line: 15,
        character: 8
      }
    }
  ]
};

// LSP Code Intelligence - Completion
const lspAutocompleteTool = {
  name: "godot_lsp_autocomplete",
  description: "[LSP/Language Server] Get code completion suggestions at a cursor position. Returns available methods, properties, classes, and keywords that can be used at that location.",
  category: "lsp-code-intelligence",
  protocol: "lsp",
  tags: ["autocomplete", "completion", "suggestions", "intellisense", "help"],
  visibility: "deferred",
  dependencies: ["godot_lsp_connect"],
  inputSchema: {
    type: "object",
    properties: {
      uri: {
        type: "string",
        description: "File URI (e.g., 'file:///path/to/file.gd')"
      },
      line: {
        type: "number",
        description: "Line number for completion (0-indexed)"
      },
      character: {
        type: "number",
        description: "Character position for completion (0-indexed)"
      }
    },
    required: ["uri", "line", "character"]
  },
  examples: [
    {
      description: "Get completions for object property access after dot operator",
      input: {
        uri: "file:///home/user/project/scripts/player.gd",
        line: 25,
        character: 18
      }
    }
  ]
};

// LSP Code Intelligence - Symbols
const lspListSymbolsTool = {
  name: "godot_lsp_list_symbols",
  description: "[LSP/Language Server] List all symbols (functions, classes, variables, signals, etc.) defined in a GDScript file. Useful for understanding file structure.",
  category: "lsp-code-intelligence",
  protocol: "lsp",
  tags: ["symbols", "list", "structure", "outline", "file"],
  visibility: "deferred",
  dependencies: ["godot_lsp_connect"],
  inputSchema: {
    type: "object",
    properties: {
      uri: {
        type: "string",
        description: "File URI to get symbols from (e.g., 'file:///path/to/file.gd')"
      }
    },
    required: ["uri"]
  }
};

const lspSearchSymbolsTool = {
  name: "godot_lsp_search_symbols",
  description: "[LSP/Language Server] Search for symbols (functions, classes, variables) across the entire Godot project by name. Returns matching symbols with their locations.",
  category: "lsp-code-intelligence",
  protocol: "lsp",
  tags: ["symbols", "search", "find", "workspace", "project"],
  visibility: "deferred",
  dependencies: ["godot_lsp_connect"],
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query for symbol names (e.g., 'Player', 'get_health'). Empty string returns all symbols.",
        default: ""
      }
    }
  }
};

// godot_dap_attach removed (merged into connect)

const dapConfigurationDoneTool = {
  name: "godot_dap_configuration_done",
  description: `This is a tool from the godot MCP server.
[DAP/Debugger] Signal that configuration (breakpoints) is done. Required to statrt receiving 'stopped' events.`,
  inputSchema: {
    type: "object",
    properties: {
      instance_id: {
        type: "string",
        description: "Optional: ID of the Godot instance to target (default: active instance)"
      }
    }
  }
};

const debuggerSessionsTool = {
  name: "godot_debugger_sessions",
  description: `This is a tool from the godot MCP server.
Get information about active debugger sessions via Editor Bridge (alternative to DAP). Returns session ID, paused state, and debug capabilities.`,
  inputSchema: {
    type: "object",
    properties: {
      instance_id: {
        type: "string",
        description: "Optional: ID of the Godot instance to target (default: active instance)"
      }
    }
  }
};

const debuggerResumeTool = {
  name: "godot_debugger_resume",
  description: `This is a tool from the godot MCP server.
Resume execution of a paused debugger session via Editor Bridge.`,
  inputSchema: {
    type: "object",
    properties: {
      instance_id: { type: "string" },
      session_id: { type: "integer", default: 0 }
    }
  }
};

const debuggerStepOverTool = {
  name: "godot_debugger_step_over",
  description: `This is a tool from the godot MCP server.
Step over the current line in a paused debugger session via Editor Bridge.`,
  inputSchema: {
    type: "object",
    properties: {
      instance_id: { type: "string" },
      session_id: { type: "integer", default: 0 }
    }
  }
};

// Export all tools
export const allTools = [
  dapConnectTool,
  dapDisconnectTool,
  dapConfigurationDoneTool,
  lspConnectTool,
  lspDisconnectTool,
  dapSetBreakpointTool,
  dapClearBreakpointsTool,
  debuggerSessionsTool,
  debuggerResumeTool,
  debuggerStepOverTool,
  lspGetErrorsTool,
  lspGetSymbolInfoTool,
  lspFindDefinitionTool,
  lspAutocompleteTool,
  lspListSymbolsTool,
  lspSearchSymbolsTool
];

export const connectionTools = [
  dapConnectTool,
  dapDisconnectTool,
  dapConfigurationDoneTool,
  lspConnectTool,
  lspDisconnectTool
];

export const dapTools = [
  dapSetBreakpointTool,
  dapClearBreakpointsTool,
  dapConfigurationDoneTool,
  debuggerSessionsTool,
  debuggerResumeTool,
  debuggerStepOverTool
];

export const lspTools = [
  lspGetErrorsTool,
  lspGetSymbolInfoTool,
  lspFindDefinitionTool,
  lspAutocompleteTool,
  lspListSymbolsTool,
  lspSearchSymbolsTool
];



export const alwaysVisibleTools = [
  ...connectionTools
];

export const deferredTools = [
  ...dapTools,
  ...lspTools
];

// Helper function to get tool by name
export function getToolByName(name) {
  return allTools.find(tool => tool.name === name);
}

// Helper function to get all tools as MCP-compatible tool definitions
export function getToolDefinitions(includeDeferred = true) {
  if (includeDeferred) {
    return allTools;
  } else {
    return alwaysVisibleTools;
  }
}
