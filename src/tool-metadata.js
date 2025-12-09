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
  description: "Connect to DAP for runtime debugging (breakpoints, stepping). Call before setting breakpoints.",
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

// dapDisconnectTool removed (cleanup happens via terminate)

// LSP Connection Management Tools
const lspConnectTool = {
  name: "godot_lsp_connect",
  description: "Connect to LSP for code intelligence (autocomplete, diagnostics, go-to-definition).",
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

// lspDisconnectTool removed (cleanup happens via terminate)

// DAP Debugging - State Inspection
// DAP Debugging - State Inspection (Removed unreliable DAP inspection tools in favor of Editor Bridge)
// The following tools were removed: list_threads, get_stacktrace, get_scopes, inspect_variables

// DAP Debugging - Breakpoints
const dapSetBreakpointTool = {
  name: "godot_dap_set_breakpoint",
  description: "Set a breakpoint at a line. Use full filesystem paths, not res:// paths.",
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
  description: "Remove all breakpoints from a GDScript file.",
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
  description: "Get syntax errors and warnings for GDScript files.",
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
  description: "Get documentation and type info for a symbol at cursor position.",
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
  description: "Find where a symbol is defined. Returns file location and line number.",
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
  description: "Get code completion suggestions at cursor position.",
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
  description: "List all symbols (functions, classes, variables) in a file.",
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
  description: "Search for symbols across the project by name.",
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
  description: "Signal that breakpoint configuration is done. Required before receiving stop events.",
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
  description: "Get active debugger sessions. Returns paused state and session info.",
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
  description: "Resume execution of a paused debugger session.",
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
  description: "Step over the current line in a paused session.",
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
  dapConfigurationDoneTool,
  lspConnectTool,
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
  dapConfigurationDoneTool,
  lspConnectTool
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
