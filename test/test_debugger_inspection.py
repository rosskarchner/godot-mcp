#!/usr/bin/env python3
"""Runtime-error debugging test: a bad line of code pauses the game and the
agent must (1) find out, (2) inspect the stack and variables, evaluate
expressions, step, and resume — with NO debugger setup beforehand.

Uses test_node.gd in the example project: pressing Enter calls
trigger_error(), which hits assert(false) at line 48.
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
KEY_ENTER = 4194309


def text_of(result):
    return result.content[0].text


async def main():
    print("=== Starting Godot MCP Debugger Inspection Test ===")
    params = StdioServerParameters(command=SERVER_CMD)
    failures = []

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            print("[Test] Launching and playing (no debugger setup at all)...")
            launch = await session.call_tool("godot_launch", {
                "project_path": PROJECT_PATH, "wait_for_ready": True})
            assert not launch.isError, text_of(launch)

            # The editor restores scene tabs asynchronously after the bridge
            # comes up; playing "current" too early is a clean error now.
            play = None
            for _ in range(30):
                play = await session.call_tool("godot_game_play", {
                    "scene_mode": "current", "enable_runtime_api": True})
                if not play.isError:
                    break
                if "No scene is open" not in text_of(play):
                    break
                await asyncio.sleep(1)
            assert play and not play.isError, text_of(play)
            await asyncio.sleep(8)

            print("[Test] Triggering runtime error (Enter -> assert(false))...")
            seq = await session.call_tool("godot_game_send_sequence", {
                "sequence": [
                    {"event_type": "key", "keycode": KEY_ENTER, "pressed": True, "delay_ms": 100},
                    {"event_type": "key", "keycode": KEY_ENTER, "pressed": False},
                ]})
            # (1) INFORMED: either the call times out with debugger guidance...
            if seq.isError and "stopped in the debugger" in text_of(seq):
                print("[Test] Informed via timeout diagnostic. ✔")

            # ...or polling sessions reports the pause
            session_info = None
            for _ in range(10):
                await asyncio.sleep(1)
                s = await session.call_tool("godot_debugger_sessions", {})
                if s.isError:
                    continue
                data = json.loads(text_of(s))
                if data and data[0].get("paused"):
                    session_info = data[0]
                    break
            if not session_info:
                failures.append("game never reported paused after runtime error")
                print("[Test] FAIL: not paused")
            else:
                print("[Test] Session paused. Enriched info:",
                      json.dumps(session_info)[:300])
                stack = session_info.get("stack") or []
                if not stack:
                    failures.append("sessions did not include a stack trace")
                elif stack[0].get("function") != "trigger_error" or stack[0].get("line") != 48:
                    failures.append(f"unexpected top frame: {stack[0]}")
                else:
                    print("[Test] Stack shows trigger_error at line 48. ✔")

            # (2) INSPECT: stack trace via DAP (auto-connect, no godot_dap_connect)
            trace = await session.call_tool("godot_dap_stack_trace", {})
            if trace.isError:
                failures.append(f"stack_trace: {text_of(trace)[:200]}")
            frames = json.loads(text_of(trace)).get("stackFrames", []) if not trace.isError else []
            print(f"[Test] godot_dap_stack_trace: {len(frames)} frames")
            frame_id = frames[0]["id"] if frames else 0

            scopes_r = await session.call_tool("godot_dap_scopes", {"frame_id": frame_id})
            if scopes_r.isError:
                failures.append(f"scopes: {text_of(scopes_r)[:200]}")
                scopes = []
            else:
                scopes = json.loads(text_of(scopes_r)).get("scopes", [])
                print("[Test] Scopes:", [s["name"] for s in scopes])

            members = next((s for s in scopes if s["name"] == "Members"), None)
            if members:
                vars_r = await session.call_tool("godot_dap_variables", {
                    "variables_reference": members["variablesReference"]})
                if vars_r.isError:
                    failures.append(f"variables: {text_of(vars_r)[:200]}")
                else:
                    variables = json.loads(text_of(vars_r)).get("variables", [])
                    tv = next((v for v in variables if v["name"] == "test_value"), None)
                    print("[Test] Members.test_value =", tv and tv["value"])
                    if not tv or tv["value"] != "42":
                        failures.append(f"test_value wrong: {tv}")
            else:
                failures.append("no Members scope")

            ev = await session.call_tool("godot_dap_evaluate", {
                "expression": "test_value + 1", "frame_id": frame_id})
            if ev.isError:
                failures.append(f"evaluate: {text_of(ev)[:200]}")
            else:
                result = json.loads(text_of(ev)).get("result")
                print("[Test] evaluate('test_value + 1') =", result)
                if result != "43":
                    failures.append(f"evaluate returned {result}, expected 43")

            # STEP: bridge step-over must report success and move the frame
            step = await session.call_tool("godot_debugger_step_over", {"session_id": 0})
            step_ok = not step.isError and json.loads(text_of(step)).get("success")
            print("[Test] step_over success:", step_ok)
            if not step_ok:
                failures.append(f"step_over failed: {text_of(step)[:120]}")
            await asyncio.sleep(1)
            trace2 = await session.call_tool("godot_dap_stack_trace", {})
            if not trace2.isError:
                frames2 = json.loads(text_of(trace2)).get("stackFrames", [])
                if frames2 and frames:
                    moved = (frames2[0]["line"] != frames[0]["line"]
                             or len(frames2) != len(frames))
                    print(f"[Test] After step: {frames2[0]['name']}:{frames2[0]['line']} "
                          f"(was line {frames[0]['line']}, moved={moved})")
                    if not moved:
                        failures.append("step_over did not move execution")

            # RESUME: must actually unpause the game
            resume = await session.call_tool("godot_debugger_resume", {"session_id": 0})
            resume_ok = not resume.isError and json.loads(text_of(resume)).get("success")
            print("[Test] resume success:", resume_ok)
            if not resume_ok:
                failures.append(f"resume failed: {text_of(resume)[:120]}")
            await asyncio.sleep(2)
            s = await session.call_tool("godot_debugger_sessions", {})
            data = json.loads(text_of(s))
            still_paused = data and data[0].get("paused")
            print("[Test] Paused after resume:", still_paused)
            if still_paused:
                failures.append("game still paused after resume")

            # Game responsive again?
            tree = await session.call_tool("godot_game_scene_tree", {"max_depth": 1})
            if tree.isError:
                failures.append(f"game not responsive after resume: {text_of(tree)[:120]}")
            else:
                print("[Test] Game bridge responsive after resume. ✔")

            print("[Test] Stopping and terminating...")
            await session.call_tool("godot_game_stop", {})
            await session.call_tool("godot_terminate", {"instance_id": PROJECT_PATH})

    if failures:
        print("\n=== FAILURES ===")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    print("\n=== DEBUGGER INSPECTION VERIFIED ===")


if __name__ == "__main__":
    asyncio.run(main())
