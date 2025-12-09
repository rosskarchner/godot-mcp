#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { InstanceManager } from './instance-manager.js';
import { DAPClient } from './dap-client.js';
import { LSPClient } from './lsp-client.js';
import { EditorApiClient } from './editor-api-client.js';
import { GameBridgeClient } from './game-bridge-client.js';
import { getToolDefinitions } from './unified-tools.js';

// Global state
const instanceManager = new InstanceManager();
// Restore previous sessions
await instanceManager.loadState();

let activeInstanceId = null;
const runningInstances = instanceManager.listInstances();
if (runningInstances.length > 0) {
  activeInstanceId = runningInstances[0].id;
  console.error(`[MCP] Restored ${runningInstances.length} instance(s). Active: ${activeInstanceId}`);
}

// Get clients for the active or specified instance
function getClients(instanceId = null) {
  const id = instanceId || activeInstanceId;
  if (!id) {
    throw new Error('No active instance. Use godot_launch or godot_switch_instance first.');
  }

  const instance = instanceManager.getInstance(id);
  if (!instance) {
    throw new Error(`Instance not found: ${id}`);
  }

  return {
    dap: getDAPClient(instance),
    lsp: getLSPClient(instance),
    editor: new EditorApiClient('127.0.0.1', instance.ports.editorApi),
    game: new GameBridgeClient('127.0.0.1', instance.ports.gameBridge),
    instance
  };
}

// Client caching to avoid reconnecting or multiple instances
const dapClients = new Map(); // instanceId -> DAPClient
const lspClients = new Map(); // instanceId -> LSPClient

function getDAPClient(instance) {
  if (!dapClients.has(instance.id)) {
    dapClients.set(instance.id, new DAPClient('127.0.0.1', instance.ports.dap));
  }
  return dapClients.get(instance.id);
}

function getLSPClient(instance) {
  if (!lspClients.has(instance.id)) {
    lspClients.set(instance.id, new LSPClient('127.0.0.1', instance.ports.lsp));
  }
  return lspClients.get(instance.id);
}

// Create MCP server
const server = new Server(
  { name: "godot-mcp-unified", version: "3.0.0" },
  { capabilities: { tools: {} } }
);

// Tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: getToolDefinitions() };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // === Instance Management ===
    if (name === 'godot_launch') {
      const instance = await instanceManager.launchInstance(
        args.project_path,
        {
          godotPath: args.godot_path,
          waitForReady: args.wait_for_ready,
          headless: args.headless
        }
      );
      activeInstanceId = instance.id;

      if (args.wait_for_ready) {
        console.error(`[MCP] Waiting for instance ${instance.id} to be ready...`);
        const { editor } = getClients(instance.id);
        const startTime = Date.now();
        const timeout = 60000; // 60s timeout

        let ready = false;
        while (Date.now() - startTime < timeout) {
          if (await editor.healthCheck()) {
            ready = true;
            break;
          }
          await new Promise(r => setTimeout(r, 1000));
        }

        if (!ready) {
          throw new Error("Timeout waiting for Godot instance to be ready");
        }
        console.error(`[MCP] Instance ${instance.id} is ready.`);
      }

      return success(`Launched Godot for ${args.project_path} (ID: ${instance.id})`, {
        instance_id: instance.id,
        ports: instance.ports
      });
    }

    if (name === 'godot_list_instances') {
      return success('Active instances', instanceManager.listInstances());
    }

    if (name === 'godot_switch_instance') {
      if (!instanceManager.getInstance(args.instance_id)) {
        return JSON.stringify({ isError: true, content: [{ type: 'text', text: `Instance not found: ${args.instance_id}` }] });
      }
      activeInstanceId = args.instance_id;
      return success(`Switched to instance: ${activeInstanceId}`);
    }

    if (name === 'godot_adopt_instance') {
      const instance = await instanceManager.adoptInstance(args.project_path, args);
      activeInstanceId = instance.id;
      return success(`Adopted external instance: ${instance.id}. Set as active.`);
    }

    if (name === 'godot_terminate') {
      const result = await instanceManager.terminateInstance(args.instance_id);
      if (activeInstanceId === args.instance_id) activeInstanceId = null;

      // Clean up clients
      dapClients.delete(args.instance_id);
      lspClients.delete(args.instance_id);

      return success(result ? `Terminated instance: ${args.instance_id}` : `Instance not found`);
    }


    // === Editor Tools ===
    if (name.startsWith('godot_scene_') || name.startsWith('godot_node_') ||
      name.startsWith('godot_script_') || name.startsWith('godot_resources_') ||
      name.startsWith('godot_project_') || name.startsWith('godot_input_') ||
      name === 'godot_editor_output') {

      const { editor } = getClients(args.instance_id);
      let result;

      switch (name) {
        case 'godot_scene_get_tree': result = await editor.getSceneTree(args.max_depth); break;
        case 'godot_scene_current': result = await editor.getCurrentScene(); break;
        case 'godot_scene_load': result = await editor.loadScene(args.path); break;
        case 'godot_scene_save': result = await editor.saveScene(); break;
        case 'godot_node_info': result = await editor.getNodeInfo(args.node_path); break;
        case 'godot_node_properties': result = await editor.getNodeProperties(args.node_path); break;
        case 'godot_node_set_property': result = await editor.setNodeProperty(args.node_path, args.property, args.value); break;
        case 'godot_node_create': result = await editor.createNode(args.parent_path, args.node_type, args.node_name); break;
        case 'godot_node_delete': result = await editor.deleteNode(args.node_path); break;
        case 'godot_script_attach': result = await editor.attachScript(args.node_path, args.script_path); break;
        case 'godot_script_source': result = await editor.getScriptSource(args.script_path); break;
        case 'godot_resources_list': result = await editor.listResources(args.directory, args.filter); break;
        case 'godot_project_settings_list': result = await editor.listProjectSettings(args.prefix);
        // DAP Debugging
        case 'godot_dap_attach':
          result = await editor.dapAttach(args.instance_id);
          break;
        case 'godot_dap_configuration_done':
          result = await editor.dapConfigurationDone(args.instance_id);
          break;
        case 'godot_dap_set_breakpoint':
          result = await editor.dapSetBreakpoint(args.source, args.line, args.condition, args.instance_id);
          break;
        case 'godot_dap_clear_breakpoints':
          result = await editor.dapClearBreakpoints(args.source, args.instance_id);
          break;

        // Editor Bridge Debugging (Preferred over DAP Flow Control)
        case 'godot_debugger_sessions':
          result = await editor.getDebuggerSessions();
          break;
        case 'godot_debugger_resume':
          result = await editor.debugResume(args.session_id);
          break;
        case 'godot_debugger_step_over':
          result = await editor.debugStepOver(args.session_id);
          break;
        case 'godot_script_get': result = await editor.getNodeScript(args.node_path); break;
        case 'godot_input_actions_list': result = await editor.listInputActions(); break;
        case 'godot_editor_output': result = await editor.readEditorLogs(args.max_lines, args.filter_text); break;
        default: throw new Error(`Unimplemented editor tool: ${name}`);
      }
      return success('Editor operation successful', result);
    }

    // === Game Bridge Tools ===
    if (name.startsWith('godot_game_') || name === 'godot_debugger_sessions') {
      const { game, editor } = getClients(args.instance_id); // Need editor for play/stop
      let result;

      switch (name) {
        case 'godot_game_play':
          result = await editor.request('/game/play', args);
          break;
        case 'godot_game_stop':
          result = await editor.request('/game/stop', {});
          break;
        case 'godot_game_screenshot':
          result = await game.captureScreenshot({
            maxWidth: args.max_width,
            maxHeight: args.max_height,
            saveToDisk: args.save_to_disk
          });
          break;
        case 'godot_debugger_sessions':
          result = await editor.getDebuggerSessions();
          break;
        case 'godot_debugger_resume':
          result = await editor.debugResume(args.session_id);
          break;
        case 'godot_debugger_step_over':
          result = await editor.debugStepOver(args.session_id);
          break;
        case 'godot_game_scene_tree':
          result = await game.getSceneTree(args.max_depth);
          break;
        // godot_game_send_input removed (use godot_game_send_sequence)
        case 'godot_game_send_sequence':
          result = await game.sendInputSequence(args.sequence, args.capture_screenshot);
          break;
        default: throw new Error(`Unimplemented game tool: ${name}`);
      }
      return success('Game operation successful', result);
    }

    // === DAP / LSP Tools ===
    if (name.startsWith('godot_dap_')) {
      const { dap } = getClients(args.instance_id);
      let result;

      if (name === 'godot_dap_connect') {
        await dap.connect();
        await dap.sendRequest('attach', {});
        return success('Connected and Attached to DAP');
      } else if (name === 'godot_dap_disconnect') {
        dap.disconnect();
        return success('Disconnected from DAP');
      } else {
        // Forward request to DAP client
        // We need to map tool name to command name
        // godot_dap_set_breakpoint -> setBreakpoint? No, client.sendRequest('setBreakpoints')
        // The client implementation expects us to manage specific requests manually or we can add helper methods in client?
        // The existing index.js manually constructed requests.

        // I will reuse logic from old index.js logic but adapted
        const command = name.replace('godot_dap_', '');
        // Mapping quirks: set_breakpoint -> setBreakpoints, etc.

        // For simplicity, I will implement specific handlers for common tools
        switch (name) {
          // godot_dap_attach case removed (merged into connect)
          case 'godot_dap_configuration_done': result = await dap.sendRequest('configurationDone', {}); break;
          case 'godot_dap_set_breakpoint':
            // DAP expects 'setBreakpoints', logic is complex (needs source object)
            await dap.sendRequest('setBreakpoints', {
              source: { path: args.source },
              breakpoints: [{ line: args.line, condition: args.condition }]
            });
            result = "Breakpoint set";
            // For more complete implementation we'd need to properly handle response
            break;
          case 'godot_dap_clear_breakpoints':
            await dap.sendRequest('setBreakpoints', { source: { path: args.source }, breakpoints: [] });
            result = "Breakpoints cleared";
            break;
          default: throw new Error(`Unimplemented DAP tool: ${name}`);
        }
      }
      return success(typeof result === 'string' ? result : 'DAP Request Successful', result);
    }

    if (name.startsWith('godot_lsp_')) {
      const { lsp } = getClients(args.instance_id);
      let result;

      if (name === 'godot_lsp_connect') {
        await lsp.connect();
        // Manually init? client.connect() does initialize
        return success('Connected to LSP');
      } else if (name === 'godot_lsp_disconnect') {
        lsp.disconnect();
        return success('Disconnected from LSP');
      }

      switch (name) {
        case 'godot_lsp_get_errors':
          result = await lsp.getDocumentDiagnostics(args.uri);
          break;
        case 'godot_lsp_get_symbol_info': result = await lsp.hover(args.uri, args.line, args.character); break;
        case 'godot_lsp_find_definition': result = await lsp.definition(args.uri, args.line, args.character); break;
        case 'godot_lsp_autocomplete': result = await lsp.completion(args.uri, args.line, args.character); break;
        case 'godot_lsp_list_symbols': result = await lsp.documentSymbols(args.uri); break;
        case 'godot_lsp_search_symbols': result = await lsp.workspaceSymbols(args.query); break;
        default: throw new Error(`Unimplemented LSP tool: ${name}`);
      }
      return success('LSP Request Successful', result);
    }

    throw new Error(`Unknown tool: ${name}`);

  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

function success(message, data = null) {
  return {
    content: [{
      type: 'text',
      text: data ? (typeof data === 'string' ? data : JSON.stringify(data, null, 2)) : message
    }]
  };
}

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Godot Unified MCP Server running on stdio");
