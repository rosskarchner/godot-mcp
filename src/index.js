#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DAPClient } from './dap-client.js';
import { LSPClient } from './lsp-client.js';
import { allTools, getToolByName, getToolDefinitions } from './tool-metadata.js';
import { searchTools } from './tool-search.js';

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

// Deferred loading support (Phase 2)
const deferredMode = process.env.GODOT_MCP_DEFERRED_TOOLS === 'true';
let searchToolUsed = false; // Track if search tool has been called

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
 * Tool definitions imported from tool-metadata.js
 */
const tools = getToolDefinitions(true); // Include all tools (legacy mode)

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
 * Supports deferred loading: returns minimal tools if deferred mode is enabled
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // In deferred mode or if search tool has been used, return minimal tools
  if (deferredMode || searchToolUsed) {
    const { alwaysVisibleTools } = await import('./tool-metadata.js');
    return { tools: alwaysVisibleTools };
  }
  // Legacy mode: return all tools
  return { tools };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Handle search tool first (enables deferred loading)
    if (name === "godot_search_tools") {
      searchToolUsed = true;
      const results = searchTools(args.query, {
        protocol: args.protocol,
        category: args.category,
        includeInternal: false
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              results,
              count: results.length,
              hint: results.length > 0
                ? "Use any of these tools for your task. More tools available on demand."
                : "No tools found for your query. Try different keywords."
            }, null, 2)
          }
        ]
      };
    }

    switch (name) {
      case "godot_dap_connect": {
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

      case "godot_dap_disconnect": {
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

      case "godot_dap_list_threads": {
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

      case "godot_dap_get_stacktrace": {
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

      case "godot_dap_get_scopes": {
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

      case "godot_dap_inspect_variables": {
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

      case "godot_dap_set_breakpoint": {
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

      case "godot_dap_clear_breakpoints": {
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

      case "godot_dap_pause": {
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

      case "godot_dap_continue": {
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

      case "godot_dap_step_over": {
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

      case "godot_dap_step_into": {
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

      case "godot_dap_step_out": {
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
