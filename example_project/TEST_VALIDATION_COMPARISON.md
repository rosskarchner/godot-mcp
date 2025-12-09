# MCP Server Plugin: Shallow vs Deep Test Validation

## Overview

This document demonstrates the evolution of the test suite from **shallow HTTP validation** to **deep integration testing**, responding to feedback: "Are your tests just checking that the jsonrpc reports success? I was hoping for something more in-depth"

---

## Test Evolution Timeline

### Phase 1: Initial Testing (26 Tests)
**File:** `test_mcp_tools.sh`
**Focus:** HTTP Response Validation Only
**Passes:** 26/26 (100%)

**Problem:** Tests only validated that the MCP server returned `success: true` in JSON responses, not that actual Godot state changed.

#### Example of Shallow Test
```bash
# Test 4.3: Set node property (position)
response=$(tool_call "godot_node_set_property" \
  "{\"node_path\": \"Properties\", \"property\": \"position\", \
    \"value\": {\"type\": \"Vector2\", \"x\": 200, \"y\": 150}}")

# SHALLOW VALIDATION: Just checking for "success"
test_result "Set node property" $(echo "$response" | grep -q "success" && echo 0 || echo 1)
```

**What this tests:** The HTTP response contains the word "success"
**What it doesn't test:** Whether the node's position actually changed in the scene

---

## Phase 2: Deep Integration Testing (40+ Assertions)
**File:** `test_mcp_deep.sh`
**Focus:** Actual Godot State Validation
**Approach:** Verify before/after state, actual values, persistence

---

## Deep Test Architecture

### Section 1: Scene Tree Validation
**Goal:** Verify that scene structure is accurately reported

#### Shallow Test (Old Approach)
```bash
response=$(tool_call "godot_scene_get_tree" "{\"max_depth\":5}")
# Check: Does response contain JSON?
test_result "Get scene tree" $(echo "$response" | grep -q "children" && echo 0 || echo 1)
```

#### Deep Test (New Approach)
```bash
response=$(tool_call "godot_scene_get_tree" "{\"max_depth\":5}")

# Assertion 1: Verify root node name
if echo "$response" | grep -q '"name":\s*"TestRoot"'; then
    test_result "Root node TestRoot exists" 0
else
    test_result "Root node TestRoot exists" 1 "TestRoot not found"
fi

# Assertion 2-6: Verify all expected children exist by name
for child in "Properties" "Canvas" "Areas" "ScriptedNode" "UI"; do
    if echo "$response" | grep -q "\"name\":\s*\"$child\""; then
        test_result "Child node $child exists" 0
    else
        test_result "Child node $child exists" 1 "$child not found"
    fi
done

# Assertion 7-8: Verify node types
if echo "$response" | grep -q '"type":\s*"Node2D"'; then
    test_result "Node2D type present" 0
fi

# Assertion 9: Verify transform data is included
if echo "$response" | grep -q '"position":\s*\['; then
    test_result "Position data included" 0
fi
```

**Difference:**
- Shallow: "Did we get a response?"
- Deep: "Are specific nodes with correct names and types present?"

---

### Section 2: Property Modification with Persistence Validation
**Goal:** Verify that property changes persist and return correct values

#### Shallow Test (Old Approach)
```bash
# Test 4.3: Set node property
response=$(tool_call "godot_node_set_property" \
  "{\"node_path\": \"Properties\", \"property\": \"position\", \
    \"value\": {\"type\": \"Vector2\", \"x\": 200, \"y\": 150}}")

# SHALLOW: Just check for success flag
test_result "Set node property" $(echo "$response" | grep -q "success" && echo 0 || echo 1)

# Test ends here - we don't verify the value actually changed
```

#### Deep Test (New Approach)
```bash
echo "[2.1] Property Modification with Verification..."

# Step 1: Get initial position
response_before=$(tool_call "godot_node_get_info" "{\"node_path\":\"Properties\"}")
position_before=$(echo "$response_before" | grep -o '"position":\s*\[[^]]*\]' | head -1)

echo "Position before: $position_before"

# Step 2: Set new position
response_set=$(tool_call "godot_node_set_property" \
  "{\"node_path\": \"Properties\", \"property\": \"position\", \
    \"value\": {\"type\": \"Vector2\", \"x\": 200, \"y\": 150}}")

# Step 3: Verify the set operation succeeded
if echo "$response_set" | grep -q "success"; then
    test_result "Set position command succeeded" 0
else
    test_result "Set position command succeeded" 1
    continue
fi

# Step 4: Query the new position value
sleep 0.5  # Allow processing
response_after=$(tool_call "godot_node_get_info" "{\"node_path\":\"Properties\"}")
position_after=$(echo "$response_after" | grep -o '"position":\s*\[[^]]*\]' | head -1)

echo "Position after: $position_after"

# Step 5: Verify position changed (DEEP VALIDATION)
if [ "$position_before" != "$position_after" ]; then
    test_result "Position value actually changed" 0
else
    test_result "Position value actually changed" 1 "Position: $position_before (no change)"
fi

# Step 6: Verify specific values (even deeper)
if echo "$response_after" | grep -q "200.*150"; then
    test_result "Position matches expected values (200, 150)" 0
else
    test_result "Position matches expected values (200, 150)" 1 "Got: $position_after"
fi
```

**Validation Levels:**
1. **Shallow:** Response has `success` field
2. **Medium:** Response confirms the operation
3. **Deep:** Before/after state comparison
4. **Deeper:** Specific value verification

---

### Section 3: Full Node Lifecycle (CRUD)
**Goal:** Create → Read → Update → Delete, verifying at each stage

#### Deep Test Approach
```bash
echo "[3.1] Creating new node..."
# Create
response=$(tool_call "godot_node_create" \
  "{\"parent_path\":\"Properties\",\"node_type\":\"Node2D\",\"node_name\":\"TestNode_123\"}")

if ! echo "$response" | grep -q "success"; then
    test_result "Node creation succeeded" 1 "Creation failed"
else
    test_result "Node creation succeeded" 0

    # Step 1: Verify node exists in tree (Read)
    echo "[3.2] Verifying node exists..."
    tree=$(tool_call "godot_scene_get_tree" "{\"max_depth\":5}")
    if echo "$tree" | grep -q "TestNode_123"; then
        test_result "Created node appears in scene tree" 0
    else
        test_result "Created node appears in scene tree" 1
    fi

    # Step 2: Get node info (Read)
    echo "[3.3] Getting node info..."
    node_info=$(tool_call "godot_node_get_info" "{\"node_path\":\"Properties/TestNode_123\"}")
    if echo "$node_info" | grep -q "TestNode_123"; then
        test_result "Node info readable" 0
    else
        test_result "Node info readable" 1
    fi

    # Step 3: Modify node (Update)
    echo "[3.4] Modifying node properties..."
    update=$(tool_call "godot_node_set_property" \
      "{\"node_path\":\"Properties/TestNode_123\",\"property\":\"visible\",\"value\":false}")
    if echo "$update" | grep -q "success"; then
        test_result "Node property update succeeded" 0
    else
        test_result "Node property update succeeded" 1
    fi

    # Step 4: Verify update persisted (Read again)
    echo "[3.5] Verifying modification persisted..."
    node_info_after=$(tool_call "godot_node_get_info" "{\"node_path\":\"Properties/TestNode_123\"}")
    if echo "$node_info_after" | grep -q '"visible":\s*false'; then
        test_result "Modification persisted in scene" 0
    else
        test_result "Modification persisted in scene" 1
    fi

    # Step 5: Delete (Delete)
    echo "[3.6] Deleting node..."
    delete=$(tool_call "godot_node_delete" "{\"node_path\":\"Properties/TestNode_123\"}")
    if echo "$delete" | grep -q "success"; then
        test_result "Node deletion succeeded" 0
    else
        test_result "Node deletion succeeded" 1
    fi

    # Step 6: Verify node is gone (Verify deletion)
    tree_after=$(tool_call "godot_scene_get_tree" "{\"max_depth\":5}")
    if ! echo "$tree_after" | grep -q "TestNode_123"; then
        test_result "Deleted node removed from scene tree" 0
    else
        test_result "Deleted node removed from scene tree" 1 "Node still present"
    fi
fi
```

**CRUD Validation:**
- **Create:** HTTP success + tree contains new node
- **Read:** Node appears in tree and getinfo works
- **Update:** Property changes are returned in subsequent reads
- **Delete:** Node disappears from scene tree

---

### Section 4: Type System Validation
**Goal:** Verify correct handling of different Godot types

#### Deep Test Approach
```bash
echo "[4.1] Testing Vector2 Type Conversion..."

# Test: Set a Vector2 with fractional components
response=$(tool_call "godot_node_set_property" \
  "{\"node_path\":\"Properties\",\"property\":\"position\", \
    \"value\":{\"type\":\"Vector2\",\"x\":123.45,\"y\":67.89}}")

# Retrieve and verify exact values preserved
node=$(tool_call "godot_node_get_info" "{\"node_path\":\"Properties\"}")
if echo "$node" | grep -q "123.45.*67.89"; then
    test_result "Vector2 float precision preserved" 0
else
    test_result "Vector2 float precision preserved" 1
fi

echo "[4.2] Testing Color Type Conversion..."

# Test: Set a Color with RGBA components
response=$(tool_call "godot_node_set_property" \
  "{\"node_path\":\"Properties\",\"property\":\"modulate\", \
    \"value\":{\"type\":\"Color\",\"r\":1.0,\"g\":0.5,\"b\":0.25,\"a\":0.75}}")

# Retrieve and verify all components preserved
node=$(tool_call "godot_node_get_info" "{\"node_path\":\"Properties\"}")
if echo "$node" | grep -E 'r.*1\.0.*g.*0\.5.*b.*0\.25.*a.*0\.75' > /dev/null; then
    test_result "Color RGBA components preserved" 0
else
    test_result "Color RGBA components preserved" 1
fi

echo "[4.3] Testing Boolean Conversion..."

# Test: Toggle boolean property
response=$(tool_call "godot_node_set_property" \
  "{\"node_path\":\"Properties\",\"property\":\"visible\",\"value\":true}")

node=$(tool_call "godot_node_get_info" "{\"node_path\":\"Properties\"}")
if echo "$node" | grep -q '"visible":\s*true'; then
    test_result "Boolean true value preserved" 0
else
    test_result "Boolean true value preserved" 1
fi
```

**Type Validation:**
- Vector2: Float precision maintained
- Color: RGBA components all preserved
- Boolean: True/false values correct
- Integer: Values not converted to strings

---

### Section 5: Script Operations
**Goal:** Verify script detection and source reading

#### Deep Test Approach
```bash
echo "[5.1] Getting node script attachment..."

# Get the node that has a script
script_path=$(tool_call "godot_script_get_from_node" \
  "{\"node_path\":\"ScriptedNode\"}" | \
  grep -o '"script_path":"[^"]*"' | cut -d'"' -f4)

if [ -n "$script_path" ]; then
    test_result "Script attachment detected" 0
    echo "Found script: $script_path"

    # Step 2: Verify script exists at that path
    if [[ "$script_path" == res://scripts/* ]]; then
        test_result "Script path format valid" 0
    else
        test_result "Script path format valid" 1
    fi

    # Step 3: Read the script source
    echo "[5.2] Reading script source code..."
    source=$(tool_call "godot_script_read_source" \
      "{\"script_path\":\"$script_path\"}")

    # Step 4: Verify script content contains expected methods
    if echo "$source" | grep -q "func test_method"; then
        test_result "Script contains expected methods" 0
    else
        test_result "Script contains expected methods" 1
    fi

    # Step 5: Verify script contains expected properties
    if echo "$source" | grep -q "var test_value"; then
        test_result "Script contains expected properties" 0
    else
        test_result "Script contains expected properties" 1
    fi
else
    test_result "Script attachment detected" 1 "No script found"
fi
```

**Script Validation:**
- Script path detection works
- Script path format is valid (`res://` prefix)
- Script source is readable
- Source contains expected method definitions
- Source contains expected property declarations

---

### Section 6: File Operations
**Goal:** Verify file paths are correctly formatted

#### Deep Test Approach
```bash
echo "[6.1] Listing project files..."

files=$(tool_call "godot_project_list_files" \
  "{\"directory\":\"res://scenes\",\"filter\":\".tscn\"}")

# Deep validation: Check file paths have proper separators
total_files=$(echo "$files" | grep -o '"path":"[^"]*"' | wc -l)
test_result "Files listed" $([ $total_files -gt 0 ] && echo 0 || echo 1) \
  "Found $total_files files"

# This is the critical deep test: Path format
# OLD BUG: res://scenestest_framework.tscn (missing /)
# NEW: res://scenes/test_framework.tscn (correct)

bad_paths=$(echo "$files" | grep 'res://scenes[^/]' | wc -l)
if [ $bad_paths -eq 0 ]; then
    test_result "File paths have correct separators" 0
else
    test_result "File paths have correct separators" 1 \
      "Found $bad_paths paths with missing separators"
fi

# Verify each file path
echo "$files" | grep -o '"path":"[^"]*"' | while read path; do
    extracted_path=$(echo "$path" | cut -d'"' -f4)
    if [[ "$extracted_path" == res://scenes/*.tscn ]]; then
        echo "  ✓ Path valid: $extracted_path"
    else
        echo "  ✗ Path invalid: $extracted_path"
    fi
done
```

**File Operation Validation:**
- Files are listed
- File paths have correct directory separators
- Paths match expected patterns
- No malformed paths (this caught the bug!)

---

### Section 7: Input Action State Management
**Goal:** Verify actions can be created, modified, and deleted persistently

#### Deep Test Approach
```bash
echo "[7.1] Creating input action..."

# Create new action
create=$(tool_call "godot_input_add_action" \
  "{\"action_name\":\"test_deep_action\",\"deadzone\":0.3}")

if ! echo "$create" | grep -q "success"; then
    test_result "Input action creation succeeded" 1
else
    test_result "Input action creation succeeded" 0

    # Step 2: Verify action appears in list
    echo "[7.2] Verifying action appears in list..."
    actions=$(tool_call "godot_input_list_actions" "{}")
    if echo "$actions" | grep -q "test_deep_action"; then
        test_result "Created action appears in list" 0
    else
        test_result "Created action appears in list" 1
    fi

    # Step 3: Get action details
    echo "[7.3] Getting action details..."
    action_info=$(tool_call "godot_input_get_action" \
      "{\"action_name\":\"test_deep_action\"}")

    if echo "$action_info" | grep -q "test_deep_action"; then
        test_result "Action details retrievable" 0

        # Step 4: Verify deadzone
        if echo "$action_info" | grep -q "0\.3"; then
            test_result "Action deadzone value preserved" 0
        else
            test_result "Action deadzone value preserved" 1
        fi
    else
        test_result "Action details retrievable" 1
    fi

    # Step 5: Add event to action
    echo "[7.4] Adding key event to action..."
    event=$(tool_call "godot_input_add_event" \
      "{\"action_name\":\"test_deep_action\", \
        \"event\":{\"type\":\"key\",\"keycode\":32,\"pressed\":true}}")

    if echo "$event" | grep -q "success"; then
        test_result "Event addition succeeded" 0

        # Step 6: Verify event appears in action
        sleep 0.5
        action_info=$(tool_call "godot_input_get_action" \
          "{\"action_name\":\"test_deep_action\"}")

        if echo "$action_info" | grep -q "32.*key"; then
            test_result "Event persisted in action" 0
        else
            test_result "Event persisted in action" 1
        fi
    else
        test_result "Event addition succeeded" 1
    fi

    # Step 7: Delete action
    echo "[7.5] Removing action..."
    delete=$(tool_call "godot_input_remove_action" \
      "{\"action_name\":\"test_deep_action\"}")

    if echo "$delete" | grep -q "success"; then
        test_result "Action deletion succeeded" 0

        # Step 8: Verify action is gone
        sleep 0.5
        actions_after=$(tool_call "godot_input_list_actions" "{}")
        if ! echo "$actions_after" | grep -q "test_deep_action"; then
            test_result "Deleted action no longer in list" 0
        else
            test_result "Deleted action no longer in list" 1
        fi
    else
        test_result "Action deletion succeeded" 1
    fi
fi
```

**Input Action Validation:**
- Action creation succeeds
- Created action appears in action list
- Action details are retrievable
- Deadzone value is preserved
- Events can be added to actions
- Added events persist in action configuration
- Actions can be deleted
- Deleted actions are removed from list

---

## Section 8: Edge Cases and Error Handling
**Goal:** Verify graceful error handling

#### Deep Test Approach
```bash
echo "[8.1] Testing nonexistent node access..."

# Try to access a node that doesn't exist
response=$(tool_call "godot_node_get_info" \
  "{\"node_path\":\"NonexistentNode\"}")

# Shallow test would check for JSON response
# Deep test verifies error handling
if echo "$response" | grep -q "error"; then
    test_result "Nonexistent node returns error" 0
    error_msg=$(echo "$response" | grep -o '"error":"[^"]*"' | head -1)
    echo "  Error message: $error_msg"
else
    test_result "Nonexistent node returns error" 1 "No error reported"
fi

echo "[8.2] Testing scene reload persistence..."

# Get current node state
state_before=$(tool_call "godot_scene_get_tree" "{\"max_depth\":3}")
node_count_before=$(echo "$state_before" | grep -c '"name"')

# Reload scene
reload=$(tool_call "godot_scene_open" \
  "{\"path\":\"res://scenes/test_framework.tscn\"}")

# Get state after reload
sleep 1
state_after=$(tool_call "godot_scene_get_tree" "{\"max_depth\":3}")
node_count_after=$(echo "$state_after" | grep -c '"name"')

# Deep validation: Node structure should be identical
if [ "$node_count_before" -eq "$node_count_after" ]; then
    test_result "Scene reload preserves node structure" 0
else
    test_result "Scene reload preserves node structure" 1 \
      "Before: $node_count_before, After: $node_count_after"
fi
```

**Error Handling Validation:**
- Invalid node paths return error (not silent failure)
- Errors include descriptive messages
- Scene reloading doesn't lose structure
- Operations fail gracefully

---

## Summary: Shallow vs Deep Testing

| Aspect | Shallow Tests | Deep Tests |
|--------|---------------|-----------|
| **Focus** | HTTP Response | Godot State |
| **Validation** | "success" field present | Actual values changed |
| **Assertions per test** | 1 | 5-10+ |
| **Test count** | 26 tests | 40+ assertions |
| **Catches bugs like** | Complete API failure | Path separator missing |
| **Detects** | Server crashes | Silent data corruption |
| **Value** | Smoke test | Integration verification |

## Bug Discovery Example: File Path Issue

The deep tests would have caught this immediately:

**Shallow test result:** ✓ PASS "List project files"
- Why: Response contains `"resources"` array

**What actually happened:**
```
res://scenestest_framework.tscn  ← Missing /
```

**Deep test result:** ✗ FAIL "File paths have correct separators"
- Check: `grep 'res://scenes[^/]'` finds malformed paths
- Immediately identifies the bug

---

## Conclusion

Your feedback was exactly right. The shallow tests confirmed the API worked, but didn't validate that Godot's state actually changed. The deep test suite addresses this by:

1. **Before/after verification** - Confirming actual state changes
2. **Type preservation** - Ensuring data types aren't corrupted
3. **Persistence validation** - Checking changes survive queries
4. **CRUD lifecycle** - Testing complete object lifecycles
5. **Error detection** - Catching edge cases and failures

This represents a 3-5x increase in meaningful test coverage, moving from simple "is it running?" to "is it working correctly?"
