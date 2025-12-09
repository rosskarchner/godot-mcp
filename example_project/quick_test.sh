#!/bin/bash
# Quick test of MCP tools - simplified version

SERVER="http://localhost:8765"

echo "Testing MCP Server Tools..."
echo ""

# Test 1: Load scene
echo "[TEST 1] Loading test scene..."
response=$(curl -s -X POST "$SERVER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"godot_scene_open","arguments":{"path":"res://scenes/test_framework.tscn"}},"id":1}')
if echo "$response" | grep -q "success"; then
  echo "✓ Scene loaded"
else
  echo "✗ Failed to load scene"
  echo "$response" | head -50
fi
sleep 2
echo ""

# Test 2: Get scene info
echo "[TEST 2] Getting scene info..."
response=$(curl -s -X POST "$SERVER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"godot_scene_get_info","arguments":{}},"id":2}')
if echo "$response" | grep -q "path\|name"; then
  echo "✓ Scene info retrieved"
  echo "$response" | python3 -m json.tool 2>/dev/null | head -25
else
  echo "✗ Failed to get scene info"
  echo "$response"
fi
echo ""

# Test 2b: Get scene tree
echo "[TEST 2b] Getting scene tree..."
response=$(curl -s -X POST "$SERVER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"godot_scene_get_tree","arguments":{"max_depth":3}},"id":3}')
if echo "$response" | grep -q "TestRoot"; then
  echo "✓ Scene tree retrieved"
else
  echo "✗ Failed to get scene tree"
  echo "$response"
fi
echo ""

# Test 3: Get node info
echo "[TEST 3] Getting node info..."
response=$(curl -s -X POST "$SERVER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"godot_node_get_info","arguments":{"node_path":"Properties"}},"id":3}')
if echo "$response" | grep -q "Properties"; then
  echo "✓ Node info retrieved"
  echo "$response" | python3 -m json.tool 2>/dev/null | head -30
else
  echo "✗ Failed to get node info"
  echo "$response"
fi
echo ""

# Test 4: List node properties
echo "[TEST 4] Listing node properties..."
response=$(curl -s -X POST "$SERVER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"godot_node_list_properties","arguments":{"node_path":"Properties"}},"id":4}')
if echo "$response" | grep -q "position\|rotation"; then
  echo "✓ Node properties retrieved"
  echo "$response" | python3 -m json.tool 2>/dev/null | head -30
else
  echo "✗ Failed to list properties"
  echo "$response"
fi
echo ""

# Test 5: Set node property
echo "[TEST 5] Setting node property..."
response=$(curl -s -X POST "$SERVER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"godot_node_set_property","arguments":{"node_path":"Properties","property":"position","value":{"type":"Vector2","x":250,"y":200}}},"id":5}')
if echo "$response" | grep -q "success"; then
  echo "✓ Property set successfully"
else
  echo "✗ Failed to set property"
  echo "$response"
fi
echo ""

# Test 6: Create node
echo "[TEST 6] Creating new node..."
response=$(curl -s -X POST "$SERVER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"godot_node_create","arguments":{"parent_path":"Properties","node_type":"Node2D","node_name":"TestCreated"}},"id":6}')
if echo "$response" | grep -q "success"; then
  echo "✓ Node created"
else
  echo "✗ Failed to create node"
  echo "$response"
fi
echo ""

# Test 7: Get script
echo "[TEST 7] Getting node script..."
response=$(curl -s -X POST "$SERVER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"godot_script_get_from_node","arguments":{"node_path":"ScriptedNode"}},"id":7}')
if echo "$response" | grep -q "test_node\|result"; then
  echo "✓ Script retrieved"
  echo "$response" | python3 -m json.tool 2>/dev/null | head -20
else
  echo "✗ Failed to get script"
  echo "$response"
fi
echo ""

# Test 8: List project files
echo "[TEST 8] Listing project files..."
response=$(curl -s -X POST "$SERVER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"godot_project_list_files","arguments":{"directory":"res://scenes","filter":".tscn"}},"id":8}')
if echo "$response" | grep -q "test_framework\|test_scene"; then
  echo "✓ Files listed"
  echo "$response" | python3 -m json.tool 2>/dev/null | head -30
else
  echo "✗ Failed to list files"
  echo "$response"
fi
echo ""

# Test 9: Get project setting
echo "[TEST 9] Getting project setting..."
response=$(curl -s -X POST "$SERVER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"godot_project_get_setting","arguments":{"setting_name":"application/config/name"}},"id":9}')
if echo "$response" | grep -q "MCP\|result"; then
  echo "✓ Project setting retrieved"
  echo "$response" | python3 -m json.tool 2>/dev/null
else
  echo "✗ Failed to get setting"
  echo "$response"
fi
echo ""

# Test 10: List input actions
echo "[TEST 10] Listing input actions..."
response=$(curl -s -X POST "$SERVER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"godot_input_list_actions","arguments":{}},"id":10}')
if echo "$response" | grep -q "ui_accept\|ui_"; then
  echo "✓ Input actions retrieved"
  action_count=$(echo "$response" | grep -o "\"name\":" | wc -l)
  echo "   Found $action_count actions"
else
  echo "✗ Failed to list actions"
  echo "$response"
fi
echo ""

echo "======================="
echo "Quick test complete!"
echo "======================="
