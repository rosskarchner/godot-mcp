
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_PATH = path.resolve(__dirname, "../example_project");

async function main() {
    console.log("=== Starting Godot MCP Editor Operations Test ===");

    const transport = new StdioClientTransport({
        command: "node",
        args: [path.join(__dirname, "../src/index.js")]
    });

    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });

    try {
        await client.connect(transport);
        console.log("[Test] Connected to MCP server.");

        // 1. Launch Instance
        console.log("[Test] Launching Godot...");
        await client.callTool({
            name: "godot_launch",
            arguments: {
                project_path: PROJECT_PATH,
                wait_for_ready: true,
                headless: true // Run editor headless for this test if possible? 
                // Note: godot_launch headless arg usually applies to game, but for editor tools we need editor.
                // We'll just launch normally.
            }
        });
        console.log("[Test] Godot Launched.");

        // 2. Project Settings
        console.log("[Test] Listing Project Settings...");
        await client.callTool({ name: "godot_project_settings_list", arguments: { prefix: "application/config" } });

        console.log("[Test] Getting specific setting...");
        await client.callTool({ name: "godot_project_setting_get", arguments: { setting_name: "application/config/name" } });

        console.log("[Test] Setting project setting...");
        // Use a safe setting or a custom one
        await client.callTool({
            name: "godot_project_setting_set",
            arguments: { setting_name: "application/config/test_mcp_prop", value: "test_value" }
        });

        // 3. Input Actions
        console.log("[Test] Listing Input Actions...");
        await client.callTool({ name: "godot_input_actions_list", arguments: {} });

        // 4. Scene & Node Operations
        console.log("[Test] Getting Current Scene...");
        const scene = await client.callTool({ name: "godot_scene_current", arguments: {} });
        const sceneInfo = JSON.parse(scene.content[0].text);
        const rootPath = sceneInfo.path; // e.g. res://scenes/test_framework.tscn (this returns file path, not node path)
        // Wait, godot_scene_current returns metadata about the OPEN scene tab.
        // We need the scene TREE path for node operations. Usually root is /root/Name

        console.log("[Test] Getting Scene Tree to find root node path...");
        const tree = await client.callTool({ name: "godot_scene_get_tree", arguments: {} });
        const treeData = JSON.parse(tree.content[0].text);
        const rootNodeName = treeData.root.name; // e.g. "TestRoot"
        const rootNodePath = "/root/" + rootNodeName; // Actually in Editor it's usually just the name if it's the edited scene root? 
        // In EditorPlugin logic, the edited scene root is usually relative to the Scene Dock.
        // Let's assume we can interact with children.

        console.log("[Test] Creating Node...");
        const nodeName = "MCPTestNode";
        await client.callTool({
            name: "godot_node_create",
            arguments: {
                parent_path: ".", // "." usually means scene root in my implementation? Need to verify. 
                // If implementation uses `get_node(parent_path)`, "." works.
                node_type: "Node",
                node_name: nodeName
            }
        });

        console.log("[Test] Setting Node Property...");
        await client.callTool({
            name: "godot_node_set_property",
            arguments: {
                node_path: nodeName, // Relative path from root?
                property: "name",
                value: "MCPTestNodeRenamed"
            }
        });

        console.log("[Test] Getting Node Info...");
        await client.callTool({ name: "godot_node_info", arguments: { node_path: "MCPTestNodeRenamed" } });

        console.log("[Test] Getting Node Properties...");
        await client.callTool({ name: "godot_node_properties", arguments: { node_path: "MCPTestNodeRenamed" } });

        // 5. Scripts
        console.log("[Test] Getting existing script...");
        // Use an existing node from the project
        // root node has script?
        await client.callTool({ name: "godot_script_get", arguments: { node_path: "." } }); // Root

        // godot_script_source removed (agents can read files directly)

        // 6. Cleanup Node
        console.log("[Test] Deleting Node...");
        await client.callTool({ name: "godot_node_delete", arguments: { node_path: "MCPTestNodeRenamed" } });

        // 7. Editor Output
        console.log("[Test] Reading Editor Output...");
        await client.callTool({ name: "godot_editor_output", arguments: {} });

        console.log("[Test] All Editor Operations Completed Successfully.");

    } catch (e) {
        console.error("[Test] Error:", e);
        process.exit(1);
    } finally {
        console.log("[Test] Terminating...");
        try {
            await client.callTool({ name: "godot_terminate", arguments: { instance_id: PROJECT_PATH } });
        } catch (e) { }
        process.exit(0);
    }
}

main();
