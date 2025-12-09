import { InstanceManager } from '../src/instance-manager.js';
import { EditorApiClient } from '../src/editor-api-client.js';
import path from 'path';
import fs from 'fs';

const PROJECT_PATH = path.resolve('example_project');

async function test() {
    console.log("=== Godot MCP Unified Server Integration Test ===");

    if (!fs.existsSync(PROJECT_PATH)) {
        console.error("Example project not found at:", PROJECT_PATH);
        console.log("Please modify PROJECT_PATH in test/integration.js to point to a valid Godot project.");
        return;
    }

    const mgr = new InstanceManager();
    console.log(`[Test] Launching project: ${PROJECT_PATH}`);

    try {
        const instance = await mgr.launchInstance(PROJECT_PATH);
        console.log(`[Test] Launched ID: ${instance.id}`);
        console.log(`[Test] Ports:`, instance.ports);

        console.log("[Test] Waiting 15s for Godot to initialize...");
        // Increase wait time as first launch might import assets
        await new Promise(r => setTimeout(r, 15000));

        const client = new EditorApiClient('127.0.0.1', instance.ports.editorApi);
        console.log("[Test] Checking health...");

        const isHealthy = await client.healthCheck();
        if (isHealthy) {
            console.log("[Test] Health Check PASSED!");

            console.log("[Test] Fetching Current Scene...");
            try {
                const scene = await client.getCurrentScene();
                console.log("[Test] Current Scene Data:", scene);
            } catch (e) {
                console.log("[Test] Could not fetch scene (maybe none open?). Error:", e.message);
            }

            console.log("[Test] Fetching Output Logs...");
            try {
                const logs = await client.readEditorLogs(5);
                console.log("[Test] Recent Logs:", logs);
            } catch (e) {
                console.log("[Test] Could not fetch logs:", e.message);
            }

        } else {
            console.error("[Test] Health Check FAILED - Editor API not responding.");
            console.error("[Test] Ensure 'godot' is in your PATH and the project imported successfully.");
        }

    } catch (e) {
        console.error("[Test] Error during test:", e);
    } finally {
        console.log("[Test] Terminating instances...");
        const instances = mgr.listInstances();
        for (const i of instances) {
            await mgr.terminateInstance(i.id);
            console.log(`[Test] Terminated ${i.id}`);
        }
        console.log("[Test] Done.");
    }
}

test();
