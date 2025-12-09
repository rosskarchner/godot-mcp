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
const dapListThreadsTool = {
  name: "godot_dap_list_threads",
  description: "[DAP/Debugger] List all running threads in the Godot game during runtime debugging. Use this to identify which thread to debug when setting breakpoints or stepping through code.",
  category: "dap-debugging",
  protocol: "dap",
  tags: ["threads", "debug", "state", "inspect"],
  visibility: "deferred",
  dependencies: ["godot_dap_connect"],
  inputSchema: {
    type: "object",
    properties: {}
  }
};

const dapGetStacktraceTool = {
  name: "godot_dap_get_stacktrace",
  description: "[DAP/Debugger] Get the current call stack for a thread during runtime debugging, showing which functions are executing and their file locations. Essential for understanding program flow and getting file paths for breakpoints.",
  category: "dap-debugging",
  protocol: "dap",
  tags: ["stacktrace", "stack", "debug", "inspect", "state", "frames"],
  visibility: "deferred",
  dependencies: ["godot_dap_connect", "godot_dap_list_threads"],
  inputSchema: {
    type: "object",
    properties: {
      threadId: {
        type: "number",
        description: "The thread ID to get the stack trace for (obtain from godot_dap_list_threads)"
      }
    },
    required: ["threadId"]
  },
  examples: [
    {
      description: "Get stack trace for the main thread (common thread ID)",
      input: {
        threadId: 1
      }
    },
    {
      description: "Get stack trace to understand current execution point and get filesystem paths for breakpoints",
      input: {
        threadId: 1
      },
      note: "The returned stack frames contain source.path (filesystem paths) needed for godot_dap_set_breakpoint"
    }
  ]
};

const dapGetScopesTool = {
  name: "godot_dap_get_scopes",
  description: "[DAP/Debugger] Get available variable scopes (local, global, etc.) for a stack frame during runtime debugging. Use this to find the variablesReference needed to inspect variables.",
  category: "dap-debugging",
  protocol: "dap",
  tags: ["scopes", "variables", "inspect", "locals", "globals"],
  visibility: "deferred",
  dependencies: ["godot_dap_get_stacktrace"],
  inputSchema: {
    type: "object",
    properties: {
      frameId: {
        type: "number",
        description: "The stack frame ID from godot_dap_get_stacktrace"
      }
    },
    required: ["frameId"]
  }
};

const dapInspectVariablesTool = {
  name: "godot_dap_inspect_variables",
  description: "[DAP/Debugger] Inspect variables in a specific scope (local, global, etc.) during runtime debugging. Shows variable names, values, and types. Use the variablesReference from godot_dap_get_scopes.",
  category: "dap-debugging",
  protocol: "dap",
  tags: ["variables", "inspect", "values", "types", "locals", "globals"],
  visibility: "deferred",
  dependencies: ["godot_dap_get_scopes"],
  inputSchema: {
    type: "object",
    properties: {
      variablesReference: {
        type: "number",
        description: "The variables reference ID from godot_dap_get_scopes or from a parent variable with children"
      }
    },
    required: ["variablesReference"]
  },
  examples: [
    {
      description: "Inspect local scope variables from godot_dap_get_scopes",
      input: {
        variablesReference: 1
      }
    },
    {
      description: "Inspect nested object properties (variablesReference from parent variable)",
      input: {
        variablesReference: 42
      },
      note: "variablesReference comes from inspecting parent variable's children"
    }
  ]
};

// DAP Debugging - Breakpoints
const dapSetBreakpointTool = {
  name: "godot_dap_set_breakpoint",
  description: "[DAP/Debugger] Set a breakpoint at a specific line in a GDScript file. Execution will pause when this line is reached during runtime debugging. IMPORTANT: Use full filesystem paths (from godot_dap_get_stacktrace), NOT res:// paths.",
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
        description: "Full filesystem path to the GDScript file (e.g., '/home/user/project/scripts/player.gd'). Get correct paths from godot_dap_get_stacktrace."
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
    },
    {
      description: "Conditional breakpoint that breaks when player health is critical",
      input: {
        source: "/home/user/godot-project/scripts/player.gd",
        line: 42,
        condition: "health <= 10"
      },
      note: "Condition uses GDScript syntax; breakpoint only pauses when condition is true"
    },
    {
      description: "Conditional breakpoint with complex expression",
      input: {
        source: "/home/user/godot-project/scripts/enemy.gd",
        line: 89,
        condition: "state == 'attacking' and target != null"
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

// DAP Debugging - Execution Control
const dapPauseTool = {
  name: "godot_dap_pause",
  description: "[DAP/Debugger] Pause execution of the running Godot game immediately during runtime debugging. Use this to freeze the game and inspect its current state.",
  category: "dap-debugging",
  protocol: "dap",
  tags: ["pause", "freeze", "execution", "control", "stop"],
  visibility: "deferred",
  dependencies: ["godot_dap_connect"],
  inputSchema: {
    type: "object",
    properties: {
      threadId: {
        type: "number",
        description: "Optional: specific thread ID to pause (if not specified, pauses all threads)"
      }
    }
  }
};

const dapContinueTool = {
  name: "godot_dap_continue",
  description: "[DAP/Debugger] Resume execution after the game has been paused (by breakpoint or manual pause) during runtime debugging. The game will run until the next breakpoint or pause.",
  category: "dap-debugging",
  protocol: "dap",
  tags: ["continue", "resume", "execution", "control", "run"],
  visibility: "deferred",
  dependencies: ["godot_dap_connect"],
  inputSchema: {
    type: "object",
    properties: {
      threadId: {
        type: "number",
        description: "The thread ID to resume execution (from godot_dap_list_threads)"
      }
    },
    required: ["threadId"]
  }
};

const dapStepOverTool = {
  name: "godot_dap_step_over",
  description: "[DAP/Debugger] Execute the current line and move to the next line during runtime debugging, stepping OVER any function calls (don't enter them). Use for quick debugging without diving into functions.",
  category: "dap-debugging",
  protocol: "dap",
  tags: ["step", "stepping", "step-over", "next", "execution", "control"],
  visibility: "deferred",
  dependencies: ["godot_dap_connect"],
  inputSchema: {
    type: "object",
    properties: {
      threadId: {
        type: "number",
        description: "The thread ID to step (from godot_dap_list_threads)"
      }
    },
    required: ["threadId"]
  }
};

const dapStepIntoTool = {
  name: "godot_dap_step_into",
  description: "[DAP/Debugger] Execute the current line and step INTO any function calls during runtime debugging to debug them line-by-line. Use when you want to examine what happens inside a function.",
  category: "dap-debugging",
  protocol: "dap",
  tags: ["step", "stepping", "step-into", "function", "execution", "control"],
  visibility: "deferred",
  dependencies: ["godot_dap_connect"],
  inputSchema: {
    type: "object",
    properties: {
      threadId: {
        type: "number",
        description: "The thread ID to step (from godot_dap_list_threads)"
      }
    },
    required: ["threadId"]
  }
};

const dapStepOutTool = {
  name: "godot_dap_step_out",
  description: "[DAP/Debugger] Complete execution of the current function and return to the caller during runtime debugging. Use to quickly exit a function you've stepped into.",
  category: "dap-debugging",
  protocol: "dap",
  tags: ["step", "stepping", "step-out", "return", "execution", "control"],
  visibility: "deferred",
  dependencies: ["godot_dap_connect"],
  inputSchema: {
    type: "object",
    properties: {
      threadId: {
        type: "number",
        description: "The thread ID to step out (from godot_dap_list_threads)"
      }
    },
    required: ["threadId"]
  }
};

// LSP Code Intelligence - Diagnostics
const lspGetErrorsTool = {
  name: "godot_lsp_get_errors",
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
      },
      note: "Character position should be within the symbol name"
    },
    {
      description: "Get information about a class property",
      input: {
        uri: "file:///home/user/project/scripts/player.gd",
        line: 42,
        character: 12
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
    },
    {
      description: "Find definition of a class property",
      input: {
        uri: "file:///home/user/project/scripts/player.gd",
        line: 42,
        character: 12
      },
      note: "Character position must be within the symbol name for accurate definition lookup"
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
      },
      context: "position.| <- cursor position at character 18"
    },
    {
      description: "Get completions while typing method name",
      input: {
        uri: "file:///home/user/project/scripts/player.gd",
        line: 30,
        character: 9
      },
      context: "func get_| <- cursor in middle of typing, returns completions for 'get' prefix"
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

// Export all tools
export const allTools = [
  dapConnectTool,
  dapDisconnectTool,
  lspConnectTool,
  lspDisconnectTool,
  dapListThreadsTool,
  dapGetStacktraceTool,
  dapGetScopesTool,
  dapInspectVariablesTool,
  dapSetBreakpointTool,
  dapClearBreakpointsTool,
  dapPauseTool,
  dapContinueTool,
  dapStepOverTool,
  dapStepIntoTool,
  dapStepOutTool,
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
  lspConnectTool,
  lspDisconnectTool
];

export const dapTools = [
  dapListThreadsTool,
  dapGetStacktraceTool,
  dapGetScopesTool,
  dapInspectVariablesTool,
  dapSetBreakpointTool,
  dapClearBreakpointsTool,
  dapPauseTool,
  dapContinueTool,
  dapStepOverTool,
  dapStepIntoTool,
  dapStepOutTool
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
