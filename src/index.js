#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DAPClient } from './dap-client.js';
import { LSPClient } from './lsp-client.js';

/**
 * Godot MCP Server
 * Connects to Godot's Debug Adapter Protocol (DAP) and Language Server Protocol (LSP) ports
 * for debugging, code intelligence, and performance monitoring
 */

const DEBUG_PORT = parseInt(process.env.GODOT_DEBUG_PORT || '6006');
const DEBUG_HOST = process.env.GODOT_DEBUG_HOST || '127.0.0.1';
const LSP_PORT = parseInt(process.env.GODOT_LSP_PORT || '6005');
const LSP_HOST = process.env.GODOT_LSP_HOST || '127.0.0.1';

// Global client instances
let dapClient = null;
let lspClient = null;
const diagnosticsCache = new Map(); // Cache for diagnostics by URI

/**
 * Ensure DAP client is connected
 */
async function ensureDAPConnection() {
  if (!dapClient) {
    dapClient = new DAPClient(DEBUG_HOST, DEBUG_PORT);
    await dapClient.connect();
  } else if (!dapClient.isConnected()) {
    await dapClient.connect();
  }
  return dapClient;
}

/**
 * Ensure LSP client is connected
 */
async function ensureLSPConnection() {
  if (!lspClient) {
    lspClient = new LSPClient(LSP_HOST, LSP_PORT);
    
    // Listen for diagnostic notifications
    lspClient.on('notification', (message) => {
      if (message.method === 'textDocument/publishDiagnostics') {
        const uri = message.params.uri;
        const diagnostics = message.params.diagnostics;
        diagnosticsCache.set(uri, diagnostics);
      }
    });
    
    await lspClient.connect();
  } else if (!lspClient.isConnected()) {
    await lspClient.connect();
  }
  return lspClient;
}

/**
 * Tool definitions
 */
const tools = [
  // DAP Connection Management
  {
    name: "godot_debug_connect",
    description: "Connect to Godot's debugger (DAP) to enable debugging operations like breakpoints, stepping, and variable inspection. Must be called before using any debug tools.",
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
  },
  {
    name: "godot_debug_disconnect",
    description: "Disconnect from Godot's debugger and clean up the debug session",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  // LSP Connection Management
  {
    name: "godot_lsp_connect",
    description: "Connect to Godot's Language Server to enable code intelligence features like autocomplete, diagnostics, go-to-definition, and symbol search.",
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
  },
  {
    name: "godot_lsp_disconnect",
    description: "Disconnect from Godot's Language Server and clear cached diagnostics",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "godot_debug_list_threads",
    description: "List all running threads in the Godot game. Use this to identify which thread to debug when setting breakpoints or stepping through code.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "godot_debug_get_stacktrace",
    description: "Get the current call stack for a thread, showing which functions are executing and their file locations. Essential for understanding program flow and getting file paths for breakpoints.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "number",
          description: "The thread ID to get the stack trace for (obtain from godot_debug_list_threads)"
        }
      },
      required: ["threadId"]
    }
  },
  {
    name: "godot_debug_get_scopes",
    description: "Get available variable scopes (local, global, etc.) for a stack frame. Use this to find the variablesReference needed to inspect variables.",
    inputSchema: {
      type: "object",
      properties: {
        frameId: {
          type: "number",
          description: "The stack frame ID from godot_debug_get_stacktrace"
        }
      },
      required: ["frameId"]
    }
  },
  {
    name: "godot_debug_inspect_variables",
    description: "Inspect variables in a specific scope (local, global, etc.). Shows variable names, values, and types. Use the variablesReference from godot_debug_get_scopes.",
    inputSchema: {
      type: "object",
      properties: {
        variablesReference: {
          type: "number",
          description: "The variables reference ID from godot_debug_get_scopes or from a parent variable with children"
        }
      },
      required: ["variablesReference"]
    }
  },
  {
    name: "godot_debug_evaluate",
    description: "Execute a GDScript expression in the running game and get the result. Perfect for testing code, checking object states, or calling functions during debugging.",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "The GDScript expression to evaluate (e.g., 'player.health', 'get_node(\"Player\").position')"
        },
        frameId: {
          type: "number",
          description: "Optional: frame ID to evaluate in a specific stack frame context (from godot_debug_get_stacktrace)"
        },
        context: {
          type: "string",
          description: "Evaluation context: 'watch', 'repl', 'hover', or 'clipboard'",
          default: "repl"
        }
      },
      required: ["expression"]
    }
  },
  {
    name: "godot_debug_set_breakpoint",
    description: "Set a breakpoint at a specific line in a GDScript file. Execution will pause when this line is reached. IMPORTANT: Use full filesystem paths (from godot_debug_get_stacktrace), NOT res:// paths.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Full filesystem path to the GDScript file (e.g., '/home/user/project/scripts/player.gd'). Get correct paths from godot_debug_get_stacktrace."
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
    }
  },
  {
    name: "godot_debug_clear_breakpoints",
    description: "Remove all breakpoints from a specific GDScript file",
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
  },
  {
    name: "godot_debug_pause",
    description: "Pause execution of the running Godot game immediately. Use this to freeze the game and inspect its current state.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "number",
          description: "Optional: specific thread ID to pause (if not specified, pauses all threads)"
        }
      }
    }
  },
  {
    name: "godot_debug_continue",
    description: "Resume execution after the game has been paused (by breakpoint or manual pause). The game will run until the next breakpoint or pause.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "number",
          description: "The thread ID to resume execution (from godot_debug_list_threads)"
        }
      },
      required: ["threadId"]
    }
  },
  {
    name: "godot_debug_step_over",
    description: "Execute the current line and move to the next line, stepping OVER any function calls (don't enter them). Use for quick debugging without diving into functions.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "number",
          description: "The thread ID to step (from godot_debug_list_threads)"
        }
      },
      required: ["threadId"]
    }
  },
  {
    name: "godot_debug_step_into",
    description: "Execute the current line and step INTO any function calls to debug them line-by-line. Use when you want to examine what happens inside a function.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "number",
          description: "The thread ID to step (from godot_debug_list_threads)"
        }
      },
      required: ["threadId"]
    }
  },
  {
    name: "godot_debug_step_out",
    description: "Complete execution of the current function and return to the caller. Use to quickly exit a function you've stepped into.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "number",
          description: "The thread ID to step out (from godot_debug_list_threads)"
        }
      },
      required: ["threadId"]
    }
  },
  // LSP Tools
  {
    name: "godot_lsp_get_errors",
    description: "Get syntax errors, type errors, and warnings for GDScript files. Returns diagnostics for a specific file or all open files. Use this to find and fix code issues.",
    inputSchema: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description: "Optional: file URI to get diagnostics for (e.g., 'file:///path/to/file.gd'). If omitted, returns all diagnostics."
        }
      }
    }
  },
  {
    name: "godot_lsp_get_symbol_info",
    description: "Get documentation, type information, and usage details for a symbol (function, class, variable) at a cursor position. Equivalent to hovering in an IDE.",
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
    }
  },
  {
    name: "godot_lsp_find_definition",
    description: "Find where a symbol (function, class, variable) is defined. Returns the file location and line number of the definition.",
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
    }
  },
  {
    name: "godot_lsp_autocomplete",
    description: "Get code completion suggestions at a cursor position. Returns available methods, properties, classes, and keywords that can be used at that location.",
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
    }
  },
  {
    name: "godot_lsp_list_symbols",
    description: "List all symbols (functions, classes, variables, signals, etc.) defined in a GDScript file. Useful for understanding file structure.",
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
  },
  {
    name: "godot_lsp_search_symbols",
    description: "Search for symbols (functions, classes, variables) across the entire Godot project by name. Returns matching symbols with their locations.",
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
  }
];

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "godot-mcp-server",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "godot_debug_connect": {
        const host = args.host || DEBUG_HOST;
        const port = args.port || DEBUG_PORT;

        if (dapClient) {
          dapClient.disconnect();
        }

        dapClient = new DAPClient(host, port);
        await dapClient.connect();

        return {
          content: [
            {
              type: "text",
              text: `Successfully connected to Godot debug port at ${host}:${port}`
            }
          ]
        };
      }

      case "godot_debug_list_threads": {
        const client = await ensureDAPConnection();
        const response = await client.sendRequest('threads');
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case "godot_debug_get_stacktrace": {
        const client = await ensureDAPConnection();
        const response = await client.sendRequest('stackTrace', {
          threadId: args.threadId
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case "godot_debug_get_scopes": {
        const client = await ensureDAPConnection();
        const response = await client.sendRequest('scopes', {
          frameId: args.frameId
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case "godot_debug_inspect_variables": {
        const client = await ensureDAPConnection();
        const response = await client.sendRequest('variables', {
          variablesReference: args.variablesReference
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case "godot_debug_evaluate": {
        const client = await ensureDAPConnection();
        const evalArgs = {
          expression: args.expression,
          context: args.context || 'repl'
        };
        if (args.frameId !== undefined) {
          evalArgs.frameId = args.frameId;
        }
        const response = await client.sendRequest('evaluate', evalArgs);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case "godot_debug_set_breakpoint": {
        const client = await ensureDAPConnection();
        const breakpoint = {
          line: args.line
        };
        if (args.condition) {
          breakpoint.condition = args.condition;
        }
        const response = await client.sendRequest('setBreakpoints', {
          source: { path: args.source },
          breakpoints: [breakpoint]
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case "godot_debug_clear_breakpoints": {
        const client = await ensureDAPConnection();
        const response = await client.sendRequest('setBreakpoints', {
          source: { path: args.source },
          breakpoints: []
        });
        return {
          content: [
            {
              type: "text",
              text: `Removed all breakpoints from ${args.source}`
            }
          ]
        };
      }

      case "godot_debug_pause": {
        const client = await ensureDAPConnection();
        const pauseArgs = {};
        if (args.threadId !== undefined) {
          pauseArgs.threadId = args.threadId;
        }
        const response = await client.sendRequest('pause', pauseArgs);
        return {
          content: [
            {
              type: "text",
              text: "Execution paused"
            }
          ]
        };
      }

      case "godot_debug_continue": {
        const client = await ensureDAPConnection();
        const response = await client.sendRequest('continue', {
          threadId: args.threadId
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case "godot_debug_step_over": {
        const client = await ensureDAPConnection();
        const response = await client.sendRequest('next', {
          threadId: args.threadId
        });
        return {
          content: [
            {
              type: "text",
              text: "Stepped over"
            }
          ]
        };
      }

      case "godot_debug_step_into": {
        const client = await ensureDAPConnection();
        const response = await client.sendRequest('stepIn', {
          threadId: args.threadId
        });
        return {
          content: [
            {
              type: "text",
              text: "Stepped into"
            }
          ]
        };
      }

      case "godot_debug_step_out": {
        const client = await ensureDAPConnection();
        const response = await client.sendRequest('stepOut', {
          threadId: args.threadId
        });
        return {
          content: [
            {
              type: "text",
              text: "Stepped out"
            }
          ]
        };
      }

      // LSP Tools
      case "godot_lsp_connect": {
        const host = args.host || LSP_HOST;
        const port = args.port || LSP_PORT;

        if (lspClient) {
          lspClient.disconnect();
        }

        lspClient = new LSPClient(host, port);

        // Listen for diagnostic notifications
        lspClient.on('notification', (message) => {
          if (message.method === 'textDocument/publishDiagnostics') {
            const uri = message.params.uri;
            const diagnostics = message.params.diagnostics;
            diagnosticsCache.set(uri, diagnostics);
          }
        });

        await lspClient.connect();

        return {
          content: [
            {
              type: "text",
              text: `Successfully connected to Godot LSP port at ${host}:${port}`
            }
          ]
        };
      }

      case "godot_lsp_disconnect": {
        if (lspClient) {
          lspClient.disconnect();
          lspClient = null;
          diagnosticsCache.clear();
        }
        return {
          content: [
            {
              type: "text",
              text: "Disconnected from Godot LSP port"
            }
          ]
        };
      }

      case "godot_lsp_get_errors": {
        await ensureLSPConnection();

        if (args.uri) {
          // Get diagnostics for specific file
          const diagnostics = diagnosticsCache.get(args.uri) || [];
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ uri: args.uri, diagnostics }, null, 2)
              }
            ]
          };
        } else {
          // Get diagnostics for all files
          const allDiagnostics = {};
          for (const [uri, diagnostics] of diagnosticsCache.entries()) {
            allDiagnostics[uri] = diagnostics;
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(allDiagnostics, null, 2)
              }
            ]
          };
        }
      }

      case "godot_lsp_get_symbol_info": {
        const client = await ensureLSPConnection();
        const response = await client.hover(args.uri, args.line, args.character);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case "godot_lsp_find_definition": {
        const client = await ensureLSPConnection();
        const response = await client.definition(args.uri, args.line, args.character);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case "godot_lsp_autocomplete": {
        const client = await ensureLSPConnection();
        const response = await client.completion(args.uri, args.line, args.character);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case "godot_lsp_list_symbols": {
        const client = await ensureLSPConnection();
        const response = await client.documentSymbols(args.uri);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case "godot_lsp_search_symbols": {
        const client = await ensureLSPConnection();
        const response = await client.workspaceSymbols(args.query || '');
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case "godot_debug_disconnect": {
        if (dapClient) {
          dapClient.disconnect();
          dapClient = null;
        }
        return {
          content: [
            {
              type: "text",
              text: "Disconnected from Godot debug port"
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Godot MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
