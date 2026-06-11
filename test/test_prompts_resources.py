#!/usr/bin/env python3
"""Validates MCP prompts and resources against a live editor and running game."""

import asyncio
import base64
import json
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from pydantic import AnyUrl

REPO_ROOT = Path(__file__).resolve().parents[1]
PROJECT_PATH = str(REPO_ROOT / "example_project")
SERVER_CMD = str(REPO_ROOT / ".venv" / "bin" / "godot-mcp-server")


async def main():
    print("=== Starting Godot MCP Prompts & Resources Test ===")
    params = StdioServerParameters(command=SERVER_CMD)
    failures = []

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # --- Listings ---
            resources = await session.list_resources()
            uris = sorted(str(r.uri) for r in resources.resources)
            print("[Test] Resources:", uris)
            expected = ["godot://active/logs", "godot://active/scene-tree",
                        "godot://active/screenshot", "godot://instances"]
            if uris != expected:
                failures.append(f"resource list mismatch: {uris}")

            prompts = await session.list_prompts()
            names = sorted(p.name for p in prompts.prompts)
            print("[Test] Prompts:", names)
            if names != ["debug_breakpoint", "playtest"]:
                failures.append(f"prompt list mismatch: {names}")

            # --- Prompts render with arguments ---
            bp = await session.get_prompt("debug_breakpoint", {
                "project_path": PROJECT_PATH,
                "script_path": f"{PROJECT_PATH}/scripts/test_node.gd",
                "line": "57",
            })
            bp_text = bp.messages[0].content.text
            print("[Test] debug_breakpoint renders", len(bp_text), "chars")
            if "test_node.gd:57" not in bp_text or "godot_dap_set_breakpoint" not in bp_text:
                failures.append("debug_breakpoint prompt missing expected content")

            pt = await session.get_prompt("playtest", {"project_path": PROJECT_PATH})
            pt_text = pt.messages[0].content.text
            if 'scene_mode="main"' not in pt_text:
                failures.append("playtest prompt default scene_mode not rendered")
            print("[Test] playtest renders", len(pt_text), "chars")

            # --- Resources without an instance: instances works, active/* errors ---
            inst = await session.read_resource(AnyUrl("godot://instances"))
            print("[Test] godot://instances:", inst.contents[0].text.strip()[:60])
            try:
                await session.read_resource(AnyUrl("godot://active/scene-tree"))
                failures.append("active resource should error with no instance")
            except Exception as e:
                print("[Test] No-instance error is clean:", str(e)[:80])

            # --- Launch and play, then read live resources ---
            print("[Test] Launching Godot and playing scene...")
            launch = await session.call_tool("godot_launch", {
                "project_path": PROJECT_PATH, "wait_for_ready": True})
            assert not launch.isError, launch.content[0].text
            play = await session.call_tool("godot_game_play", {
                "scene_mode": "current", "enable_runtime_api": True})
            assert not play.isError, play.content[0].text
            await asyncio.sleep(8)

            inst2 = await session.read_resource(AnyUrl("godot://instances"))
            if PROJECT_PATH not in inst2.contents[0].text:
                failures.append("instances resource missing launched instance")
            else:
                print("[Test] instances resource shows launched instance")

            tree = await session.read_resource(AnyUrl("godot://active/scene-tree"))
            tree_data = json.loads(tree.contents[0].text)
            print("[Test] scene-tree resource root:",
                  tree_data.get("root", {}).get("name"))
            if "root" not in tree_data:
                failures.append("scene-tree resource has no root")

            logs = await session.read_resource(AnyUrl("godot://active/logs"))
            logs_data = json.loads(logs.contents[0].text)
            print("[Test] logs resource lines:", len(logs_data.get("lines", [])))
            if not logs_data.get("success"):
                failures.append("logs resource not successful")

            shot = await session.read_resource(AnyUrl("godot://active/screenshot"))
            content = shot.contents[0]
            mime = getattr(content, "mimeType", None)
            blob = getattr(content, "blob", None)
            if blob is None:
                failures.append(f"screenshot resource is not binary: {content}")
            else:
                png = base64.b64decode(blob)
                is_png = png[:8] == b"\x89PNG\r\n\x1a\n"
                print(f"[Test] screenshot resource: {len(png)} bytes, "
                      f"mime={mime}, png_magic={is_png}")
                if not is_png:
                    failures.append("screenshot blob is not a PNG")
                if mime != "image/png":
                    failures.append(f"screenshot mime is {mime}")

            print("[Test] Stopping and terminating...")
            await session.call_tool("godot_game_stop", {})
            await session.call_tool("godot_terminate", {"instance_id": PROJECT_PATH})

    if failures:
        print("\n=== FAILURES ===")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    print("\n=== PROMPTS & RESOURCES VERIFIED ===")


if __name__ == "__main__":
    asyncio.run(main())
