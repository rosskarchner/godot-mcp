import { allTools as existingTools } from './tool-metadata.js';

// Helper to add instance_id to schema
function withInstanceId(tool) {
    const newTool = { ...tool };
    // Deep copy inputSchema to avoid mutation issues
    newTool.inputSchema = JSON.parse(JSON.stringify(tool.inputSchema));

    newTool.inputSchema.properties.instance_id = {
        type: 'string',
        description: 'Optional: ID of the Godot instance to target (default: active instance)'
    };
    return newTool;
}

const instanceTools = [
    {
        name: 'godot_launch',
        description: 'Launch a Godot editor instance. Auto-injects MCP support.',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: { type: 'string', description: 'Absolute path to the Godot project directory' },
                godot_path: { type: 'string', description: 'Path to Godot executable (optional, auto-detected if not provided)' },
                wait_for_ready: { type: 'boolean', default: true, description: 'Wait for editor to be fully loaded before returning' }
            },
            required: ['project_path']
        }
    },
    {
        name: 'godot_list_instances',
        description: 'List all running Godot instances.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'godot_terminate',
        description: 'Terminate a Godot editor instance.',
        inputSchema: {
            type: 'object',
            properties: {
                instance_id: { type: 'string', description: 'Instance ID or project path' }
            },
            required: ['instance_id']
        }
    },
    {
        name: 'godot_switch_instance',
        description: 'Switch the active instance for tool calls.',
        inputSchema: {
            type: 'object',
            properties: {
                instance_id: { type: 'string', description: 'Instance ID or project path to make active' }
            },
            required: ['instance_id']
        }
    },
    {
        name: 'godot_adopt_instance',
        description: 'Connect to an externally started Godot (requires MCP plugin).',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: { type: 'string', description: 'Absolute path to the project' },
                lsp_port: { type: 'integer', default: 6005 },
                dap_port: { type: 'integer', default: 6006 },
                editor_port: { type: 'integer', default: 8765 },
                game_bridge_port: { type: 'integer', default: 8766 }
            },
            required: ['project_path']
        }
    }
];

const editorTools = [
    {
        name: 'godot_scene_get_tree',
        description: 'Get the hierarchical structure of the current scene in the editor',
        inputSchema: {
            type: 'object',
            properties: {
                max_depth: { type: 'integer', default: 10, description: 'Maximum depth to traverse' }
            }
        }
    },
    {
        name: 'godot_scene_current',
        description: 'Get information about the currently active scene tab',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'godot_scene_load',
        description: 'Load a scene into the editor',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Resource path (res://...)' }
            },
            required: ['path']
        }
    },
    {
        name: 'godot_scene_save',
        description: 'Save the currently active scene',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'godot_node_info',
        description: 'Get detailed information about a scene node',
        inputSchema: {
            type: 'object',
            properties: {
                node_path: { type: 'string', description: 'Path to node in scene tree' }
            },
            required: ['node_path']
        }
    },
    {
        name: 'godot_node_properties',
        description: 'Get properties of a scene node',
        inputSchema: {
            type: 'object',
            properties: {
                node_path: { type: 'string' }
            },
            required: ['node_path']
        }
    },
    {
        name: 'godot_node_set_property',
        description: 'Set a property value on a node',
        inputSchema: {
            type: 'object',
            properties: {
                node_path: { type: 'string' },
                property: { type: 'string' },
                value: { type: ['string', 'number', 'boolean', 'array', 'object'] }
            },
            required: ['node_path', 'property', 'value']
        }
    },
    {
        name: 'godot_node_create',
        description: 'Create a new node',
        inputSchema: {
            type: 'object',
            properties: {
                parent_path: { type: 'string' },
                node_type: { type: 'string' },
                node_name: { type: 'string' }
            },
            required: ['parent_path', 'node_type', 'node_name']
        }
    },
    {
        name: 'godot_node_delete',
        description: 'Delete a node',
        inputSchema: {
            type: 'object',
            properties: {
                node_path: { type: 'string' }
            },
            required: ['node_path']
        }
    },
    {
        name: 'godot_script_attach',
        description: 'Attach a script to a node',
        inputSchema: {
            type: 'object',
            properties: {
                node_path: { type: 'string' },
                script_path: { type: 'string' }
            },
            required: ['node_path', 'script_path']
        }
    },
    // godot_script_source removed (agents can read files directly)
    {
        name: 'godot_resources_list',
        description: 'List resources in project directory',
        inputSchema: {
            type: 'object',
            properties: {
                directory: { type: 'string', default: 'res://' },
                filter: { type: 'string', description: 'Extension filter (e.g. .tscn)' }
            }
        }
    },
    {
        name: 'godot_project_settings_list',
        description: 'List project settings',
        inputSchema: {
            type: 'object',
            properties: {
                prefix: { type: 'string' }
            }
        }
    },
    {
        name: 'godot_editor_output',
        description: 'Read Godot editor logs',
        inputSchema: {
            type: 'object',
            properties: {
                max_lines: { type: 'integer', default: 100 },
                filter_text: { type: 'string' }
            }
        }
    },
    {
        name: 'godot_script_get',
        description: 'Get the script attached to a node',
        inputSchema: {
            type: 'object',
            properties: { node_path: { type: 'string' } },
            required: ['node_path']
        }
    },
    {
        name: 'godot_project_setting_get',
        description: 'Get the value of a specific project setting',
        inputSchema: {
            type: 'object',
            properties: { setting_name: { type: 'string' } },
            required: ['setting_name']
        }
    },
    {
        name: 'godot_project_setting_set',
        description: 'Set the value of a project setting',
        inputSchema: {
            type: 'object',
            properties: {
                setting_name: { type: 'string' },
                value: { type: ['string', 'number', 'boolean'] }
            },
            required: ['setting_name', 'value']
        }
    },
    {
        name: 'godot_input_actions_list',
        description: 'List all input actions defined in the project',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'godot_game_play',
        description: 'Start playing the current scene (or main scene) in the Godot editor',
        inputSchema: {
            type: 'object',
            properties: {
                enable_runtime_api: { type: 'boolean', default: true, description: 'Inject Game Bridge autoload to enable runtime interaction' }
            }
        }
    },
    {
        name: 'godot_game_stop',
        description: 'Stop the currently playing scene',
        inputSchema: { type: 'object', properties: {} }
    }
];

const gameBridgeTools = [
    {
        name: 'godot_game_screenshot',
        description: 'Capture a screenshot from the running game',
        inputSchema: {
            type: 'object',
            properties: {
                max_width: { type: 'integer', default: 1280 },
                max_height: { type: 'integer', default: 720 },
                save_to_disk: { type: 'boolean', default: false }
            }
        }
    },
    {
        name: 'godot_game_scene_tree',
        description: 'Get the scene tree of the running game (runtime state)',
        inputSchema: {
            type: 'object',
            properties: {
                max_depth: { type: 'integer', default: 10 }
            }
        }
    },
    {
        name: 'godot_game_send_sequence',
        description: 'Send a sequence of input events to running game',
        inputSchema: {
            type: 'object',
            properties: {
                sequence: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            event_type: { type: 'string' },
                            delay_ms: { type: 'integer' }
                        }
                    }
                },
                capture_screenshot: { type: 'boolean', default: false }
            },
            required: ['sequence']
        }
    }
];

export const tools = [
    ...instanceTools,
    ...[...editorTools, ...gameBridgeTools, ...existingTools].map(withInstanceId)
];

export function getToolDefinitions() {
    return tools;
}
