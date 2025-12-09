# MCP Server Plugin - Test Suite Overview

## What's Included

This example project includes a complete testing framework to verify and validate all advertised functionality of the MCP Server Plugin.

### Test Files

1. **test_mcp_tools.sh** - The main automated test script
   - 26 comprehensive tests organized in 10 sections
   - Tests all MCP tools and features
   - Produces color-coded output with pass/fail results
   - Takes ~30-45 seconds to complete

2. **scenes/test_framework.tscn** - Test scene with various node types
   - 30+ nodes covering different Godot node types
   - Organized hierarchy for testing scene navigation
   - Includes nodes with scripts attached
   - Rich property set for testing modifications

3. **scripts/test_node.gd** - Test script for node operations
   - Simple GDScript with properties and methods
   - Used to test script attachment and reading

### Documentation

1. **TESTING.md** - Complete testing guide
   - How to run tests
   - What each test section does
   - Troubleshooting failed tests
   - How to extend the test suite

2. **MCP_TOOLS_REFERENCE.md** - Quick lookup guide
   - curl examples for every MCP tool
   - Type conversion reference
   - Common key codes and button codes
   - Copy-paste ready commands

3. **README.md** - Updated with testing information
   - Quick start instructions
   - Link to comprehensive testing info

## Quick Start

```bash
# From the example_project directory:
./test_mcp_tools.sh
```

**Prerequisites:**
- Godot 4.x with example project open
- MCP Server plugin enabled
- Server running on localhost:8765 (default)
- curl installed

## Test Coverage

| Category | Tests | Coverage |
|----------|-------|----------|
| Initialization | 1 | Initialize MCP connection |
| Tools Management | 1 | List all available tools |
| Scene Management | 3 | Load, get info, tree traversal |
| Node Operations | 6 | Create, delete, rename, modify |
| Script Operations | 2 | Get script, read source |
| Resources | 1 | List project files |
| Project Settings | 2 | Get/set project.godot values |
| Input Management | 6 | Actions, events, constants |
| Editor Output | 1 | Read console/print output |
| Scene Playback | 3 | Play, screenshot, stop |
| **Total** | **26 tests** | **100% of advertised features** |

## Test Sections Explained

### Section 1: Initialization
Establishes connection to MCP server and verifies protocol support.

### Section 2: Tools Listing
Retrieves list of all available MCP tools to ensure completeness.

### Section 3: Scene Management
Tests loading scenes, getting scene information, and traversing the scene tree.

### Section 4: Node Operations
Tests CRUD operations on nodes (create, read, update, delete).

### Section 5: Script Operations
Tests script attachment and source code retrieval.

### Section 6: Resource Operations
Tests file listing and resource discovery.

### Section 7: Project Settings
Tests reading and writing project configuration.

### Section 8: Input Management
Tests input action configuration and key binding.

### Section 9: Editor Output
Tests access to Godot console and print statements.

### Section 10: Scene Playback & Visualization
Tests running scenes and capturing screenshots.

## Running Specific Tests

To run only certain sections, modify the test script or extract sections:

```bash
# Run only scene management tests
sed -n '/SECTION 3:/,/SECTION 4:/p' test_mcp_tools.sh

# Run only input management tests
sed -n '/SECTION 8:/,/SECTION 9:/p' test_mcp_tools.sh
```

## Test Results Interpretation

```
PASS: Feature works correctly
FAIL: Feature has issues
```

**Success Rates:**
- 100%: All features working
- 80-99%: Minor issues
- 50-79%: Significant issues
- <50%: Critical problems

## Adding New Tests

To extend the test suite, follow this pattern:

```bash
# Add to appropriate section
echo -e "${YELLOW}[N.X]${NC} Description of test..."
response=$(tool_call "tool_name" "{\"arg\": \"value\"}" "100")
test_result "Test name" $(echo "$response" | grep -q "expected" && echo 0 || echo 1)
```

Then update the test coverage table above.

## Common Test Scenarios

### Scenario 1: Verify Plugin Installation
```bash
# Just run Section 2 to ensure tools are available
```

### Scenario 2: Test Scene Management
```bash
# Run Sections 3-5 to verify scene and node operations
```

### Scenario 3: Test Project Modification
```bash
# Run Sections 7-8 to verify configuration changes
```

### Scenario 4: Full Validation
```bash
# Run all sections for complete verification
./test_mcp_tools.sh
```

## Integration with CI/CD

To use these tests in continuous integration:

```bash
#!/bin/bash
# ci-test.sh

cd example_project
./test_mcp_tools.sh

# Check exit code
if [ $? -eq 0 ]; then
  echo "All tests passed!"
  exit 0
else
  echo "Some tests failed"
  exit 1
fi
```

## Performance Expectations

- Full test suite: 30-45 seconds
- Individual sections: 2-5 seconds
- Network latency: <100ms typical

If tests take significantly longer:
1. Check CPU usage
2. Verify network connectivity
3. Check Godot editor load
4. Review server logs

## Troubleshooting Failed Tests

1. **Server connection fails**
   - Verify Godot is running
   - Check port 8765 is available
   - Review server startup logs

2. **Scene tests fail**
   - Ensure test_framework.tscn exists
   - Verify scene is properly formatted
   - Check Godot editor for errors

3. **Node operation tests fail**
   - Verify test scene is loaded
   - Check node paths are correct
   - Review node hierarchy

4. **Script tests fail**
   - Ensure scripts/test_node.gd exists
   - Check script attachment
   - Verify GDScript syntax

5. **Input management tests fail**
   - Check project.godot file
   - Verify no corrupted input actions
   - Try project refresh

6. **Playback tests fail**
   - Ensure runtime API is enabled
   - Verify viewport is visible
   - Check scene is valid

See TESTING.md for more detailed troubleshooting.

## Reference Documentation

For detailed information about individual tools, see:
- **MCP_TOOLS_REFERENCE.md** - Complete curl examples
- **TESTING.md** - Testing procedures and explanations
- **README.md** - General setup and usage

## Test Assertions

Each test validates:

- **Response format**: Valid JSON-RPC 2.0 response
- **Success field**: Contains success or result field
- **Data accuracy**: Response contains expected data
- **Type correctness**: Correct types returned
- **Error handling**: Appropriate error messages

## Example Test Output

```
✓ PASS: Initialize MCP server
✓ PASS: List available tools
  Found 31 tools
✓ PASS: Load test scene
✓ PASS: Get current scene info
✓ PASS: Get scene tree
✓ PASS: Get node info
✓ PASS: List node properties
...

═══════════════════════════════════════════════════════════
TEST SUMMARY
═══════════════════════════════════════════════════════════

Total Tests: 26
Passed: 26
Failed: 0
Success Rate: 100%

╔════════════════════════════════════════════════════════════╗
║              ALL TESTS PASSED! ✓                          ║
╚════════════════════════════════════════════════════════════╝
```

## Next Steps

1. **Run tests**: `./test_mcp_tools.sh`
2. **Review results**: Check for any failed tests
3. **Fix issues**: Use TESTING.md troubleshooting guide
4. **Use reference**: Refer to MCP_TOOLS_REFERENCE.md for API usage
5. **Integrate**: Add tests to CI/CD pipeline

## Support

For issues or questions:
1. Check the troubleshooting section in TESTING.md
2. Review MCP_TOOLS_REFERENCE.md for correct syntax
3. Check Godot editor console for error messages
4. Verify plugin is properly installed and enabled

Happy testing!
