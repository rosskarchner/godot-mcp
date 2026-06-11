"""Client for communicating with the Editor Bridge HTTP API."""

import httpx


class EditorApiClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 8765):
        self.base_url = f"http://{host}:{port}"
        self.timeout = 10.0

    async def request(self, endpoint: str, data: dict | None = None):
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.base_url}{endpoint}", json=data or {})
            if response.status_code >= 400:
                raise RuntimeError(
                    f"Editor API error: {response.status_code} {response.reason_phrase}")
            return response.json()
        except httpx.TimeoutException:
            raise TimeoutError(f"Request timeout to Editor API at {self.base_url}")

    # Scene operations
    async def get_scene_tree(self, max_depth: int = 10):
        return await self.request("/scene/tree", {"max_depth": max_depth})

    async def get_current_scene(self):
        return await self.request("/scene/current")

    async def load_scene(self, path: str):
        return await self.request("/scene/load", {"path": path})

    async def save_scene(self):
        return await self.request("/scene/save")

    # Node operations
    async def get_node_info(self, node_path: str):
        return await self.request("/node/info", {"node_path": node_path})

    async def get_node_properties(self, node_path: str):
        return await self.request("/node/properties", {"node_path": node_path})

    async def set_node_property(self, node_path: str, property: str, value):
        return await self.request("/node/set", {
            "node_path": node_path, "property": property, "value": value})

    async def create_node(self, parent_path: str, node_type: str, node_name: str):
        return await self.request("/node/create", {
            "parent_path": parent_path, "node_type": node_type, "node_name": node_name})

    async def delete_node(self, node_path: str):
        return await self.request("/node/delete", {"node_path": node_path})

    async def rename_node(self, node_path: str, new_name: str):
        return await self.request("/node/rename", {"node_path": node_path, "new_name": new_name})

    # Script operations
    async def get_node_script(self, node_path: str):
        return await self.request("/script/get", {"node_path": node_path})

    async def attach_script(self, node_path: str, script_path: str):
        return await self.request("/script/attach", {
            "node_path": node_path, "script_path": script_path})

    # Resource operations
    async def list_resources(self, directory: str = "res://", filter: str = ""):
        return await self.request("/resources/list", {
            "directory": directory or "res://", "filter": filter or ""})

    # Project settings
    async def list_project_settings(self, prefix: str = ""):
        return await self.request("/project/settings", {"prefix": prefix or ""})

    async def get_project_setting(self, name: str):
        return await self.request("/project/get", {"setting_name": name})

    async def set_project_setting(self, name: str, value):
        return await self.request("/project/set", {"setting_name": name, "value": value})

    # Input map
    async def list_input_actions(self):
        return await self.request("/input/actions")

    # Editor output
    async def read_editor_logs(self, max_lines: int = 100, filter_text: str | None = None):
        body = {"max_lines": max_lines}
        if filter_text:
            body["filter_text"] = filter_text
        return await self.request("/editor/output", body)

    # Editor dialogs
    async def list_dialogs(self):
        return await self.request("/editor/dialogs")

    async def dismiss_dialog(self, accept: bool = False, dialog_path: str | None = None):
        body: dict = {"accept": accept}
        if dialog_path:
            body["dialog_path"] = dialog_path
        return await self.request("/editor/dialog/dismiss", body)

    # Debugger operations
    async def get_debugger_sessions(self):
        return await self.request("/debugger/sessions")

    async def debug_resume(self, session_id: int = 0):
        return await self.request("/debugger/continue", {"session_id": session_id})

    async def debug_step_over(self, session_id: int = 0):
        return await self.request("/debugger/next", {"session_id": session_id})

    async def debug_step_into(self, session_id: int = 0):
        return await self.request("/debugger/step", {"session_id": session_id})

    # Health check
    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(f"{self.base_url}/health")
            return response.status_code < 400
        except Exception:
            return False
