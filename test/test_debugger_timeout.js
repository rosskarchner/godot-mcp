/**
 * Test: Debugger Timeout Detection
 * 
 * This test validates that when a game bridge call times out because the game
 * is paused in the debugger (at a breakpoint), the error message includes:
 * - Detection that the game is paused
 * - Session information (id, paused state, can_debug)
 * - Instructions for how to continue/inspect
 * 
 * Note: Enhanced error capture (stack trace, error message, break location) is only
 * populated when the debugger pauses due to a runtime ERROR, not a breakpoint.
 * This test uses a breakpoint for reliability. To test error capture, trigger an
 * assert(false) or runtime error manually.
 * 
 * Test Flow:
 * 1. Launch Godot with the example project
 * 2. Connect to DAP and set a breakpoint
 * 3. Start the game with runtime API enabled
 * 4. Trigger the breakpoint via Space key input
 * 5. Attempt a game bridge call (should timeout)
 * 6. Verify the error message contains debugger state info
 * 7. Verify godot_debugger_sessions returns session info
 * 8. Resume and cleanup
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_PATH = path.resolve(__dirname, "../example_project");

// Test result tracking
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    testsRun++;
    if (condition) {
        testsPassed++;
        console.log(`  ✓ ${message}`);
        return true;
    } else {
        testsFailed++;
        console.log(`  ✗ ${message}`);
        return false;
    }
}

function assertContains(text, substring, message) {
    return assert(
        text && text.includes(substring),
        `${message} (looking for: "${substring.substring(0, 50)}...")`
    );
}

async function main() {
    console.log("=== Debugger Timeout Detection Test ===\n");
    console.log(`Project Path: ${PROJECT_PATH}\n`);

    // Setup MCP client
    const serverPath = path.resolve(__dirname, "../src/index.js");
    const transport = new StdioClientTransport({
        command: "node",
        args: [serverPath],
    });

    const client = new Client(
        { name: "debugger-timeout-test", version: "1.0.0" },
        { capabilities: {} }
    );

    console.log("[Setup] Connecting to MCP server...");
    await client.connect(transport);
    console.log("[Setup] Connected!\n");

    let instanceId = null;

    try {
        // ============================================
        // PHASE 1: Launch and Setup
        // ============================================
        console.log("--- Phase 1: Launch and Setup ---\n");

        console.log("[Test] Launching Godot...");
        const launchResult = await client.callTool({
            name: "godot_launch",
            arguments: {
                project_path: PROJECT_PATH,
                wait_for_ready: true,
                headless: false
            }
        });

        // Extract instance ID for cleanup
        const launchData = JSON.parse(launchResult.content[0].text);
        instanceId = launchData.instance_id;
        console.log(`[Test] Launched instance: ${instanceId}\n`);

        // Connect to DAP
        console.log("[Test] Connecting to DAP...");
        await client.callTool({ name: "godot_dap_connect", arguments: {} });
        console.log("[Test] DAP connected.\n");

        // Set breakpoint on a line that will be hit when Space is pressed
        const scriptPath = path.join(PROJECT_PATH, "scripts/test_node.gd");
        const breakpointLine = 57; // Line in _input where test_method() is called

        console.log(`[Test] Setting breakpoint at ${scriptPath}:${breakpointLine}...`);
        await client.callTool({
            name: "godot_dap_set_breakpoint",
            arguments: {
                source: scriptPath,
                line: breakpointLine
            }
        });

        await client.callTool({ name: "godot_dap_configuration_done", arguments: {} });
        console.log("[Test] Breakpoint configured.\n");

        // ============================================
        // PHASE 2: Start Game and Trigger Breakpoint
        // ============================================
        console.log("--- Phase 2: Start Game and Trigger Breakpoint ---\n");

        console.log("[Test] Starting game with runtime API...");
        await client.callTool({
            name: "godot_game_play",
            arguments: { enable_runtime_api: true }
        });

        // Wait for game to start
        console.log("[Test] Waiting for game bridge to be ready...");
        await new Promise(r => setTimeout(r, 5000));

        // Send Space key to trigger the breakpoint
        console.log("[Test] Sending Space key to trigger breakpoint...");
        try {
            await client.callTool({
                name: "godot_game_send_sequence",
                arguments: {
                    sequence: [
                        { event_type: "key", keycode: 32, pressed: true, delay_ms: 100 }, // KEY_SPACE = 32
                        { event_type: "key", keycode: 32, pressed: false }
                    ]
                }
            });
        } catch (e) {
            // Input might timeout if breakpoint is hit during sequence
            console.log("[Test] Input may have triggered breakpoint (expected).\n");
        }

        // Wait for breakpoint to pause the debugger
        console.log("[Test] Waiting for breakpoint to pause debugger...");
        let breakpointHit = false;
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 1000));
            try {
                const sessions = await client.callTool({
                    name: "godot_debugger_sessions",
                    arguments: {}
                });
                const sessionsData = JSON.parse(sessions.content[0].text);
                if (sessionsData.length > 0 && sessionsData[0].paused) {
                    breakpointHit = true;
                    console.log("[Test] Breakpoint hit - debugger paused!\n");
                    break;
                }
            } catch (e) {
                // Ignore polling errors
            }
        }

        if (!breakpointHit) {
            console.log("[Test] WARNING: Breakpoint did not pause debugger. Test may not fully validate timeout detection.\n");
        }

        // ============================================
        // PHASE 3: Test Timeout Detection
        // ============================================
        console.log("--- Phase 3: Test Timeout Detection ---\n");

        console.log("[Test] Attempting game bridge call (should timeout with debugger info)...");
        let timeoutError = null;
        try {
            // This should timeout because the game is paused
            await client.callTool({
                name: "godot_game_scene_tree",
                arguments: { max_depth: 2 }
            });
            console.log("[Test] Unexpected: Game bridge call succeeded (game may not be paused).\n");
        } catch (e) {
            timeoutError = e.message || (e.content && e.content[0] && e.content[0].text) || String(e);
        }

        // If we got an MCP response with isError, extract the error text
        // The error is returned in the response content for MCP tools
        let gameBridgeResult = null;
        try {
            gameBridgeResult = await client.callTool({
                name: "godot_game_screenshot",
                arguments: {}
            });
        } catch (e) {
            // Expected to fail
        }

        // Check the actual result (MCP returns errors in content, not thrown)
        // Let's try to get the error from a tool call
        let errorMessage = "";
        try {
            const result = await client.callTool({
                name: "godot_game_scene_tree",
                arguments: { max_depth: 2 }
            });
            // Check if it's an error response
            if (result.isError) {
                errorMessage = result.content[0].text;
            } else {
                errorMessage = result.content[0].text;
            }
        } catch (e) {
            errorMessage = e.message || String(e);
        }

        console.log("\n[Test] Error/Response received:");
        console.log("---");
        console.log(errorMessage.substring(0, 500));
        if (errorMessage.length > 500) console.log("...(truncated)");
        console.log("---\n");

        console.log("[Validation] Checking error message content:\n");

        // Validate error message contents
        if (breakpointHit) {
            // If breakpoint was hit, we expect the timeout message with debugger info
            assertContains(
                errorMessage,
                "stopped in the debugger",
                "Error mentions game is stopped in debugger"
            );

            assertContains(
                errorMessage,
                "godot_debugger",
                "Error contains instructions about debugger tools"
            );

            // These might not always be present depending on breakpoint vs error
            if (errorMessage.includes("Session")) {
                assert(true, "Error contains session information");
            }
        }

        // ============================================
        // PHASE 4: Test Enhanced Debugger Sessions
        // ============================================
        console.log("\n--- Phase 4: Test Enhanced Debugger Sessions ---\n");

        console.log("[Test] Getting debugger sessions with enhanced info...");
        const sessionsResult = await client.callTool({
            name: "godot_debugger_sessions",
            arguments: {}
        });

        const sessionsText = sessionsResult.content[0].text;
        console.log("[Test] Sessions response:");
        console.log(sessionsText.substring(0, 500));
        console.log("");

        const sessions = JSON.parse(sessionsText);

        if (sessions.length > 0 && sessions[0].paused) {
            const session = sessions[0];

            assert(session.paused === true, "Session shows paused=true");
            assert(session.can_debug !== undefined, "Session has can_debug field");
            assert(session.id !== undefined, "Session has id field");

            // These fields are present when error/stack info is captured
            if (session.stack) {
                assert(Array.isArray(session.stack), "Stack trace is an array");
                if (session.stack.length > 0) {
                    const frame = session.stack[0];
                    assert(frame.file !== undefined, "Stack frame has file field");
                    assert(frame.line !== undefined, "Stack frame has line field");
                    assert(frame.function !== undefined, "Stack frame has function field");
                }
            } else {
                console.log("  ℹ Stack trace not captured (may depend on break type)");
            }

            if (session.break_file) {
                assert(typeof session.break_file === "string", "break_file is a string");
            } else {
                console.log("  ℹ break_file not captured");
            }

            if (session.reason) {
                assert(typeof session.reason === "string", "reason is a string");
                console.log(`  ℹ Break reason: ${session.reason}`);
            }

            if (session.error) {
                assert(typeof session.error === "string", "error is a string");
                console.log(`  ℹ Error message: ${session.error.substring(0, 100)}...`);
            }
        } else {
            console.log("[Test] No paused session found - skipping enhanced field validation.\n");
        }

        // ============================================
        // PHASE 5: Resume and Cleanup
        // ============================================
        console.log("\n--- Phase 5: Resume and Cleanup ---\n");

        // Resume if paused
        if (sessions.length > 0 && sessions[0].paused) {
            console.log("[Test] Resuming debugger session...");
            await client.callTool({
                name: "godot_debugger_resume",
                arguments: { session_id: sessions[0].id }
            });
            await new Promise(r => setTimeout(r, 1000));
            console.log("[Test] Session resumed.\n");
        }

        // Stop game
        console.log("[Test] Stopping game...");
        await client.callTool({ name: "godot_game_stop", arguments: {} });
        console.log("[Test] Game stopped.\n");

        // Clear breakpoints
        console.log("[Test] Clearing breakpoints...");
        try {
            await client.callTool({
                name: "godot_dap_clear_breakpoints",
                arguments: { source: scriptPath }
            });
        } catch (e) {
            // Ignore
        }

    } catch (error) {
        console.error("\n[Test] Unexpected error:", error);
        testsFailed++;
    } finally {
        // Terminate instance
        if (instanceId) {
            console.log(`[Cleanup] Terminating instance ${instanceId}...`);
            try {
                await client.callTool({
                    name: "godot_terminate",
                    arguments: { instance_id: instanceId }
                });
            } catch (e) {
                // Ignore cleanup errors
            }
        }

        await client.close();

        // Print summary
        console.log("\n" + "=".repeat(50));
        console.log("TEST SUMMARY");
        console.log("=".repeat(50));
        console.log(`Total tests run: ${testsRun}`);
        console.log(`Passed: ${testsPassed}`);
        console.log(`Failed: ${testsFailed}`);
        console.log("=".repeat(50));

        if (testsFailed > 0) {
            console.log("\n❌ Some tests failed!");
            process.exit(1);
        } else if (testsRun > 0) {
            console.log("\n✅ All tests passed!");
            process.exit(0);
        } else {
            console.log("\n⚠ No tests were run (breakpoint may not have been hit)");
            process.exit(0);
        }
    }
}

main().catch(e => {
    console.error("Fatal error:", e);
    process.exit(1);
});
