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
    name: "connect_debugger",
    description: "Connect to the Godot debug port (DAP). This must be called before other debugging operations.",
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
    name: "disconnect_debugger",
    description: "Disconnect from the Godot debug port",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  // LSP Connection Management
  {
    name: "connect_lsp",
    description: "Connect to the Godot Language Server Protocol (LSP) port for code intelligence features.",
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
    name: "disconnect_lsp",
    description: "Disconnect from the Godot LSP port",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_threads",
    description: "Get list of all threads in the running Godot instance",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_stack_trace",
    description: "Get the stack trace for a specific thread. Useful for understanding the current execution state.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "number",
          description: "The thread ID to get the stack trace for"
        }
      },
      required: ["threadId"]
    }
  },
  {
    name: "get_scopes",
    description: "Get variable scopes (local, global, etc.) for a specific stack frame",
    inputSchema: {
      type: "object",
      properties: {
        frameId: {
          type: "number",
          description: "The stack frame ID to get scopes for"
        }
      },
      required: ["frameId"]
    }
  },
  {
    name: "get_variables",
    description: "Get variables in a specific scope. Use this to inspect local variables, globals, etc.",
    inputSchema: {
      type: "object",
      properties: {
        variablesReference: {
          type: "number",
          description: "The variables reference from a scope or parent variable"
        }
      },
      required: ["variablesReference"]
    }
  },
  {
    name: "evaluate_expression",
    description: "Evaluate a GDScript expression in the context of the running game. Useful for inspecting state or testing code.",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "The GDScript expression to evaluate"
        },
        frameId: {
          type: "number",
          description: "Optional frame ID to evaluate in context of a specific stack frame"
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
    name: "set_breakpoint",
    description: "Set a breakpoint in a source file at a specific line number. Note: Requires full filesystem path, not res:// format. Get the correct path from stack traces.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Full filesystem path to the source file (e.g., '/home/user/project/scripts/player.gd'). Use get_stack_trace to obtain correct paths."
        },
        line: {
          type: "number",
          description: "Line number to set the breakpoint (1-indexed)"
        },
        condition: {
          type: "string",
          description: "Optional condition expression for conditional breakpoint"
        }
      },
      required: ["source", "line"]
    }
  },
  {
    name: "remove_breakpoints",
    description: "Remove all breakpoints from a source file",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Path to the source file to remove breakpoints from"
        }
      },
      required: ["source"]
    }
  },
  {
    name: "pause_execution",
    description: "Pause the execution of the running Godot game",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "number",
          description: "Optional thread ID to pause (if not specified, pauses all threads)"
        }
      }
    }
  },
  {
    name: "continue_execution",
    description: "Continue execution after a pause or breakpoint",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "number",
          description: "The thread ID to continue"
        }
      },
      required: ["threadId"]
    }
  },
  {
    name: "step_over",
    description: "Step over the current line (execute the line but don't step into function calls)",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "number",
          description: "The thread ID to step"
        }
      },
      required: ["threadId"]
    }
  },
  {
    name: "step_into",
    description: "Step into the next function call",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "number",
          description: "The thread ID to step"
        }
      },
      required: ["threadId"]
    }
  },
  {
    name: "step_out",
    description: "Step out of the current function",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "number",
          description: "The thread ID to step"
        }
      },
      required: ["threadId"]
    }
  },
  // LSP Tools
  {
    name: "lsp_get_diagnostics",
    description: "Get all diagnostics (errors and warnings) for a file or the entire workspace. Diagnostics are collected from LSP notifications.",
    inputSchema: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description: "File URI (e.g., 'file:///path/to/file.gd'). If omitted, returns diagnostics for all files."
        }
      }
    }
  },
  {
    name: "lsp_hover",
    description: "Get hover information (documentation, type signatures) for a symbol at a specific position in a file.",
    inputSchema: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description: "File URI (e.g., 'file:///path/to/file.gd')"
        },
        line: {
          type: "number",
          description: "Line number (0-indexed)"
        },
        character: {
          type: "number",
          description: "Character position in the line (0-indexed)"
        }
      },
      required: ["uri", "line", "character"]
    }
  },
  {
    name: "lsp_goto_definition",
    description: "Get the definition location of a symbol at a specific position.",
    inputSchema: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description: "File URI (e.g., 'file:///path/to/file.gd')"
        },
        line: {
          type: "number",
          description: "Line number (0-indexed)"
        },
        character: {
          type: "number",
          description: "Character position in the line (0-indexed)"
        }
      },
      required: ["uri", "line", "character"]
    }
  },
  {
    name: "lsp_completion",
    description: "Get code completion suggestions at a specific position in a file.",
    inputSchema: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description: "File URI (e.g., 'file:///path/to/file.gd')"
        },
        line: {
          type: "number",
          description: "Line number (0-indexed)"
        },
        character: {
          type: "number",
          description: "Character position in the line (0-indexed)"
        }
      },
      required: ["uri", "line", "character"]
    }
  },
  {
    name: "lsp_document_symbols",
    description: "Get all symbols (functions, classes, variables, etc.) defined in a document.",
    inputSchema: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description: "File URI (e.g., 'file:///path/to/file.gd')"
        }
      },
      required: ["uri"]
    }
  },
  {
    name: "lsp_workspace_symbols",
    description: "Search for symbols across the entire workspace by name.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for symbol names (e.g., 'Player', 'get_health')",
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
      case "connect_debugger": {
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

      case "get_threads": {
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

      case "get_stack_trace": {
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

      case "get_scopes": {
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

      case "get_variables": {
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

      case "evaluate_expression": {
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

      case "set_breakpoint": {
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

      case "remove_breakpoints": {
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

      case "pause_execution": {
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

      case "continue_execution": {
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

      case "step_over": {
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

      case "step_into": {
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

      case "step_out": {
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
      case "connect_lsp": {
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

      case "disconnect_lsp": {
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

      case "lsp_get_diagnostics": {
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

      case "lsp_hover": {
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

      case "lsp_goto_definition": {
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

      case "lsp_completion": {
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

      case "lsp_document_symbols": {
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

      case "lsp_workspace_symbols": {
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

      case "disconnect_debugger": {
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
