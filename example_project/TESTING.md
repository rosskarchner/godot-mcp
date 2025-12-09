# MCP Server Plugin - Testing Guide

This document explains how to run the comprehensive test suite for the MCP Server Plugin.

## Quick Start

To run all tests:

```bash
# 1. Setup the example project (if not already done)
cd ..
./setup_example.sh
cd example_project

# 2. Start Godot with the example project
godot .

# 3. In another terminal, run the test suite
./test_mcp_tools.sh
```

## Prerequisites

- Godot Engine 4.x with the example project open
- The MCP Server plugin enabled
- The server running on `localhost:8765` (default)
- `curl` command-line tool installed
- `bash` shell

## What Gets Tested

The test suite comprehensively validates all advertised functionality:

### Section 1: Initialization
- **Initialize MCP server** - Establishes connection and verifies protocol support

### Section 2: Tools Listing
- **List available tools** - Retrieves all available MCP tools and verifies count

### Section 3: Scene Management
- **Load test scene** - Opens `res://scenes/test_framework.tscn`
- **Get current scene info** - Retrieves information about the loaded scene
- **Get scene tree** - Gets hierarchical structure with depth control

### Section 4: Node Operations
- **Get node info** - Retrieves detailed information about a specific node
- **List node properties** - Gets all editable properties and values
- **Set node property** - Modifies position (Vector2 type conversion test)
- **Create new node** - Creates a new Node2D in the scene
- **Rename node** - Renames the newly created node
- **Delete node** - Removes the node from the scene

### Section 5: Script Operations
- **Get node script** - Retrieves script attached to a node
- **Read script source** - Reads full source code of a GDScript file

### Section 6: Resource Operations
- **List project files** - Lists resources in a directory with file extension filtering

### Section 7: Project Settings
- **Get project setting** - Retrieves a specific project.godot setting
- **List project settings** - Lists settings by category prefix

### Section 8: Input Management
- **List input actions** - Gets all configured input actions
- **Get specific action** - Retrieves details about a single action
- **Add new action** - Creates a new input action
- **Get input constants** - Retrieves key codes and button constants
- **Add event to action** - Binds a key to an action
- **Remove action** - Deletes the test action

### Section 9: Editor Output
- **Get editor output** - Retrieves recent console output with filtering

### Section 10: Scene Playback & Visualization
- **Play scene** - Starts the scene in play mode
- **Capture screenshot** - Takes a screenshot of the running game
- **Stop scene** - Stops scene playback

## Test Scene Structure

The test framework uses `scenes/test_framework.tscn` which contains:

```
TestRoot (Node2D)
├── Properties (Node2D) - For testing property modifications
│   └── TransformTest (Node2D) - Tests rotation and scale
├── Canvas (CanvasLayer)
│   └── Sprites (Node)
│       ├── Sprite1 (Sprite2D)
│       └── Sprite2D (Sprite2D)
├── Areas (Node)
│   ├── Area2D_1 (Area2D)
│   │   └── CollisionShape2D
│   └── Area2D_2 (Area2D)
│       └── CollisionShape2D
├── ScriptedNode (Node) - With test_node.gd script attached
│   └── Children (Node)
│       ├── Child_1 (Node)
│       │   └── Grandchild (Node)
│       └── Child_2 (Node)
└── UI (Control)
    ├── Label
    ├── Button
    └── Panel
```

## Running Individual Tests

You can modify the test script to run specific sections. For example:

```bash
# Only run scene management tests
sed -n '/SECTION 3:/,/SECTION 4:/p' test_mcp_tools.sh | bash

# Only run node operations
sed -n '/SECTION 4:/,/SECTION 5:/p' test_mcp_tools.sh | bash
```

Or create a custom test file that imports the helper functions.

## Test Output Interpretation

Each test produces output like:

```
✓ PASS: Test name
✗ FAIL: Test name
  Error details
```

A summary at the end shows:
```
Total Tests: 26
Passed: 26
Failed: 0
Success Rate: 100%
```

**Success Rate Guide:**
- **100%** - All functionality working perfectly
- **80-99%** - Minor issues to investigate
- **50-79%** - Significant issues affecting some features
- **<50%** - Critical issues preventing plugin from functioning

## Troubleshooting Failed Tests

### "Server not responding"
- Verify Godot is running with the example project open
- Check that the MCP Server plugin is enabled (Project → Project Settings → Plugins)
- Verify the server is listening on port 8765 (check Output console)
- Try manually: `curl -X POST http://localhost:8765 -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "method": "initialize", "params": {}, "id": 1}'`

### Scene tests fail
- Ensure `scenes/test_framework.tscn` exists
- Try reloading the scene in the Godot editor
- Check the Godot console for errors

### Node operation tests fail
- Verify the test scene is properly loaded
- Check that node paths are correct (case-sensitive)
- Try manually navigating to nodes in the scene tree

### Script tests fail
- Ensure `scripts/test_node.gd` exists
- Verify the script is attached to ScriptedNode
- Check for script syntax errors in the Godot editor

### Input management tests fail
- Verify project.godot is not corrupted
- Try restarting Godot
- Check that input action modification doesn't conflict with existing actions

### Screenshot test fails
- Ensure the scene is playing
- Try switching between 2D and 3D views in the editor
- Check that the viewport is visible

## Testing Locally vs Remote

The test script assumes the MCP server is on `localhost:8765`. To test against a remote server:

```bash
SERVER_URL="http://192.168.1.100:8765" ./test_mcp_tools.sh
```

However, ensure proper security measures are in place before exposing the MCP server to a network.

## Advanced Testing

### Performance Testing

Add timing to test execution:
```bash
time ./test_mcp_tools.sh
```

### Continuous Testing

Run tests on a loop:
```bash
while true; do
    ./test_mcp_tools.sh
    sleep 60
done
```

### Test with Filtering

Capture only errors:
```bash
./test_mcp_tools.sh 2>&1 | grep "FAIL"
```

## Extending the Test Suite

To add new tests, follow this pattern in `test_mcp_tools.sh`:

```bash
# New test section
echo -e "${BLUE}SECTION X: New Feature${NC}"

# Make a tool call
response=$(tool_call "tool_name" "{\"param\": \"value\"}" "100")

# Check the result
test_result "Descriptive test name" $(echo "$response" | grep -q "expected_text" && echo 0 || echo 1)
```

## Test Coverage

| Category | Tools | Status |
|----------|-------|--------|
| Initialization | initialize | ✓ |
| Tools Listing | tools/list | ✓ |
| Scene Management | 3 tools | ✓ |
| Node Operations | 6 tools | ✓ |
| Script Operations | 3 tools | ✓ |
| Resources | 2 tools | ✓ |
| Project Settings | 3 tools | ✓ |
| Input Management | 6 tools | ✓ |
| Editor Output | 1 tool | ✓ |
| Scene Playback | 3 tools | ✓ |
| **Total** | **31 tests** | **✓** |

## Expected Test Duration

- Full suite: ~30-45 seconds
- Individual sections: 2-5 seconds each

## Notes

- Tests are non-destructive and create/delete test nodes
- The test scene is not modified permanently
- No project files are deleted or corrupted
- All tests can be safely re-run
- Tests require manual scene loading in Godot (not automated)

## Getting Help

If tests fail:

1. Check the Godot Output console for error messages
2. Verify all prerequisites are met
3. Try running a single section to isolate the issue
4. Check that the plugin is properly installed
5. Review the troubleshooting section above

For more information, see the main README.md file.
