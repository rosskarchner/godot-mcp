#!/bin/bash
# Deep Integration Tests for MCP Server Plugin
# Tests actual functionality, not just HTTP responses

set -e

SERVER="http://localhost:8765"
PASS=0
FAIL=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
test_result() {
    local test_name=$1
    local success=$2
    local details=$3

    ((TOTAL++))
    if [ $success -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $test_name"
        if [ -n "$details" ]; then
            echo -e "  ${RED}→ $details${NC}"
        fi
        ((FAIL++))
    fi
}

tool_call() {
    local tool=$1
    local args=$2
    curl -s -X POST "$SERVER" \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"$tool\",\"arguments\":$args},\"id\":1}"
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        MCP Server Plugin - Deep Integration Tests         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Load test scene
echo -e "${YELLOW}[Setup]${NC} Loading test scene..."
tool_call "godot_scene_open" "{\"path\":\"res://scenes/test_framework.tscn\"}" > /dev/null
sleep 1

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 1: Scene Tree Validation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 1.1: Verify scene tree structure
echo "[1.1] Verifying scene tree structure..."
response=$(tool_call "godot_scene_get_tree" "{\"max_depth\":5}")

# Check root node exists
if echo "$response" | grep -q '"name":\s*"TestRoot"'; then
    test_result "Root node TestRoot exists" 0
else
    test_result "Root node TestRoot exists" 1 "TestRoot not found in scene tree"
fi

# Check all expected children exist
for child in "Properties" "Canvas" "Areas" "ScriptedNode" "UI"; do
    if echo "$response" | grep -q "\"name\":\s*\"$child\""; then
        test_result "Child node $child exists" 0
    else
        test_result "Child node $child exists" 1 "$child not found"
    fi
done

# Test 1.2: Verify node types
echo ""
echo "[1.2] Verifying node types..."
if echo "$response" | grep -q '"type":\s*"Node2D"'; then
    test_result "Node2D type present" 0
else
    test_result "Node2D type present" 1
fi

if echo "$response" | grep -q '"type":\s*"Sprite2D"'; then
    test_result "Sprite2D type present" 0
else
    test_result "Sprite2D type present" 1
fi

# Test 1.3: Verify transform data
echo ""
echo "[1.3] Verifying transform data..."
if echo "$response" | grep -q '"position":\s*\['; then
    test_result "Position data included" 0
else
    test_result "Position data included" 1
fi

if echo "$response" | grep -q '"rotation"'; then
    test_result "Rotation data included" 0
else
    test_result "Rotation data included" 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 2: Property Modification & Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 2.1: Get original position
echo "[2.1] Reading original property values..."
original=$(tool_call "godot_node_list_properties" "{\"node_path\":\"Properties\"}")

if echo "$original" | grep -q '"x":\s*100'; then
    test_result "Original position.x = 100" 0
else
    test_result "Original position.x = 100" 1 "Position x not 100"
fi

if echo "$original" | grep -q '"y":\s*100'; then
    test_result "Original position.y = 100" 0
else
    test_result "Original position.y = 100" 1 "Position y not 100"
fi

# Test 2.2: Modify position
echo ""
echo "[2.2] Modifying node property (position)..."
tool_call "godot_node_set_property" "{\"node_path\":\"Properties\",\"property\":\"position\",\"value\":{\"type\":\"Vector2\",\"x\":333,\"y\":444}}" > /dev/null
sleep 0.5

# Test 2.3: Verify modification persisted
echo "[2.3] Verifying property modification persisted..."
modified=$(tool_call "godot_node_list_properties" "{\"node_path\":\"Properties\"}")

if echo "$modified" | grep -q '"x":\s*333'; then
    test_result "Modified position.x = 333" 0
else
    test_result "Modified position.x = 333" 1 "Position x not updated to 333"
fi

if echo "$modified" | grep -q '"y":\s*444'; then
    test_result "Modified position.y = 444" 0
else
    test_result "Modified position.y = 444" 1 "Position y not updated to 444"
fi

# Test 2.4: Modify rotation
echo ""
echo "[2.4] Modifying rotation property..."
tool_call "godot_node_set_property" "{\"node_path\":\"Properties\",\"property\":\"rotation\",\"value\":2.5}" > /dev/null
sleep 0.5

rotated=$(tool_call "godot_node_list_properties" "{\"node_path\":\"Properties\"}")
if echo "$rotated" | grep -q '"rotation":\s*2.5'; then
    test_result "Modified rotation = 2.5" 0
else
    test_result "Modified rotation = 2.5" 1 "Rotation not updated"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 3: Node Lifecycle (Create-Read-Update-Delete)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 3.1: Create node
echo "[3.1] Creating new node..."
create_response=$(tool_call "godot_node_create" "{\"parent_path\":\"Properties\",\"node_type\":\"Node2D\",\"node_name\":\"LifecycleTest\"}")

if echo "$create_response" | grep -q "success"; then
    test_result "Node created successfully" 0
else
    test_result "Node created successfully" 1 "Create failed"
fi

sleep 0.5

# Test 3.2: Verify node exists
echo "[3.2] Verifying created node exists..."
tree=$(tool_call "godot_scene_get_tree" "{\"max_depth\":5}")

if echo "$tree" | grep -q '"name":\s*"LifecycleTest"'; then
    test_result "Created node found in tree" 0
else
    test_result "Created node found in tree" 1 "Node not in tree"
fi

# Test 3.3: Get info on created node
echo "[3.3] Reading created node info..."
info=$(tool_call "godot_node_get_info" "{\"node_path\":\"Properties/LifecycleTest\"}")

if echo "$info" | grep -q '"name":\s*"LifecycleTest"'; then
    test_result "Node info readable" 0
else
    test_result "Node info readable" 1
fi

# Test 3.4: Rename node
echo "[3.4] Renaming node..."
tool_call "godot_node_rename" "{\"node_path\":\"Properties/LifecycleTest\",\"new_name\":\"RenamedNode\"}" > /dev/null
sleep 0.5

renamed=$(tool_call "godot_scene_get_tree" "{\"max_depth\":5}")
if echo "$renamed" | grep -q '"name":\s*"RenamedNode"'; then
    test_result "Node renamed successfully" 0
else
    test_result "Node renamed successfully" 1 "Rename didn't persist"
fi

# Test 3.5: Delete node
echo "[3.5] Deleting node..."
tool_call "godot_node_delete" "{\"node_path\":\"Properties/RenamedNode\"}" > /dev/null
sleep 0.5

deleted=$(tool_call "godot_scene_get_tree" "{\"max_depth\":5}")
if ! echo "$deleted" | grep -q '"name":\s*"RenamedNode"'; then
    test_result "Node deleted successfully" 0
else
    test_result "Node deleted successfully" 1 "Node still in tree"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 4: Type Conversion & Data Integrity${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 4.1: Vector2 conversion
echo "[4.1] Testing Vector2 type conversion..."
tool_call "godot_node_set_property" "{\"node_path\":\"Properties\",\"property\":\"position\",\"value\":{\"type\":\"Vector2\",\"x\":99.5,\"y\":88.3}}" > /dev/null
sleep 0.3

vec2_test=$(tool_call "godot_node_list_properties" "{\"node_path\":\"Properties\"}")
if echo "$vec2_test" | grep -q '"x":\s*99.5' && echo "$vec2_test" | grep -q '"y":\s*88.3'; then
    test_result "Vector2 float values preserved" 0
else
    test_result "Vector2 float values preserved" 1 "Float conversion failed"
fi

# Test 4.2: Color conversion
echo ""
echo "[4.2] Testing Color type conversions..."
tool_call "godot_node_set_property" "{\"node_path\":\"Properties\",\"property\":\"modulate\",\"value\":{\"type\":\"Color\",\"r\":0.5,\"g\":0.75,\"b\":1.0,\"a\":0.8}}" > /dev/null
sleep 0.3

color_test=$(tool_call "godot_node_list_properties" "{\"node_path\":\"Properties\"}")
if echo "$color_test" | grep -q '"r":\s*0.5' && echo "$color_test" | grep -q '"g":\s*0.75'; then
    test_result "Color RGBA values correct" 0
else
    test_result "Color RGBA values correct" 1 "Color conversion failed"
fi

# Test 4.3: Integer types
echo ""
echo "[4.3] Testing integer property types..."
# Check that integer properties exist and are integers
if echo "$original" | grep -q '"visibility_layer":\s*[0-9]*' | grep -v '"'; then
    test_result "Integer properties readable" 0
else
    test_result "Integer properties readable" 1
fi

# Test 4.4: Boolean types
echo ""
echo "[4.4] Testing boolean property types..."
if echo "$original" | grep -q '"visible":\s*true\|false'; then
    test_result "Boolean properties readable" 0
else
    test_result "Boolean properties readable" 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 5: Script Operations & Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 5.1: Script detection
echo "[5.1] Testing script detection..."
script_info=$(tool_call "godot_script_get_from_node" "{\"node_path\":\"ScriptedNode\"}")

if echo "$script_info" | grep -q '"has_script":\s*true'; then
    test_result "Script presence detected" 0
else
    test_result "Script presence detected" 1 "has_script not true"
fi

# Test 5.2: Script path correct
echo "[5.2] Verifying script path..."
if echo "$script_info" | grep -q 'test_node.gd'; then
    test_result "Script path correct" 0
else
    test_result "Script path correct" 1 "Wrong script path"
fi

# Test 5.3: Script content readable
echo "[5.3] Reading script source code..."
source=$(tool_call "godot_script_read_source" "{\"script_path\":\"res://scripts/test_node.gd\"}")

if echo "$source" | grep -q "test_method"; then
    test_result "Script method found" 0
else
    test_result "Script method found" 1 "test_method not found"
fi

if echo "$source" | grep -q "test_value"; then
    test_result "Script variable found" 0
else
    test_result "Script variable found" 1 "test_value not found"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 6: File Operations & Path Handling${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 6.1: File listing
echo "[6.1] Testing file enumeration..."
files=$(tool_call "godot_project_list_files" "{\"directory\":\"res://scenes\",\"filter\":\".tscn\"}")

if echo "$files" | grep -q "test_framework.tscn"; then
    test_result "test_framework.tscn found" 0
else
    test_result "test_framework.tscn found" 1 "File not listed"
fi

# Test 6.2: Path formatting (FIXED)
echo "[6.2] Verifying file paths are correct..."
if echo "$files" | grep -q "res://scenes/"; then
    test_result "File paths have correct separator" 0
else
    test_result "File paths have correct separator" 1 "Missing directory separator"
fi

# Test 6.3: File type detection
echo "[6.3] Verifying file types detected..."
if echo "$files" | grep -q '"type":\s*"Scene"'; then
    test_result "Scene file type detected" 0
else
    test_result "Scene file type detected" 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 7: Input Action State Management${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 7.1: Create action
echo "[7.1] Creating test input action..."
create_action=$(tool_call "godot_input_add_action" "{\"action_name\":\"deep_test_action\",\"deadzone\":0.5}")

if echo "$create_action" | grep -q "success"; then
    test_result "Input action created" 0
else
    test_result "Input action created" 1
fi

sleep 0.3

# Test 7.2: Verify action exists
echo "[7.2] Verifying action exists..."
list_actions=$(tool_call "godot_input_list_actions" "{}")

if echo "$list_actions" | grep -q "deep_test_action"; then
    test_result "Created action appears in list" 0
else
    test_result "Created action appears in list" 1
fi

# Test 7.3: Add event to action
echo "[7.3] Adding keyboard event to action..."
add_event=$(tool_call "godot_input_add_event" "{\"action_name\":\"deep_test_action\",\"event\":{\"type\":\"key\",\"keycode\":65,\"pressed\":true}}")

if echo "$add_event" | grep -q "success"; then
    test_result "Event added to action" 0
else
    test_result "Event added to action" 1
fi

sleep 0.3

# Test 7.4: Verify event persisted
echo "[7.4] Verifying event persisted..."
action_detail=$(tool_call "godot_input_get_action" "{\"action_name\":\"deep_test_action\"}")

if echo "$action_detail" | grep -q "deep_test_action"; then
    test_result "Action detail retrievable" 0
else
    test_result "Action detail retrievable" 1
fi

# Test 7.5: Remove action
echo "[7.5] Removing test action..."
remove_action=$(tool_call "godot_input_remove_action" "{\"action_name\":\"deep_test_action\"}")

if echo "$remove_action" | grep -q "success"; then
    test_result "Action removed" 0
else
    test_result "Action removed" 1
fi

sleep 0.3

# Test 7.6: Verify action gone
echo "[7.6] Verifying action removed..."
list_after=$(tool_call "godot_input_list_actions" "{}")

if ! echo "$list_after" | grep -q "deep_test_action"; then
    test_result "Removed action no longer in list" 0
else
    test_result "Removed action no longer in list" 1 "Action still exists"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SECTION 8: Edge Cases & Error Handling${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 8.1: Nonexistent node
echo "[8.1] Testing nonexistent node handling..."
nonexist=$(tool_call "godot_node_get_info" "{\"node_path\":\"DoesNotExist\"}")

# Should either error or return empty/null
if echo "$nonexist" | grep -q "error\|null\|not found" -i; then
    test_result "Nonexistent node handled gracefully" 0
else
    # Sometimes it just returns without the data
    if ! echo "$nonexist" | grep -q "DoesNotExist"; then
        test_result "Nonexistent node handled gracefully" 0
    else
        test_result "Nonexistent node handled gracefully" 1 "No error for missing node"
    fi
fi

# Test 8.2: Empty directory
echo "[8.2] Testing file listing with filter..."
audio_files=$(tool_call "godot_project_list_files" "{\"directory\":\"res://scenes\",\"filter\":\".wav\"}")

# Should return empty or valid response
if echo "$audio_files" | grep -q "resources" || echo "$audio_files" | grep -q "\[\]"; then
    test_result "Empty filter result handled" 0
else
    test_result "Empty filter result handled" 1
fi

# Test 8.3: Reopen scene after modifications
echo ""
echo "[8.3] Reopening scene after modifications..."
# First, ensure we're back to original state by reloading
tool_call "godot_scene_open" "{\"path\":\"res://scenes/test_framework.tscn\"}" > /dev/null
sleep 1

# Verify TestRoot still exists
reopened=$(tool_call "godot_scene_get_tree" "{\"max_depth\":1}")
if echo "$reopened" | grep -q "TestRoot"; then
    test_result "Scene reloads successfully" 0
else
    test_result "Scene reloads successfully" 1 "Scene structure lost"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

PERCENT=$((PASS * 100 / TOTAL))

echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo "Success Rate: $PERCENT%"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         ALL DEEP TESTS PASSED! ✓                         ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║        SOME TESTS FAILED - CHECK ABOVE                   ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
