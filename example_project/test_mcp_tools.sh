#!/bin/bash
# Comprehensive MCP Server Plugin Test Suite
# This script tests all advertised functionality of the MCP server plugin

set -e

# Configuration
SERVER_URL="http://localhost:8765"
TEST_SCENE="res://scenes/test_framework.tscn"
PASSED=0
FAILED=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to make MCP requests
mcp_call() {
    local method=$1
    local params=$2
    local request_id=${3:-1}

    local payload="{\"jsonrpc\": \"2.0\", \"method\": \"$method\", \"params\": $params, \"id\": $request_id}"

    curl -s -X POST "$SERVER_URL" \
        -H "Content-Type: application/json" \
        -d "$payload"
}

# Helper function to call a tool
tool_call() {
    local tool_name=$1
    local arguments=$2
    local request_id=${3:-1}

    if [ -z "$arguments" ]; then
        arguments="{}"
    fi

    local params="{\"name\": \"$tool_name\", \"arguments\": $arguments}"
    mcp_call "tools/call" "$params" "$request_id"
}

# Helper function for test reporting
test_result() {
    local test_name=$1
    local success=$2
    local message=$3

    ((TOTAL++))

    if [ $success -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        if [ -n "$message" ]; then
            echo -e "  ${RED}$message${NC}"
        fi
        ((FAILED++))
    fi
}

# Header
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     MCP Server Plugin - Comprehensive Test Suite          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if server is running
echo -e "${YELLOW}[Setup]${NC} Checking if MCP server is running on $SERVER_URL..."
response=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$SERVER_URL" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc": "2.0", "method": "initialize", "params": {}, "id": 1}')

if [ "$response" != "200" ]; then
    echo -e "${RED}✗ Server not responding (HTTP $response)${NC}"
    echo "Please start the Godot editor with the example project and ensure the MCP server is enabled."
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# ============================================================================
# SECTION 1: INITIALIZATION
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 1: Initialization${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

response=$(mcp_call "initialize" "{\"protocolVersion\": \"2024-11-05\", \"capabilities\": {}, \"clientInfo\": {\"name\": \"test-client\", \"version\": \"1.0.0\"}}" "1")
echo "Response: $response" | head -c 100
echo ""
test_result "Initialize MCP server" $(echo "$response" | grep -q "result" && echo 0 || echo 1)
echo ""

# ============================================================================
# SECTION 2: TOOLS LISTING
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 2: Tools Listing${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

response=$(mcp_call "tools/list" "{}" "2")
test_result "List available tools" $(echo "$response" | grep -q "godot_scene_get_tree\|get_scene_tree" && echo 0 || echo 1)
tool_count=$(echo "$response" | grep -o "\"name\":" | wc -l)
echo "Found $tool_count tools"
echo ""

# ============================================================================
# SECTION 3: SCENE MANAGEMENT
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 3: Scene Management${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Load test scene
echo -e "${YELLOW}[3.1]${NC} Loading test scene..."
response=$(tool_call "godot_scene_open" "{\"path\": \"$TEST_SCENE\"}" "3")
test_result "Load test scene" $(echo "$response" | grep -q "success" && echo 0 || echo 1)
sleep 1
echo ""

# Get current scene info
echo -e "${YELLOW}[3.2]${NC} Getting current scene info..."
response=$(tool_call "godot_scene_get_info" "{}" "4")
test_result "Get current scene info" $(echo "$response" | grep -q "path\|name" && echo 0 || echo 1)
echo ""

# Get scene tree
echo -e "${YELLOW}[3.3]${NC} Getting scene tree..."
response=$(tool_call "godot_scene_get_tree" "{\"max_depth\": 5}" "5")
test_result "Get scene tree" $(echo "$response" | grep -q "TestRoot\|children" && echo 0 || echo 1)
echo ""

# ============================================================================
# SECTION 4: NODE OPERATIONS
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 4: Node Operations${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Get node info
echo -e "${YELLOW}[4.1]${NC} Getting node info..."
response=$(tool_call "godot_node_get_info" "{\"node_path\": \"Properties\"}" "6")
test_result "Get node info" $(echo "$response" | grep -q "Properties\|position" && echo 0 || echo 1)
echo ""

# List node properties
echo -e "${YELLOW}[4.2]${NC} Listing node properties..."
response=$(tool_call "godot_node_list_properties" "{\"node_path\": \"Properties\"}" "7")
test_result "List node properties" $(echo "$response" | grep -q "position\|rotation" && echo 0 || echo 1)
echo ""

# Set node property (position)
echo -e "${YELLOW}[4.3]${NC} Setting node property (position)..."
response=$(tool_call "godot_node_set_property" "{\"node_path\": \"Properties\", \"property\": \"position\", \"value\": {\"type\": \"Vector2\", \"x\": 200, \"y\": 150}}" "8")
test_result "Set node property" $(echo "$response" | grep -q "success" && echo 0 || echo 1)
echo ""

# Create new node
echo -e "${YELLOW}[4.4]${NC} Creating new node..."
response=$(tool_call "godot_node_create" "{\"parent_path\": \"Properties\", \"node_type\": \"Node2D\", \"node_name\": \"TestNode_Created\"}" "9")
test_result "Create new node" $(echo "$response" | grep -q "success" && echo 0 || echo 1)
echo ""

# Rename node
echo -e "${YELLOW}[4.5]${NC} Renaming node..."
response=$(tool_call "godot_node_rename" "{\"node_path\": \"Properties/TestNode_Created\", \"new_name\": \"TestNode_Renamed\"}" "10")
test_result "Rename node" $(echo "$response" | grep -q "success" && echo 0 || echo 1)
echo ""

# Delete node
echo -e "${YELLOW}[4.6]${NC} Deleting node..."
response=$(tool_call "godot_node_delete" "{\"node_path\": \"Properties/TestNode_Renamed\"}" "11")
test_result "Delete node" $(echo "$response" | grep -q "success" && echo 0 || echo 1)
echo ""

# ============================================================================
# SECTION 5: SCRIPT OPERATIONS
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 5: Script Operations${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Get node script
echo -e "${YELLOW}[5.1]${NC} Getting node script..."
response=$(tool_call "godot_script_get_from_node" "{\"node_path\": \"ScriptedNode\"}" "12")
test_result "Get node script" $(echo "$response" | grep -q "test_node\|script" && echo 0 || echo 1)
echo ""

# Read script source
echo -e "${YELLOW}[5.2]${NC} Reading script source..."
response=$(tool_call "godot_script_read_source" "{\"script_path\": \"res://scripts/test_node.gd\"}" "13")
test_result "Read script source" $(echo "$response" | grep -q "test_value\|test_method" && echo 0 || echo 1)
echo ""

# ============================================================================
# SECTION 6: RESOURCE OPERATIONS
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 6: Resource Operations${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# List project files
echo -e "${YELLOW}[6.1]${NC} Listing project files..."
response=$(tool_call "godot_project_list_files" "{\"directory\": \"res://scenes\", \"filter\": \".tscn\"}" "14")
test_result "List project files" $(echo "$response" | grep -q "test_framework\|tscn" && echo 0 || echo 1)
echo ""

# ============================================================================
# SECTION 7: PROJECT SETTINGS
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 7: Project Settings${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Get project setting
echo -e "${YELLOW}[7.1]${NC} Getting project setting..."
response=$(tool_call "godot_project_get_setting" "{\"setting_name\": \"application/config/name\"}" "15")
test_result "Get project setting" $(echo "$response" | grep -q "MCP Server Example\|result" && echo 0 || echo 1)
echo ""

# List project settings
echo -e "${YELLOW}[7.2]${NC} Listing project settings..."
response=$(tool_call "godot_project_list_settings" "{\"prefix\": \"application/\"}" "16")
test_result "List project settings" $(echo "$response" | grep -q "config/name\|result" && echo 0 || echo 1)
echo ""

# ============================================================================
# SECTION 8: INPUT MANAGEMENT
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 8: Input Management${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# List input actions
echo -e "${YELLOW}[8.1]${NC} Listing input actions..."
response=$(tool_call "godot_input_list_actions" "{}" "17")
test_result "List input actions" $(echo "$response" | grep -q "ui_accept\|ui_" && echo 0 || echo 1)
echo ""

# Get specific action
echo -e "${YELLOW}[8.2]${NC} Getting specific input action..."
response=$(tool_call "godot_input_get_action" "{\"action_name\": \"ui_accept\"}" "18")
test_result "Get input action" $(echo "$response" | grep -q "ui_accept" && echo 0 || echo 1)
echo ""

# Add new action
echo -e "${YELLOW}[8.3]${NC} Adding new input action..."
response=$(tool_call "godot_input_add_action" "{\"action_name\": \"test_action\", \"deadzone\": 0.5}" "19")
test_result "Add input action" $(echo "$response" | grep -q "success" && echo 0 || echo 1)
echo ""

# Get input constants
echo -e "${YELLOW}[8.4]${NC} Getting input constants..."
response=$(tool_call "godot_input_get_constants" "{\"type\": \"keys\"}" "20")
test_result "Get input constants" $(echo "$response" | grep -q "KEY_A\|KEY_" && echo 0 || echo 1)
echo ""

# Add event to action
echo -e "${YELLOW}[8.5]${NC} Adding event to action..."
response=$(tool_call "godot_input_add_event" "{\"action_name\": \"test_action\", \"event\": {\"type\": \"key\", \"keycode\": 32, \"pressed\": true}}" "21")
test_result "Add event to action" $(echo "$response" | grep -q "success" && echo 0 || echo 1)
echo ""

# Remove action
echo -e "${YELLOW}[8.6]${NC} Removing input action..."
response=$(tool_call "godot_input_remove_action" "{\"action_name\": \"test_action\"}" "22")
test_result "Remove input action" $(echo "$response" | grep -q "success" && echo 0 || echo 1)
echo ""

# ============================================================================
# SECTION 9: EDITOR OUTPUT
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 9: Editor Output${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Get editor output
echo -e "${YELLOW}[9.1]${NC} Getting editor output..."
response=$(tool_call "godot_editor_get_output" "{\"max_lines\": 50}" "23")
test_result "Get editor output" $(echo "$response" | grep -q "result\|output" && echo 0 || echo 1)
echo ""

# ============================================================================
# SECTION 10: SCENE PLAYBACK
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 10: Scene Playback${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Play scene
echo -e "${YELLOW}[10.1]${NC} Starting scene playback..."
response=$(tool_call "godot_game_play_scene" "{\"enable_runtime_api\": true}" "24")
test_result "Play scene" $(echo "$response" | grep -q "success" && echo 0 || echo 1)
sleep 2
echo ""

# Get screenshot
echo -e "${YELLOW}[10.2]${NC} Capturing screenshot..."
response=$(tool_call "godot_game_get_screenshot" "{\"max_width\": 800, \"max_height\": 600}" "25")
test_result "Capture screenshot" $(echo "$response" | grep -q "result\|data" && echo 0 || echo 1)
echo ""

# Stop scene
echo -e "${YELLOW}[10.3]${NC} Stopping scene playback..."
response=$(tool_call "godot_game_stop_scene" "{}" "26")
test_result "Stop scene" $(echo "$response" | grep -q "success" && echo 0 || echo 1)
echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

PERCENT=$((PASSED * 100 / TOTAL))

echo ""
echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Success Rate: $PERCENT%"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              ALL TESTS PASSED! ✓                          ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║        SOME TESTS FAILED - PLEASE REVIEW ABOVE            ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
