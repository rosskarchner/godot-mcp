"""Godot Unified MCP Server (stdio) built on the official MCP Python SDK."""

import asyncio
import json
import sys
from contextlib import asynccontextmanager
from typing import Annotated, Any

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from .dap_client import DAPClient
from .editor_api_client import EditorApiClient
from .game_bridge_client import GameBridgeClient
from .instance_manager import InstanceManager
from .lsp_client import LSPClient
from .project_bootstrap import bootstrap_project


def log(*args):
    print(*args, file=sys.stderr, flush=True)


# Global state
instance_manager = InstanceManager()
active_instance_id: str | None = None

# Client caching to avoid reconnecting or multiple instances
dap_clients: dict[str, DAPClient] = {}
lsp_clients: dict[str, LSPClient] = {}

INSTANCE_ID_FIELD = Annotated[
    str | None,
    Field(description="Optional: ID of the Godot instance to target (default: active instance)"),
]


@asynccontextmanager
async def lifespan(_server):
    global active_instance_id
    # Restore previous sessions
    await instance_manager.load_state()
    running = instance_manager.list_instances()
    if running:
        active_instance_id = running[0]["id"]
        log(f"[MCP] Restored {len(running)} instance(s). Active: {active_instance_id}")
    yield {}


mcp = FastMCP("godot-mcp-unified", lifespan=lifespan)


def get_instance(instance_id: str | None = None) -> dict:
    target = instance_id or active_instance_id
    if not target:
        raise RuntimeError("No active instance. Use godot_launch or godot_switch_instance first.")
    instance = instance_manager.get_instance(target)
    if not instance:
        raise RuntimeError(f"Instance not found: {target}")
    return instance


def get_editor(instance_id: str | None = None) -> EditorApiClient:
    instance = get_instance(instance_id)
    return EditorApiClient("127.0.0.1", instance["ports"]["editorApi"])


def get_game(instance_id: str | None = None) -> GameBridgeClient:
    instance = get_instance(instance_id)
    game = GameBridgeClient("127.0.0.1", instance["ports"]["gameBridge"])
    # Wire up editor client for debugger state checking on timeout
    game.set_editor_client(get_editor(instance_id))
    return game


def get_dap(instance_id: str | None = None) -> DAPClient:
    instance = get_instance(instance_id)
    if instance["id"] not in dap_clients:
        dap_clients[instance["id"]] = DAPClient("127.0.0.1", instance["ports"]["dap"])
    return dap_clients[instance["id"]]


async def ensure_dap(instance_id: str | None = None) -> DAPClient:
    """Get a connected+attached DAP client, connecting on demand.

    Lets inspection tools work without an explicit godot_dap_connect first,
    including when the game is already paused on an error.
    """
    dap = get_dap(instance_id)
    if not dap.connected:
        await dap.connect()
    if not dap.attached:
        try:
            await dap.send_request("attach", {})
            dap.attached = True
        except RuntimeError as e:
            # No game session yet; attach succeeds once one exists
            if "not_running" not in str(e):
                raise
    return dap


def get_lsp(instance_id: str | None = None) -> LSPClient:
    instance = get_instance(instance_id)
    if instance["id"] not in lsp_clients:
        lsp_clients[instance["id"]] = LSPClient("127.0.0.1", instance["ports"]["lsp"])
    return lsp_clients[instance["id"]]


def success(message: str, data: Any = None) -> str:
    if data is None:
        return message
    return data if isinstance(data, str) else json.dumps(data, indent=2)


# === Project Bootstrap ===

@mcp.tool()
async def godot_bootstrap_project(
    project_path: Annotated[str, Field(description="Absolute path where the project should be created")],
    project_name: Annotated[str | None, Field(description="Name of the project (defaults to directory name)")] = None,
    godot_version: Annotated[str | None, Field(description="Godot version (auto-detected from godot binary in PATH if not specified)")] = None,
    include_gut: Annotated[bool, Field(description="Include GUT (Godot Unit Testing) framework (default: true)")] = True,
    gut_version: Annotated[str, Field(description="GUT version to install (for Godot 4.x use 9.x)")] = "9.5.1",
) -> str:
    """Bootstrap a new Godot project with GUT (Godot Unit Testing) support. Auto-detects Godot version from PATH. Creates project structure, project.godot, and installs GUT testing framework."""
    result = await bootstrap_project(
        project_path, project_name=project_name, godot_version=godot_version,
        include_gut=include_gut, gut_version=gut_version)
    return success(result["message"], result)


# === Instance Management ===

@mcp.tool()
async def godot_launch(
    project_path: Annotated[str, Field(description="Absolute path to the Godot project directory")],
    godot_path: Annotated[str | None, Field(description="Path to Godot executable (optional, auto-detected if not provided)")] = None,
    wait_for_ready: Annotated[bool, Field(description="Wait for editor to be fully loaded before returning")] = True,
    headless: Annotated[bool, Field(description="Run the editor headless (no GUI)")] = False,
) -> str:
    """Launch a Godot editor instance. Auto-injects MCP support."""
    global active_instance_id
    instance = await instance_manager.launch_instance(
        project_path, godot_path=godot_path, headless=headless)
    active_instance_id = instance["id"]

    if wait_for_ready:
        log(f"[MCP] Waiting for instance {instance['id']} to be ready...")
        editor = get_editor(instance["id"])
        ready = False
        for _ in range(60):  # 60s timeout
            if await editor.health_check():
                ready = True
                break
            await asyncio.sleep(1)
        if not ready:
            raise TimeoutError("Timeout waiting for Godot instance to be ready")
        log(f"[MCP] Instance {instance['id']} is ready.")

    return success(f"Launched Godot for {project_path} (ID: {instance['id']})", {
        "instance_id": instance["id"],
        "ports": instance["ports"],
    })


@mcp.tool()
async def godot_list_instances() -> str:
    """List all running Godot instances."""
    return success("Active instances", instance_manager.list_instances())


@mcp.tool()
async def godot_switch_instance(
    instance_id: Annotated[str, Field(description="Instance ID or project path to make active")],
) -> str:
    """Switch the active instance for tool calls."""
    global active_instance_id
    instance = instance_manager.get_instance(instance_id)
    if not instance:
        raise RuntimeError(f"Instance not found: {instance_id}")
    active_instance_id = instance["id"]
    return success(f"Switched to instance: {active_instance_id}")


@mcp.tool()
async def godot_adopt_instance(
    project_path: Annotated[str, Field(description="Absolute path to the project")],
    lsp_port: int = 6005,
    dap_port: int = 6006,
    editor_port: int = 8765,
    game_bridge_port: int = 8766,
) -> str:
    """Connect to an externally started Godot (requires MCP plugin)."""
    global active_instance_id
    instance = await instance_manager.adopt_instance(project_path, {
        "lsp_port": lsp_port,
        "dap_port": dap_port,
        "editor_port": editor_port,
        "game_bridge_port": game_bridge_port,
    })
    active_instance_id = instance["id"]
    return success(f"Adopted external instance: {instance['id']}. Set as active.")


@mcp.tool()
async def godot_terminate(
    instance_id: Annotated[str, Field(description="Instance ID or project path")],
) -> str:
    """Terminate a Godot editor instance."""
    global active_instance_id
    result = await instance_manager.terminate_instance(instance_id)
    if active_instance_id == instance_id:
        active_instance_id = None

    # Clean up clients
    dap_clients.pop(instance_id, None)
    lsp_clients.pop(instance_id, None)

    return success(f"Terminated instance: {instance_id}" if result else "Instance not found")


# === Editor Tools ===

@mcp.tool()
async def godot_scene_get_tree(
    max_depth: Annotated[int, Field(description="Maximum depth to traverse")] = 10,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Get the hierarchical structure of the current scene in the editor"""
    return success("Editor operation successful",
                   await get_editor(instance_id).get_scene_tree(max_depth))


@mcp.tool()
async def godot_scene_current(instance_id: INSTANCE_ID_FIELD = None) -> str:
    """Get information about the currently active scene tab"""
    return success("Editor operation successful",
                   await get_editor(instance_id).get_current_scene())


@mcp.tool()
async def godot_scene_load(
    path: Annotated[str, Field(description="Resource path (res://...)")],
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Load a scene into the editor"""
    return success("Editor operation successful", await get_editor(instance_id).load_scene(path))


@mcp.tool()
async def godot_scene_save(instance_id: INSTANCE_ID_FIELD = None) -> str:
    """Save the currently active scene"""
    return success("Editor operation successful", await get_editor(instance_id).save_scene())


@mcp.tool()
async def godot_node_info(
    node_path: Annotated[str, Field(description="Path to node in scene tree")],
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Get detailed information about a scene node"""
    return success("Editor operation successful",
                   await get_editor(instance_id).get_node_info(node_path))


@mcp.tool()
async def godot_node_properties(node_path: str, instance_id: INSTANCE_ID_FIELD = None) -> str:
    """Get properties of a scene node"""
    return success("Editor operation successful",
                   await get_editor(instance_id).get_node_properties(node_path))


@mcp.tool()
async def godot_node_set_property(
    node_path: str,
    property: str,
    value: Any,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Set a property value on a node"""
    return success("Editor operation successful",
                   await get_editor(instance_id).set_node_property(node_path, property, value))


@mcp.tool()
async def godot_node_create(
    parent_path: str,
    node_type: str,
    node_name: str,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Create a new node"""
    return success("Editor operation successful",
                   await get_editor(instance_id).create_node(parent_path, node_type, node_name))


@mcp.tool()
async def godot_node_delete(node_path: str, instance_id: INSTANCE_ID_FIELD = None) -> str:
    """Delete a node"""
    return success("Editor operation successful",
                   await get_editor(instance_id).delete_node(node_path))


@mcp.tool()
async def godot_script_attach(
    node_path: str,
    script_path: str,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Attach a script to a node"""
    return success("Editor operation successful",
                   await get_editor(instance_id).attach_script(node_path, script_path))


@mcp.tool()
async def godot_script_get(node_path: str, instance_id: INSTANCE_ID_FIELD = None) -> str:
    """Get the script attached to a node"""
    return success("Editor operation successful",
                   await get_editor(instance_id).get_node_script(node_path))


@mcp.tool()
async def godot_resources_list(
    directory: str = "res://",
    filter: Annotated[str | None, Field(description="Extension filter (e.g. .tscn)")] = None,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """List resources in project directory"""
    return success("Editor operation successful",
                   await get_editor(instance_id).list_resources(directory, filter or ""))


@mcp.tool()
async def godot_project_settings_list(
    prefix: str | None = None,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """List project settings"""
    return success("Editor operation successful",
                   await get_editor(instance_id).list_project_settings(prefix or ""))


@mcp.tool()
async def godot_project_setting_get(
    setting_name: str,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Get the value of a specific project setting"""
    return success("Editor operation successful",
                   await get_editor(instance_id).get_project_setting(setting_name))


@mcp.tool()
async def godot_project_setting_set(
    setting_name: str,
    value: Any,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Set the value of a project setting"""
    return success("Editor operation successful",
                   await get_editor(instance_id).set_project_setting(setting_name, value))


@mcp.tool()
async def godot_input_actions_list(instance_id: INSTANCE_ID_FIELD = None) -> str:
    """List all input actions defined in the project"""
    return success("Editor operation successful",
                   await get_editor(instance_id).list_input_actions())


@mcp.tool()
async def godot_editor_output(
    max_lines: int = 100,
    filter_text: str | None = None,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Read Godot editor logs"""
    return success("Editor operation successful",
                   await get_editor(instance_id).read_editor_logs(max_lines, filter_text))


@mcp.tool()
async def godot_editor_dialogs(instance_id: INSTANCE_ID_FIELD = None) -> str:
    """List modal dialogs currently visible in the editor (alerts, confirmations). Check this when an editor action seems to have no effect — a dialog may be blocking it."""
    return success("Editor operation successful",
                   await get_editor(instance_id).list_dialogs())


@mcp.tool()
async def godot_editor_dialog_dismiss(
    accept: Annotated[bool, Field(description="True presses the OK/confirm button; false cancels/closes")] = False,
    dialog_path: Annotated[str | None, Field(description="Path of the dialog from godot_editor_dialogs (default: first visible dialog)")] = None,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Dismiss a modal editor dialog so blocked operations can proceed."""
    return success("Editor operation successful",
                   await get_editor(instance_id).dismiss_dialog(accept, dialog_path))


# === Game Control (via editor) ===

@mcp.tool()
async def godot_game_play(
    scene_mode: Annotated[str, Field(description='Which scene to play: "main" (project main scene) or "current" (currently open scene)')] = "main",
    enable_runtime_api: Annotated[bool, Field(description="Inject Game Bridge autoload to enable runtime interaction")] = True,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Start playing a scene in the Godot editor (defaults to main scene)"""
    result = await get_editor(instance_id).request("/game/play", {
        "scene_mode": scene_mode,
        "enable_runtime_api": enable_runtime_api,
    })
    if isinstance(result, dict) and result.get("error"):
        # Surface play failures loudly -- a silent non-start is very confusing
        raise RuntimeError(f"Game did not start: {result['error']}")
    return success("Game operation successful", result)


@mcp.tool()
async def godot_game_stop(instance_id: INSTANCE_ID_FIELD = None) -> str:
    """Stop the currently playing scene"""
    return success("Game operation successful",
                   await get_editor(instance_id).request("/game/stop", {}))


# === Game Bridge Tools ===

@mcp.tool()
async def godot_game_screenshot(
    max_width: int = 1280,
    max_height: int = 720,
    save_to_disk: bool = False,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Capture a screenshot from the running game"""
    result = await get_game(instance_id).capture_screenshot(
        max_width=max_width, max_height=max_height, save_to_disk=save_to_disk)
    return success("Game operation successful", result)


@mcp.tool()
async def godot_game_scene_tree(
    max_depth: int = 10,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Get the scene tree of the running game (runtime state)"""
    return success("Game operation successful",
                   await get_game(instance_id).get_scene_tree(max_depth))


@mcp.tool()
async def godot_game_click(
    node_path: Annotated[str | None, Field(description="Scene path of a Control or Node2D to click (e.g. '/root/Main/UI/StartButton'). The click targets the node's screen center. Use godot_game_scene_tree to find paths and screen_rect coordinates.")] = None,
    x: Annotated[float | None, Field(description="Viewport X coordinate (alternative to node_path)")] = None,
    y: Annotated[float | None, Field(description="Viewport Y coordinate (alternative to node_path)")] = None,
    button_index: Annotated[int, Field(description="Mouse button: 1=left, 2=right, 3=middle")] = 1,
    double_click: bool = False,
    offset_x: Annotated[float, Field(description="X offset from node center (only with node_path)")] = 0.0,
    offset_y: Annotated[float, Field(description="Y offset from node center (only with node_path)")] = 0.0,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Click in the running game with the mouse. Target either a node by scene path (clicks its screen center, handling all coordinate transforms) or explicit viewport x/y. Sends hover motion, press, and release so GUI buttons, Area2D picking, and _gui_input all fire."""
    if node_path is None and (x is None or y is None):
        raise ValueError("Provide node_path, or both x and y")
    result = await get_game(instance_id).click(
        node_path=node_path, x=x, y=y, button_index=button_index,
        double_click=double_click, offset_x=offset_x, offset_y=offset_y)
    return success("Game operation successful", result)


@mcp.tool()
async def godot_game_send_sequence(
    sequence: Annotated[list[dict], Field(description="List of input events. Each event has event_type (key/mouse_button/mouse_motion/action/joypad_button/joypad_motion) plus optional delay_ms. key: keycode, pressed. mouse_button: button_index (1=left), position_x/y (viewport coords), pressed. mouse_motion: position_x/y, relative_x/y, button_mask (1=left held, for drags). For simple clicks prefer godot_game_click.")],
    capture_screenshot: bool = False,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Send a sequence of input events to running game"""
    return success("Game operation successful",
                   await get_game(instance_id).send_input_sequence(sequence, capture_screenshot))


# === DAP Debugging ===

@mcp.tool()
async def godot_dap_connect(instance_id: INSTANCE_ID_FIELD = None) -> str:
    """Connect to DAP for runtime debugging (breakpoints, stepping). Call before setting breakpoints."""
    dap = get_dap(instance_id)
    if dap.connected:
        dap.disconnect()
    await dap.connect()
    try:
        await dap.send_request("attach", {})
        dap.attached = True
    except RuntimeError as e:
        # Godot returns not_running when no game session exists yet;
        # breakpoints can still be configured before launch.
        if "not_running" not in str(e):
            raise
        return success("Connected to DAP (no game session running yet; "
                       "breakpoints can still be set)")
    return success("Connected and Attached to DAP")


@mcp.tool()
async def godot_dap_configuration_done(instance_id: INSTANCE_ID_FIELD = None) -> str:
    """Signal that breakpoint configuration is done. Required before receiving stop events."""
    result = await get_dap(instance_id).send_request("configurationDone", {})
    return success("DAP Request Successful", result)


@mcp.tool()
async def godot_dap_set_breakpoint(
    source: Annotated[str, Field(description="Full filesystem path to the GDScript file (e.g., '/home/user/project/scripts/player.gd').")],
    line: Annotated[int, Field(description="Line number to set the breakpoint at (1-indexed, first line is 1)")],
    condition: Annotated[str | None, Field(description="Optional: GDScript expression that must be true for breakpoint to trigger (e.g., 'health <= 0')")] = None,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Set a breakpoint at a line. Use full filesystem paths, not res:// paths."""
    breakpoint: dict[str, Any] = {"line": line}
    if condition is not None:
        breakpoint["condition"] = condition
    await get_dap(instance_id).send_request("setBreakpoints", {
        "source": {"path": source},
        "breakpoints": [breakpoint],
    })
    return success("Breakpoint set")


@mcp.tool()
async def godot_dap_clear_breakpoints(
    source: Annotated[str, Field(description="Full filesystem path to the GDScript file to clear breakpoints from")],
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Remove all breakpoints from a GDScript file."""
    await get_dap(instance_id).send_request("setBreakpoints", {
        "source": {"path": source},
        "breakpoints": [],
    })
    return success("Breakpoints cleared")


# === DAP Inspection (works on breakpoints and runtime errors) ===

@mcp.tool()
async def godot_dap_stack_trace(
    thread_id: Annotated[int, Field(description="Thread ID from godot_debugger_sessions (main thread is 1)")] = 1,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Get the stack trace of the paused game (file, line, function per frame). Connects to DAP automatically. Frame ids feed godot_dap_scopes."""
    dap = await ensure_dap(instance_id)
    result = await dap.send_request("stackTrace", {"threadId": thread_id})
    return success("DAP Request Successful", result)


@mcp.tool()
async def godot_dap_scopes(
    frame_id: Annotated[int, Field(description="Frame id from godot_dap_stack_trace")],
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """List variable scopes (Locals/Members/Globals) for a stack frame of the paused game. The variablesReference values feed godot_dap_variables."""
    dap = await ensure_dap(instance_id)
    result = await dap.send_request("scopes", {"frameId": frame_id})
    return success("DAP Request Successful", result)


@mcp.tool()
async def godot_dap_variables(
    variables_reference: Annotated[int, Field(description="variablesReference from godot_dap_scopes or a structured variable")],
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Read variables in a scope (or children of a structured variable) while the game is paused."""
    dap = await ensure_dap(instance_id)
    result = await dap.send_request("variables", {"variablesReference": variables_reference})
    return success("DAP Request Successful", result)


@mcp.tool()
async def godot_dap_evaluate(
    expression: Annotated[str, Field(description="GDScript expression to evaluate in the paused frame (e.g. 'player.health * 2')")],
    frame_id: Annotated[int | None, Field(description="Frame id from godot_dap_stack_trace (defaults to current frame)")] = None,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Evaluate a GDScript expression in the context of the paused game."""
    dap = await ensure_dap(instance_id)
    args: dict[str, Any] = {"expression": expression}
    if frame_id is not None:
        args["frameId"] = frame_id
    result = await dap.send_request("evaluate", args)
    return success("DAP Request Successful", result)


# === Editor Bridge Debugging ===

@mcp.tool()
async def godot_debugger_sessions(instance_id: INSTANCE_ID_FIELD = None) -> str:
    """Get active debugger sessions. Returns paused state; when paused, includes the stack trace (fetched via DAP) so you can see where execution stopped."""
    sessions = await get_editor(instance_id).get_debugger_sessions()
    # The editor bridge can't see native debugger messages, so enrich paused
    # sessions with the stack via DAP (best effort).
    if isinstance(sessions, list) and any(s.get("paused") for s in sessions):
        try:
            dap = await ensure_dap(instance_id)
            trace = await dap.send_request("stackTrace", {"threadId": 1})
            frames = [
                {"function": f.get("name"),
                 "file": (f.get("source") or {}).get("path"),
                 "line": f.get("line")}
                for f in trace.get("stackFrames", [])
            ]
            for s in sessions:
                if s.get("paused") and not s.get("stack"):
                    s["stack"] = frames
                    if frames:
                        s.setdefault("break_file", frames[0]["file"])
                        s.setdefault("break_line", frames[0]["line"])
        except Exception as e:
            log(f"[MCP] Could not enrich sessions with DAP stack: {e}")
    return success("Editor operation successful", sessions)


@mcp.tool()
async def godot_debugger_resume(
    session_id: int = 0,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Resume execution of a paused debugger session."""
    return success("Editor operation successful",
                   await get_editor(instance_id).debug_resume(session_id))


@mcp.tool()
async def godot_debugger_step_over(
    session_id: int = 0,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Step over the current line in a paused session."""
    return success("Editor operation successful",
                   await get_editor(instance_id).debug_step_over(session_id))


@mcp.tool()
async def godot_debugger_step_into(
    session_id: int = 0,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Step into the call on the current line in a paused session."""
    return success("Editor operation successful",
                   await get_editor(instance_id).debug_step_into(session_id))


# === LSP Code Intelligence ===

@mcp.tool()
async def godot_lsp_connect(instance_id: INSTANCE_ID_FIELD = None) -> str:
    """Connect to LSP for code intelligence (autocomplete, diagnostics, go-to-definition)."""
    await get_lsp(instance_id).connect()
    return success("Connected to LSP")


@mcp.tool()
async def godot_lsp_get_errors(
    uri: Annotated[str | None, Field(description="Optional: file URI to get diagnostics for (e.g., 'file:///path/to/file.gd'). If omitted, returns all diagnostics.")] = None,
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Get syntax errors and warnings for GDScript files."""
    return success("LSP Request Successful",
                   await get_lsp(instance_id).get_document_diagnostics(uri))


@mcp.tool()
async def godot_lsp_get_symbol_info(
    uri: Annotated[str, Field(description="File URI (e.g., 'file:///path/to/file.gd')")],
    line: Annotated[int, Field(description="Line number where the symbol is (0-indexed, first line is 0)")],
    character: Annotated[int, Field(description="Character position in the line (0-indexed, first character is 0)")],
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Get documentation and type info for a symbol at cursor position."""
    return success("LSP Request Successful",
                   await get_lsp(instance_id).hover(uri, line, character))


@mcp.tool()
async def godot_lsp_find_definition(
    uri: Annotated[str, Field(description="File URI where the symbol reference is (e.g., 'file:///path/to/file.gd')")],
    line: Annotated[int, Field(description="Line number of the symbol reference (0-indexed)")],
    character: Annotated[int, Field(description="Character position of the symbol reference (0-indexed)")],
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Find where a symbol is defined. Returns file location and line number."""
    return success("LSP Request Successful",
                   await get_lsp(instance_id).definition(uri, line, character))


@mcp.tool()
async def godot_lsp_autocomplete(
    uri: Annotated[str, Field(description="File URI (e.g., 'file:///path/to/file.gd')")],
    line: Annotated[int, Field(description="Line number for completion (0-indexed)")],
    character: Annotated[int, Field(description="Character position for completion (0-indexed)")],
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Get code completion suggestions at cursor position."""
    return success("LSP Request Successful",
                   await get_lsp(instance_id).completion(uri, line, character))


@mcp.tool()
async def godot_lsp_list_symbols(
    uri: Annotated[str, Field(description="File URI to get symbols from (e.g., 'file:///path/to/file.gd')")],
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """List all symbols (functions, classes, variables) in a file."""
    return success("LSP Request Successful",
                   await get_lsp(instance_id).document_symbols(uri))


@mcp.tool()
async def godot_lsp_search_symbols(
    query: Annotated[str, Field(description="Search query for symbol names (e.g., 'Player', 'get_health'). Empty string returns all symbols.")] = "",
    instance_id: INSTANCE_ID_FIELD = None,
) -> str:
    """Search for symbols across the project by name."""
    return success("LSP Request Successful",
                   await get_lsp(instance_id).workspace_symbols(query))


# === Resources (read-only state, URI-addressable) ===
# "active" URIs target the active instance; instance IDs are filesystem
# paths, so per-instance URI templates are not practical.

@mcp.resource("godot://instances")
async def resource_instances() -> str:
    """Running Godot instances with their ports and status."""
    return json.dumps(instance_manager.list_instances(), indent=2)


@mcp.resource("godot://active/scene-tree")
async def resource_scene_tree() -> str:
    """Scene tree of the active editor instance."""
    return json.dumps(await get_editor().get_scene_tree(10), indent=2)


@mcp.resource("godot://active/logs")
async def resource_logs() -> str:
    """Recent editor output of the active instance."""
    return json.dumps(await get_editor().read_editor_logs(100), indent=2)


@mcp.resource("godot://active/screenshot", mime_type="image/png")
async def resource_screenshot() -> bytes:
    """Live screenshot of the running game (PNG)."""
    return await get_game().capture_screenshot_bytes()


# === Prompts (guided workflows, exposed as slash commands) ===

@mcp.prompt()
def debug_breakpoint(project_path: str, script_path: str, line: int) -> str:
    """Guided workflow: pause the game at a breakpoint and inspect it."""
    return f"""Debug {script_path}:{line} in the Godot project at {project_path}.

Follow this exact sequence (each step depends on the previous one):
1. godot_launch with project_path="{project_path}" and wait_for_ready=true.
2. godot_dap_connect. A reply saying "no game session running yet" is normal \
and fine — breakpoints can be configured before launch.
3. godot_dap_set_breakpoint with source="{script_path}" (must be a full \
filesystem path, not res://) and line={line}.
4. godot_dap_configuration_done.
5. godot_game_play. Use scene_mode="current" if the target script belongs to \
the scene open in the editor rather than the project's main scene.
6. Trigger the code path that reaches the breakpoint (godot_game_click for \
mouse, godot_game_send_sequence for keys; godot_game_scene_tree shows clickable \
screen_rect coordinates).
7. Poll godot_debugger_sessions about once a second until a session reports \
paused=true. Game-bridge calls timing out with "stopped in the debugger" also \
means the breakpoint hit.
8. Report the break location, reason, and stack, then godot_debugger_step_over \
to step or godot_debugger_resume to continue.
9. When finished: godot_dap_clear_breakpoints, godot_game_stop, and \
godot_terminate unless the user wants the editor kept open."""


@mcp.prompt()
def playtest(project_path: str, scene_mode: str = "main") -> str:
    """Guided workflow: play the game, interact with it, and report findings."""
    return f"""Playtest the Godot project at {project_path} and report what you find.

1. godot_launch with project_path="{project_path}" and wait_for_ready=true.
2. godot_game_play with scene_mode="{scene_mode}" and enable_runtime_api=true, \
then wait several seconds for the game bridge to come up.
3. Observe: godot_game_screenshot for the visual state, godot_game_scene_tree \
for the runtime hierarchy (Controls include screen_rect, Node2Ds include \
screen_position — these are real viewport coordinates).
4. Interact: godot_game_click with a node_path to click buttons/controls \
(it resolves the node's screen center for you), or godot_game_send_sequence \
for keyboard and mouse-drag input. Take screenshots between actions to see \
the effect.
5. Watch godot_editor_output for script errors or warnings while playing. If \
the game stops responding, check godot_debugger_sessions — it may be paused on \
an error; godot_debugger_resume continues.
6. godot_game_stop when done, then report: what works, what's broken (with \
log evidence), and anything that looks off in the scene tree or visuals."""


def main():
    log("Godot Unified MCP Server running on stdio")
    mcp.run()


if __name__ == "__main__":
    main()
