# MCP Tools Quick Reference

A quick lookup guide for all available MCP tools with curl examples.

## Scene Management

### Load a Scene
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_scene_open",
      "arguments": {"path": "res://scenes/test_framework.tscn"}
    },
    "id": 1
  }'
```

### Get Current Scene Info
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_scene_get_info",
      "arguments": {}
    },
    "id": 2
  }'
```

### Get Scene Tree
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_scene_get_tree",
      "arguments": {"max_depth": 5}
    },
    "id": 3
  }'
```

### Save Scene
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_scene_save",
      "arguments": {}
    },
    "id": 4
  }'
```

## Node Operations

### Get Node Info
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_node_get_info",
      "arguments": {"node_path": "Properties"}
    },
    "id": 5
  }'
```

### List Node Properties
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_node_list_properties",
      "arguments": {"node_path": "Properties"}
    },
    "id": 6
  }'
```

### Set Node Property
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_node_set_property",
      "arguments": {
        "node_path": "Properties",
        "property": "position",
        "value": {"type": "Vector2", "x": 200, "y": 150}
      }
    },
    "id": 7
  }'
```

### Create Node
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_node_create",
      "arguments": {
        "parent_path": "Properties",
        "node_type": "Node2D",
        "node_name": "NewNode"
      }
    },
    "id": 8
  }'
```

### Rename Node
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_node_rename",
      "arguments": {
        "node_path": "Properties/NewNode",
        "new_name": "RenamedNode"
      }
    },
    "id": 9
  }'
```

### Delete Node
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_node_delete",
      "arguments": {"node_path": "Properties/RenamedNode"}
    },
    "id": 10
  }'
```

## Script Operations

### Get Node Script
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_script_get_from_node",
      "arguments": {"node_path": "ScriptedNode"}
    },
    "id": 11
  }'
```

### Read Script Source
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_script_read_source",
      "arguments": {"script_path": "res://scripts/test_node.gd"}
    },
    "id": 12
  }'
```

### Attach Script to Node
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_script_attach_to_node",
      "arguments": {
        "node_path": "Properties",
        "script_path": "res://scripts/test_node.gd"
      }
    },
    "id": 13
  }'
```

## Resource Operations

### List Project Files
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_project_list_files",
      "arguments": {
        "directory": "res://scenes",
        "filter": ".tscn"
      }
    },
    "id": 14
  }'
```

## Project Settings

### Get Project Setting
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_project_get_setting",
      "arguments": {"setting_name": "application/config/name"}
    },
    "id": 15
  }'
```

### Set Project Setting
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_project_set_setting",
      "arguments": {
        "setting_name": "application/config/name",
        "value": "My Game"
      }
    },
    "id": 16
  }'
```

### List Project Settings
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_project_list_settings",
      "arguments": {"prefix": "application/"}
    },
    "id": 17
  }'
```

## Input Management

### List Input Actions
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_list_actions",
      "arguments": {}
    },
    "id": 18
  }'
```

### Get Specific Action
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_get_action",
      "arguments": {"action_name": "ui_accept"}
    },
    "id": 19
  }'
```

### Add Input Action
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_add_action",
      "arguments": {
        "action_name": "jump",
        "deadzone": 0.5
      }
    },
    "id": 20
  }'
```

### Add Event to Action
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_add_event",
      "arguments": {
        "action_name": "jump",
        "event": {
          "type": "key",
          "keycode": 32,
          "pressed": true
        }
      }
    },
    "id": 21
  }'
```

### Remove Event from Action
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_remove_event",
      "arguments": {
        "action_name": "jump",
        "event": {
          "type": "key",
          "keycode": 32,
          "pressed": true
        }
      }
    },
    "id": 22
  }'
```

### Remove Action
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_remove_action",
      "arguments": {"action_name": "jump"}
    },
    "id": 23
  }'
```

### Get Input Constants
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_get_constants",
      "arguments": {"type": "keys"}
    },
    "id": 24
  }'
```

## Input Simulation

### Send Action
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_send_action",
      "arguments": {
        "action_name": "ui_accept",
        "pressed": true,
        "strength": 1.0
      }
    },
    "id": 25
  }'
```

### Send Key
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_send_key",
      "arguments": {
        "keycode": 65,
        "pressed": true,
        "shift_pressed": false
      }
    },
    "id": 26
  }'
```

### Send Mouse Button
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_send_mouse_button",
      "arguments": {
        "button_index": 1,
        "pressed": true,
        "position_x": 640,
        "position_y": 360
      }
    },
    "id": 27
  }'
```

### Send Mouse Motion
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_send_mouse_motion",
      "arguments": {
        "position_x": 640,
        "position_y": 360,
        "relative_x": 10,
        "relative_y": 10
      }
    },
    "id": 28
  }'
```

### Send Joypad Button
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_send_joypad_button",
      "arguments": {
        "button_index": 0,
        "pressed": true,
        "device": 0
      }
    },
    "id": 29
  }'
```

### Send Joypad Motion
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_input_send_joypad_motion",
      "arguments": {
        "axis": 0,
        "axis_value": 0.5,
        "device": 0
      }
    },
    "id": 30
  }'
```

## Scene Playback

### Play Scene
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_game_play_scene",
      "arguments": {"enable_runtime_api": true}
    },
    "id": 31
  }'
```

### Stop Scene
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_game_stop_scene",
      "arguments": {}
    },
    "id": 32
  }'
```

### Get Screenshot
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_game_get_screenshot",
      "arguments": {
        "max_width": 1280,
        "max_height": 720
      }
    },
    "id": 33
  }'
```

### Get Runtime Scene Tree
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_game_get_scene_tree",
      "arguments": {"max_depth": 10}
    },
    "id": 34
  }'
```

## Editor Tools

### Get Editor Output
```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "godot_editor_get_output",
      "arguments": {
        "max_lines": 100,
        "filter_text": ""
      }
    },
    "id": 35
  }'
```

## Type Conversions

When using the API, some types need special formatting:

### Vector2
```json
{"type": "Vector2", "x": 100.0, "y": 200.0}
```

### Vector3
```json
{"type": "Vector3", "x": 100.0, "y": 200.0, "z": 50.0}
```

### Color
```json
{"type": "Color", "r": 1.0, "g": 0.5, "b": 0.0, "a": 1.0}
```

### Arrays (alternative format)
```json
[100.0, 200.0]  // for Vector2
[100.0, 200.0, 50.0]  // for Vector3
```

## Common Key Codes

| Key | Keycode |
|-----|---------|
| A-Z | 65-90 |
| 0-9 | 48-57 |
| Space | 32 |
| Enter | 10 |
| Escape | 4194053 |
| Tab | 9 |
| Shift | 4194325 |
| Ctrl | 4194326 |
| Alt | 4194327 |

Use `godot_input_get_constants` with `type: "keys"` for a complete list.

## Mouse Button Codes

| Button | Code |
|--------|------|
| Left | 1 |
| Right | 2 |
| Middle | 3 |
| Wheel Up | 4 |
| Wheel Down | 5 |

## Joypad Button Codes

| Button | Code |
|--------|------|
| A | 0 |
| B | 1 |
| X | 2 |
| Y | 3 |
| LB | 4 |
| RB | 5 |
| Back | 6 |
| Start | 7 |

Use `godot_input_get_constants` with `type: "joypad"` for complete lists.
