"""Client for communicating with the Game Bridge HTTP API (running game)."""

import base64
import sys
import time
from pathlib import Path

import httpx


def log(*args):
    print(*args, file=sys.stderr, flush=True)


class GameBridgeClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 8766):
        self.base_url = f"http://{host}:{port}"
        self.timeout = 10.0
        self.editor_client = None

    def set_editor_client(self, client):
        """Editor client reference for debugger state checking on timeout."""
        self.editor_client = client

    async def check_debugger_paused(self) -> dict:
        if not self.editor_client:
            return {"paused": False, "sessions": []}
        try:
            sessions = await self.editor_client.get_debugger_sessions()
            paused = [s for s in sessions if s.get("paused")] if isinstance(sessions, list) else []
            return {"paused": bool(paused), "sessions": paused}
        except Exception:
            # Editor might not be responding either
            return {"paused": False, "sessions": []}

    async def request(self, method: str, endpoint: str, data: dict | None = None):
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(
                    method, f"{self.base_url}{endpoint}",
                    json=data if data is not None else None)
            if response.status_code >= 400:
                raise RuntimeError(
                    f"Game Bridge error: {response.status_code} {response.reason_phrase}")
            return response.json()
        except httpx.TimeoutException:
            # Timeout occurred - check if game is paused in debugger
            state = await self.check_debugger_paused()
            if state["paused"]:
                session = state["sessions"][0]  # Primary session
                details = [
                    f"Session {session.get('id')}: paused={session.get('paused')}, "
                    f"can_debug={session.get('can_debug')}"
                ]
                if session.get("reason"):
                    details.append(f"Reason: {session['reason']}")
                if session.get("break_file"):
                    line = session.get("break_line", -1)
                    location = (f"{session['break_file']}:{line}"
                                if line >= 0 else session["break_file"])
                    details.append(f"Location: {location}")
                if session.get("error"):
                    details.append(f"Error: {session['error']}")

                stack_info = ""
                if session.get("stack"):
                    frames = []
                    for i, frame in enumerate(session["stack"]):
                        loc = (f"{frame.get('file')}:{frame.get('line')}"
                               if frame.get("line", -1) >= 0 else frame.get("file"))
                        frames.append(f"  {i}: {frame.get('function') or '<anonymous>'} at {loc}")
                    stack_info = "\n\nStack trace:\n" + "\n".join(frames)

                raise TimeoutError(
                    "Game Bridge timeout - the game appears to be stopped in the debugger.\n\n"
                    + "\n".join(details) + stack_info + "\n\n"
                    "To inspect or continue:\n"
                    "1. godot_debugger_sessions shows the paused state and stack trace\n"
                    "2. godot_dap_stack_trace / godot_dap_scopes / godot_dap_variables "
                    "inspect frames and variables; godot_dap_evaluate runs expressions\n"
                    "3. godot_debugger_resume continues; godot_debugger_step_over / "
                    "godot_debugger_step_into step through the code"
                )
            raise TimeoutError(f"Request timeout to Game Bridge at {self.base_url}")

    # Screenshot from running game
    async def capture_screenshot(self, max_width: int | None = None,
                                 max_height: int | None = None,
                                 save_to_disk: bool = False):
        params = []
        if max_width:
            params.append(f"max_width={max_width}")
        if max_height:
            params.append(f"max_height={max_height}")
        # save_to_disk is handled on this side so the image lands in cwd
        # instead of Godot's user:// directory.
        url = "/screenshot" + (f"?{'&'.join(params)}" if params else "")

        result = await self.request("GET", url)

        # Game Bridge uses "data" key for base64; "base64" is legacy
        base64_data = result.get("data") or result.get("base64")
        if base64_data:
            try:
                filename = f"screenshot_{int(time.time() * 1000)}.png"
                filepath = Path.cwd() / filename
                filepath.write_bytes(base64.b64decode(base64_data))
                return {
                    "width": result.get("width"),
                    "height": result.get("height"),
                    "saved_to": str(filepath),
                    "note": "Image saved to disk to avoid context overflow",
                }
            except Exception as e:
                log(f"Failed to save screenshot to disk: {e}")
                return {"error": "Failed to save screenshot to disk", "details": str(e)}
        return result

    # Raw PNG bytes for MCP resource consumers (no disk round-trip)
    async def capture_screenshot_bytes(self, max_width: int = 1280,
                                       max_height: int = 720) -> bytes:
        result = await self.request(
            "GET", f"/screenshot?max_width={max_width}&max_height={max_height}")
        base64_data = result.get("data") or result.get("base64")
        if base64_data:
            return base64.b64decode(base64_data)
        # Oversized screenshots are written to disk by the game bridge
        file_path = result.get("file_path")
        if file_path:
            return Path(file_path).read_bytes()
        raise RuntimeError(f"Screenshot did not return image data: {result}")

    # Scene tree of running game
    async def get_scene_tree(self, max_depth: int = 10):
        return await self.request("GET", f"/scene_tree?max_depth={max_depth}")

    # Send single input event
    async def send_input(self, event_data: dict):
        return await self.request("POST", "/input", event_data)

    # Synthesize a full click (hover motion + press + release)
    async def click(self, node_path: str | None = None, x: float | None = None,
                    y: float | None = None, button_index: int = 1,
                    double_click: bool = False,
                    offset_x: float = 0.0, offset_y: float = 0.0):
        body: dict = {"button_index": button_index, "double_click": double_click}
        if node_path:
            body["node_path"] = node_path
            body["offset_x"] = offset_x
            body["offset_y"] = offset_y
        elif x is not None and y is not None:
            body["x"] = x
            body["y"] = y
        else:
            raise ValueError("Provide node_path or x/y coordinates")
        return await self.request("POST", "/click", body)

    # Send input sequence
    async def send_input_sequence(self, sequence: list, capture_screenshot: bool = False):
        return await self.request("POST", "/input-sequence", {
            "sequence": sequence,
            "capture_screenshot": capture_screenshot,
        })

    # Health check
    async def is_game_running(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                await client.head(f"{self.base_url}/screenshot")
            return True
        except Exception:
            return False
