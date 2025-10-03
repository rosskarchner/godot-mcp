#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DAPClient } from './dap-client.js';

/**
 * Godot MCP Server
 * Connects to Godot's Debug Adapter Protocol port for debugging and performance monitoring
 */

const DEBUG_PORT = parseInt(process.env.GODOT_DEBUG_PORT || '6006');
const DEBUG_HOST = process.env.GODOT_DEBUG_HOST || '127.0.0.1';

// Global DAP client instance
let dapClient = null;

/**
 * Ensure DAP client is connected
 */
async function ensureConnection() {
  if (!dapClient) {
    dapClient = new DAPClient(DEBUG_HOST, DEBUG_PORT);
    await dapClient.connect();
  } else if (!dapClient.isConnected()) {
    await dapClient.connect();
  }
  return dapClient;
}

/**
 * Tool definitions
 */
const tools = [
  {
    name: "connect_debugger",
    description: "Connect to the Godot debug port. This must be called before other debugging operations.",
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
          description: "The port number of the Godot debug port (default: 6006 for editor, 6007 for game)",
          default: 6006
        }
      }
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
    description: "Set a breakpoint in a source file at a specific line number",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Path to the source file (e.g., 'res://scripts/player.gd')"
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
  {
    name: "disconnect_debugger",
    description: "Disconnect from the Godot debug port",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "godot-mcp-server",
    version: "1.0.0",
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
        const client = await ensureConnection();
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
        const client = await ensureConnection();
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
        const client = await ensureConnection();
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
        const client = await ensureConnection();
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
        const client = await ensureConnection();
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
        const client = await ensureConnection();
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
        const client = await ensureConnection();
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
        const client = await ensureConnection();
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
        const client = await ensureConnection();
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
        const client = await ensureConnection();
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
        const client = await ensureConnection();
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
        const client = await ensureConnection();
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
