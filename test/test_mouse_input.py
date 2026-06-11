#!/usr/bin/env python3
"""Mouse input test: verifies synthetic clicks reach GUI controls in the running game.

Uses example_project/scenes/test_framework.tscn, whose UI/Button has
test_button.gd attached printing BUTTON_HOVERED / BUTTON_CLICKED markers.
The scene root is a Node2D at (512, 384), so this also proves the
node-path click resolves coordinate transforms correctly.
"""

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


def find_node(tree: dict, name: str) -> dict | None:
    if tree.get("name") == name:
        return tree
    for child in tree.get("children", []):
        found = find_node(child, name)
        if found:
            return found
    return None


async def count_marker(session, marker: str) -> int:
    logs = await session.call_tool("godot_editor_output", {"max_lines": 200})
    data = json.loads(text_of(logs))
    return sum(1 for line in data.get("lines", []) if marker in line)


async def main():
    print("=== Starting Godot MCP Mouse Input Test ===")
    params = StdioServerParameters(command=SERVER_CMD)
    failures = []

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            print("[Test] Launching Godot...")
            launch = await session.call_tool("godot_launch", {
                "project_path": PROJECT_PATH, "wait_for_ready": True})
            assert not launch.isError, text_of(launch)

            print("[Test] Playing current scene...")
            play = await session.call_tool("godot_game_play", {
                "scene_mode": "current", "enable_runtime_api": True})
            assert not play.isError, text_of(play)
            await asyncio.sleep(8)

            # 1. Runtime scene tree exposes Control screen rects
            print("[Test] Checking screen_rect in runtime scene tree...")
            tree = await session.call_tool("godot_game_scene_tree", {"max_depth": 10})
            assert not tree.isError, text_of(tree)
            tree_data = json.loads(text_of(tree))
            button = find_node(tree_data["root"], "Button")
            if not button or "screen_rect" not in button:
                failures.append("Button screen_rect missing from runtime scene tree")
                print("[Test] FAIL: no screen_rect on Button:", button)
            else:
                rx, ry, rw, rh = button["screen_rect"]
                print(f"[Test] Button screen_rect: ({rx}, {ry}, {rw}, {rh})")
                # Scene root Node2D sits at (512, 384); button offsets are (50, 120)
                if abs(rx - 562) > 1 or abs(ry - 504) > 1:
                    failures.append(f"unexpected screen_rect origin ({rx}, {ry})")

            # 2. Click by node path (no coordinate math needed)
            print("[Test] Clicking Button by node path...")
            click = await session.call_tool("godot_game_click", {
                "node_path": button["path"] if button else "/root/TestRoot/UI/Button"})
            if click.isError:
                failures.append(f"click by node_path: {text_of(click)[:200]}")
            else:
                print("[Test] Click result:", text_of(click)[:120])
            await asyncio.sleep(1)

            clicks = await count_marker(session, "BUTTON_CLICKED")
            hovers = await count_marker(session, "BUTTON_HOVERED")
            print(f"[Test] BUTTON_CLICKED count: {clicks}, BUTTON_HOVERED count: {hovers}")
            if clicks < 1:
                failures.append("click by node_path did not press the button")
            if hovers < 1:
                failures.append("hover (mouse_entered) did not fire")

            # 3. Click by explicit viewport coordinates
            print("[Test] Clicking Button by viewport coordinates (612, 524)...")
            click2 = await session.call_tool("godot_game_click", {"x": 612, "y": 524})
            if click2.isError:
                failures.append(f"click by x/y: {text_of(click2)[:200]}")
            await asyncio.sleep(1)
            clicks2 = await count_marker(session, "BUTTON_CLICKED")
            print(f"[Test] BUTTON_CLICKED count now: {clicks2}")
            if clicks2 < 2:
                failures.append("click by x/y did not press the button")

            # 4. Raw mouse events through the sequence tool still work
            print("[Test] Clicking via godot_game_send_sequence raw mouse events...")
            seq = await session.call_tool("godot_game_send_sequence", {
                "sequence": [
                    {"event_type": "mouse_motion", "position_x": 612, "position_y": 524},
                    {"event_type": "mouse_button", "button_index": 1,
                     "position_x": 612, "position_y": 524, "pressed": True, "delay_ms": 100},
                    {"event_type": "mouse_button", "button_index": 1,
                     "position_x": 612, "position_y": 524, "pressed": False, "delay_ms": 100},
                ]
            })
            if seq.isError:
                failures.append(f"raw mouse sequence: {text_of(seq)[:200]}")
            await asyncio.sleep(1)
            clicks3 = await count_marker(session, "BUTTON_CLICKED")
            print(f"[Test] BUTTON_CLICKED count now: {clicks3}")
            if clicks3 < 3:
                failures.append("raw mouse sequence did not press the button")

            # 5. Bad node path returns a clean error
            bad = await session.call_tool("godot_game_click", {"node_path": "/root/Nope"})
            if not bad.isError:
                failures.append("click on missing node should error")
            else:
                print("[Test] Missing node errors cleanly:", text_of(bad)[:80])

            print("[Test] Stopping and terminating...")
            await session.call_tool("godot_game_stop", {})
            await session.call_tool("godot_terminate", {"instance_id": PROJECT_PATH})

    if failures:
        print("\n=== FAILURES ===")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    print("\n=== MOUSE INPUT VERIFIED ===")


if __name__ == "__main__":
    asyncio.run(main())
