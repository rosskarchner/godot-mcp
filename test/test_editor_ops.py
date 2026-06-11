#!/usr/bin/env python3
"""Editor operations test: launches a real Godot editor and exercises editor tools over MCP."""

import asyncio
import json
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

REPO_ROOT = Path(__file__).resolve().parents[1]
PROJECT_PATH = str(REPO_ROOT / "example_project")
SERVER_CMD = str(REPO_ROOT / ".venv" / "bin" / "godot-mcp-server")


def text_of(result):
    return result.content[0].text


async def call(session, name, args=None, expect_ok=True):
    result = await session.call_tool(name, args or {})
    if expect_ok and result.isError:
        raise RuntimeError(f"{name} failed: {text_of(result)}")
    return result


async def main():
    print("=== Starting Godot MCP Editor Operations Test ===")
    params = StdioServerParameters(command=SERVER_CMD)

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print("[Test] Connected to MCP server.")

            try:
                print("[Test] Launching Godot...")
                await call(session, "godot_launch", {
                    "project_path": PROJECT_PATH,
                    "wait_for_ready": True,
                })
                print("[Test] Godot Launched.")

                print("[Test] Listing Project Settings...")
                await call(session, "godot_project_settings_list",
                           {"prefix": "application/config"})

                print("[Test] Getting specific setting...")
                result = await call(session, "godot_project_setting_get",
                                    {"setting_name": "application/config/name"})
                print("[Test] Setting value:", text_of(result)[:120])

                print("[Test] Setting project setting...")
                await call(session, "godot_project_setting_set", {
                    "setting_name": "application/config/test_mcp_prop",
                    "value": "test_value",
                })

                print("[Test] Listing Input Actions...")
                await call(session, "godot_input_actions_list")

                print("[Test] Getting Current Scene...")
                scene = await call(session, "godot_scene_current")
                print("[Test] Current Scene:", text_of(scene)[:200])

                print("[Test] Getting Scene Tree...")
                tree = await call(session, "godot_scene_get_tree")
                tree_data = json.loads(text_of(tree))
                print("[Test] Scene root:", tree_data.get("root", {}).get("name"))

                print("[Test] Creating Node...")
                node_name = "MCPTestNode"
                await call(session, "godot_node_create", {
                    "parent_path": ".",
                    "node_type": "Node",
                    "node_name": node_name,
                })

                print("[Test] Setting Node Property...")
                await call(session, "godot_node_set_property", {
                    "node_path": node_name,
                    "property": "name",
                    "value": "MCPTestNodeRenamed",
                })

                print("[Test] Getting Node Info...")
                await call(session, "godot_node_info", {"node_path": "MCPTestNodeRenamed"})

                print("[Test] Getting Node Properties...")
                await call(session, "godot_node_properties", {"node_path": "MCPTestNodeRenamed"})

                print("[Test] Getting existing script...")
                await call(session, "godot_script_get", {"node_path": "."})

                print("[Test] Deleting Node...")
                await call(session, "godot_node_delete", {"node_path": "MCPTestNodeRenamed"})

                print("[Test] Reading Editor Output...")
                await call(session, "godot_editor_output")

                print("[Test] Listing dialogs (expect none)...")
                dialogs = await call(session, "godot_editor_dialogs")
                assert json.loads(text_of(dialogs))["count"] == 0, text_of(dialogs)

                print("[Test] play 'main' with bad scene fails fast (no modal)...")
                await call(session, "godot_project_setting_set", {
                    "setting_name": "application/run/main_scene", "value": "res://nope.tscn"})
                bad_play = await session.call_tool("godot_game_play", {"scene_mode": "main"})
                assert bad_play.isError and "does not exist" in text_of(bad_play), text_of(bad_play)
                # Guard should mean no modal popped
                dialogs2 = await call(session, "godot_editor_dialogs")
                assert json.loads(text_of(dialogs2))["count"] == 0, \
                    f"unexpected modal: {text_of(dialogs2)}"
                await call(session, "godot_project_setting_set", {
                    "setting_name": "application/run/main_scene",
                    "value": "res://scenes/test_scene.tscn"})
                print("[Test] Play failed fast with no modal. ✔")

                print("[Test] All Editor Operations Completed Successfully.")
            finally:
                print("[Test] Terminating...")
                try:
                    await call(session, "godot_terminate",
                               {"instance_id": PROJECT_PATH}, expect_ok=False)
                except Exception:
                    pass


if __name__ == "__main__":
    asyncio.run(main())
