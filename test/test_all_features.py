#!/usr/bin/env python3
"""Full feature test: launch, editor ops, DAP breakpoints, game play, input, debugger, LSP."""

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


async def main():
    print("=== Starting Godot MCP Feature Test (Stdio) ===")
    params = StdioServerParameters(command=SERVER_CMD)
    failures = []

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print("[Test] Connected!")

            tools = await session.list_tools()
            print(f"[Test] Found {len(tools.tools)} tools.")

            print(f"[Test] Launching Godot project: {PROJECT_PATH}")
            launch = await session.call_tool("godot_launch", {
                "project_path": PROJECT_PATH,
                "wait_for_ready": True,
            })
            assert not launch.isError, text_of(launch)
            print("[Test] Launch Result:", text_of(launch)[:200])

            print("[Test] Getting Scene Tree...")
            tree = await session.call_tool("godot_scene_get_tree", {"max_depth": 2})
            assert not tree.isError, text_of(tree)
            print("[Test] Scene Tree Sample:", text_of(tree)[:200], "...")

            scene = await session.call_tool("godot_scene_current", {})
            print("[Test] Current Scene:", text_of(scene)[:200])

            print("[Test] Listing Resources...")
            resources = await session.call_tool("godot_resources_list", {
                "directory": "res://", "filter": "*.gd"})
            assert not resources.isError, text_of(resources)
            print("[Test] Resources List:", text_of(resources)[:100], "...")

            print("[Test] Connecting to DAP...")
            dap = await session.call_tool("godot_dap_connect", {})
            assert not dap.isError, text_of(dap)

            script_path = str(Path(PROJECT_PATH) / "scripts/test_node.gd")
            # Line 57 is the Space-key handler in test_node.gd
            print(f"[Test] Setting Breakpoint at {script_path}:57")
            bp = await session.call_tool("godot_dap_set_breakpoint", {
                "source": script_path, "line": 57})
            assert not bp.isError, text_of(bp)

            print("[Test] Sending Configuration Done...")
            await session.call_tool("godot_dap_configuration_done", {})

            print("[Test] Playing Game...")
            # The scripted TestNode only exists in the currently-open scene
            # (test_framework.tscn), not the project main scene.
            play = await session.call_tool("godot_game_play", {
                "scene_mode": "current", "enable_runtime_api": True})
            assert not play.isError, text_of(play)
            print("[Test] Game started. Waiting for bridge...")
            await asyncio.sleep(8)

            bridge = await session.call_tool("godot_game_scene_tree", {"max_depth": 2})
            if bridge.isError:
                failures.append(f"game_scene_tree: {text_of(bridge)[:200]}")
                print("[Test] WARNING: Bridge check failed:", text_of(bridge)[:200])
            else:
                print("[Test] Game Bridge Verified.")

            print("[Test] Capturing Screenshot...")
            shot = await session.call_tool("godot_game_screenshot", {})
            if shot.isError:
                failures.append(f"screenshot: {text_of(shot)[:200]}")
                print("[Test] WARNING: Screenshot failed:", text_of(shot)[:200])
            else:
                print("[Test] Screenshot:", text_of(shot)[:200])

            print("[Test] Sending Input Sequence (Space Press/Release) to trigger breakpoint...")
            seq = await session.call_tool("godot_game_send_sequence", {
                "sequence": [
                    {"event_type": "key", "keycode": 32, "pressed": True, "delay_ms": 100},
                    {"event_type": "key", "keycode": 32, "pressed": False},
                ]
            })
            print("[Test] Input sequence sent." if not seq.isError
                  else f"[Test] Input result: {text_of(seq)[:300]}")

            print("[Test] Polling for breakpoint hit status (via Bridge)...")
            paused_session_id = None
            for _ in range(15):
                await asyncio.sleep(1)
                sessions = await session.call_tool("godot_debugger_sessions", {})
                if sessions.isError:
                    continue
                try:
                    data = json.loads(text_of(sessions))
                except json.JSONDecodeError:
                    continue
                if data and data[0].get("paused"):
                    paused_session_id = data[0]["id"]
                    print("[Test] Breakpoint Verified Hit! (Session Paused)")
                    break

            if paused_session_id is not None:
                print(f"[Test] Session {paused_session_id} is paused. DAP Breakpoint Logic Verified.")
                print("[Test] Testing Bridge Step Over...")
                step = await session.call_tool("godot_debugger_step_over",
                                               {"session_id": paused_session_id})
                if step.isError:
                    failures.append(f"step_over: {text_of(step)[:200]}")
                await asyncio.sleep(1)

                print("[Test] Testing Bridge Resume...")
                resume = await session.call_tool("godot_debugger_resume",
                                                 {"session_id": paused_session_id})
                if resume.isError:
                    failures.append(f"resume: {text_of(resume)[:200]}")
            else:
                failures.append("breakpoint never hit (game never paused)")
                print("[Test] WARNING: Breakpoint hit could not be verified (Game never paused).")

            print("[Test] Testing LSP Tools...")
            lsp = await session.call_tool("godot_lsp_connect", {})
            if lsp.isError:
                failures.append(f"lsp_connect: {text_of(lsp)[:200]}")
            else:
                await asyncio.sleep(1)
                lsp_uri = f"file://{PROJECT_PATH}/scripts/test_node.gd"
                for name, args in [
                    ("godot_lsp_get_symbol_info", {"uri": lsp_uri, "line": 10, "character": 5}),
                    ("godot_lsp_list_symbols", {"uri": lsp_uri}),
                    ("godot_lsp_get_errors", {"uri": lsp_uri}),
                    ("godot_lsp_autocomplete", {"uri": lsp_uri, "line": 10, "character": 2}),
                    ("godot_lsp_find_definition", {"uri": lsp_uri, "line": 10, "character": 5}),
                    ("godot_lsp_search_symbols", {"query": "Test"}),
                ]:
                    result = await session.call_tool(name, args)
                    if result.isError and (name == "godot_lsp_search_symbols"
                                           and "Method not found" in text_of(result)):
                        # Godot 4.6 LSP reports workspaceSymbolProvider: false
                        print(f"[Test]   {name}: unsupported by this Godot version (expected)")
                        continue
                    status = "ERROR: " + text_of(result)[:120] if result.isError else "ok"
                    print(f"[Test]   {name}: {status}")
                    if result.isError:
                        failures.append(f"{name}: {text_of(result)[:120]}")
                print("[Test] LSP Tests Completed.")

            await session.call_tool("godot_dap_clear_breakpoints", {"source": script_path})

            print("[Test] Stopping Game...")
            stop = await session.call_tool("godot_game_stop", {})
            if stop.isError:
                failures.append(f"game_stop: {text_of(stop)[:200]}")
            else:
                print("[Test] Game Stopped.")

            print("[Test] Terminating Godot...")
            instances = await session.call_tool("godot_list_instances", {})
            data = json.loads(text_of(instances))
            for inst in data:
                await session.call_tool("godot_terminate", {"instance_id": inst["id"]})
                print(f"[Test] Terminated instance {inst['id']}")

    if failures:
        print("\n=== FAILURES ===")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    print("\n=== ALL FEATURES VERIFIED ===")


if __name__ == "__main__":
    asyncio.run(main())
