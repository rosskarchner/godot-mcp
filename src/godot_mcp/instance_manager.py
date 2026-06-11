"""Manages Godot editor instances: launch, adopt, monitor, terminate.

Instance IDs are absolute project paths. State persists to .instances.json
at the repository root so sessions survive server restarts.
"""

import asyncio
import json
import os
import shutil
import signal
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

MODULE_DIR = Path(__file__).resolve().parent
REPO_ROOT = MODULE_DIR.parents[1]


def log(*args):
    print(*args, file=sys.stderr, flush=True)


def pid_running(pid: int) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


class InstanceManager:
    def __init__(self):
        self.instances: dict[str, dict] = {}  # project path (id) -> instance info
        self.base_port = 6005
        self.port_spacing = 10
        self.state_file_path = REPO_ROOT / ".instances.json"
        self._monitor_tasks: dict[str, asyncio.Task] = {}

    async def load_state(self):
        """Restore previous sessions whose processes are still alive."""
        try:
            if not self.state_file_path.exists():
                return
            state = json.loads(self.state_file_path.read_text())

            for item in state:
                instance_id = item["projectPath"]
                if pid_running(item.get("pid", 0)):
                    info = {
                        "id": instance_id,
                        "projectPath": item["projectPath"],
                        "ports": item["ports"],
                        "pid": item["pid"],
                        "process": None,
                        "status": "running (restored)",
                        "launchedAt": item.get("launchedAt"),
                    }
                    self.instances[instance_id] = info
                    log(f"[InstanceManager] Restored session for {instance_id} (PID {item['pid']})")
                    self._monitor_pid(info)
                else:
                    log(f"[InstanceManager] Discarding dead session {instance_id} (PID {item.get('pid')})")
        except Exception as e:
            log(f"[InstanceManager] Failed to load state: {e}")

    async def save_state(self):
        state = []
        for info in self.instances.values():
            proc = info.get("process")
            state.append({
                "id": info["id"],
                "pid": proc.pid if proc else info.get("pid", 0),
                "projectPath": info["projectPath"],
                "ports": info["ports"],
                "launchedAt": info.get("launchedAt"),
            })
        try:
            self.state_file_path.write_text(json.dumps(state, indent=2))
        except Exception as e:
            log(f"[InstanceManager] Failed to save state: {e}")

    def _monitor_pid(self, instance: dict):
        """Poll an external/restored PID and drop the instance when it exits."""
        async def watch():
            while True:
                await asyncio.sleep(5)
                proc = instance.get("process")
                alive = (proc.poll() is None) if proc else pid_running(instance.get("pid", 0))
                if not alive:
                    log(f"[InstanceManager] Instance {instance['id']} exited")
                    self.instances.pop(instance["id"], None)
                    self._monitor_tasks.pop(instance["id"], None)
                    await self.save_state()
                    return

        self._monitor_tasks[instance["id"]] = asyncio.get_event_loop().create_task(watch())

    def allocate_ports(self) -> dict:
        index = 0
        while True:
            test_lsp = self.base_port + index * self.port_spacing
            if not any(i["ports"]["lsp"] == test_lsp for i in self.instances.values()):
                break
            index += 1

        base_offset = index * self.port_spacing
        return {
            "lsp": self.base_port + base_offset,
            "dap": self.base_port + 1 + base_offset,
            "editorApi": 8765 + index * 10,
            "gameBridge": 8766 + index * 10,
        }

    async def adopt_instance(self, project_path: str, custom_ports: dict | None = None) -> dict:
        custom_ports = custom_ports or {}
        project_path = str(Path(project_path).resolve())

        if project_path in self.instances:
            return self.instances[project_path]

        ports = {
            "lsp": custom_ports.get("lsp_port") or 6005,
            "dap": custom_ports.get("dap_port") or 6006,
            "editorApi": custom_ports.get("editor_port") or 8765,
            "gameBridge": custom_ports.get("game_bridge_port") or 8766,
        }

        info = {
            "id": project_path,
            "projectPath": project_path,
            "ports": ports,
            "process": None,
            "pid": 0,
            "status": "adopted",
            "launchedAt": datetime.now(timezone.utc).isoformat(),
        }
        self.instances[project_path] = info
        await self.save_state()
        return info

    async def launch_instance(self, project_path: str, godot_path: str | None = None,
                              headless: bool = False) -> dict:
        project_path = str(Path(project_path).resolve())

        if project_path in self.instances:
            return self.instances[project_path]

        instance_id = project_path
        ports = self.allocate_ports()
        log(f"[InstanceManager] Launching '{Path(project_path).name}' ({project_path}) on ports: {ports}")

        await self.inject_mcp_support(project_path, ports)

        godot = godot_path or "godot"
        args = [
            godot,
            "--path", project_path,
            "--editor",
            f"--remote-debug-port={ports['dap']}",
            f"--language-server-port={ports['lsp']}",
        ]
        if headless:
            args.append("--headless")

        log(f"[InstanceManager] Executing: {' '.join(args)}")

        out_log = open(Path(project_path) / "godot_access.log", "a")
        err_log = open(Path(project_path) / "godot_error.log", "a")

        env = dict(os.environ)
        # Ensure XDG_RUNTIME_DIR is set (critical for Wayland/Godot)
        if not env.get("XDG_RUNTIME_DIR"):
            env["XDG_RUNTIME_DIR"] = f"/run/user/{os.getuid()}"
        log(f"[InstanceManager] Launching with XDG_RUNTIME_DIR: {env['XDG_RUNTIME_DIR']}")

        process = subprocess.Popen(
            args,
            stdin=subprocess.DEVNULL,
            stdout=out_log,
            stderr=err_log,
            env=env,
        )
        out_log.close()
        err_log.close()

        info = {
            "id": instance_id,
            "projectPath": project_path,
            "ports": ports,
            "process": process,
            "pid": process.pid,
            "status": "starting",
            "launchedAt": datetime.now(timezone.utc).isoformat(),
        }
        self.instances[instance_id] = info
        await self.save_state()
        self._monitor_pid(info)

        info["status"] = "running"
        return info

    async def inject_mcp_support(self, project_path: str, ports: dict):
        addon_source_dir = REPO_ROOT / "addon_template" / "addons" / "godot_mcp_bridge"
        addon_target_dir = Path(project_path) / "addons" / "godot_mcp_bridge"
        shutil.copytree(addon_source_dir, addon_target_dir, dirs_exist_ok=True)

        template_path = addon_target_dir / "mcp_config.gd.template"
        config_path = addon_target_dir / "mcp_config.gd"

        if template_path.exists():
            template = template_path.read_text()
            template = template.replace("8765", str(ports["editorApi"]), 1)
            template = template.replace("8766", str(ports["gameBridge"]), 1)
            config_path.write_text(template)
            template_path.unlink(missing_ok=True)

        self.modify_project_file(Path(project_path) / "project.godot")

    def modify_project_file(self, project_file: Path):
        if not project_file.exists():
            raise FileNotFoundError(f"project.godot not found at {project_file}")

        content = project_file.read_text()
        changed = False

        if "[autoload]" not in content:
            content += "\n[autoload]\n\n"
            changed = True

        autoload_line = 'MCPGameBridge="*res://addons/godot_mcp_bridge/runtime/game_bridge.gd"'
        if "MCPGameBridge=" not in content:
            content = content.replace("[autoload]", f"[autoload]\n\n{autoload_line}", 1)
            changed = True

        if "[editor_plugins]" not in content:
            content += "\n[editor_plugins]\n\n"
            changed = True

        plugin_path = "res://addons/godot_mcp_bridge/plugin.cfg"
        if plugin_path not in content:
            import re
            match = re.search(r"enabled=PackedStringArray\((.*)\)", content)
            if match:
                existing = match.group(1)
                new_array = f'{existing}, "{plugin_path}"' if existing else f'"{plugin_path}"'
                content = re.sub(r"enabled=PackedStringArray\(.*\)",
                                 f"enabled=PackedStringArray({new_array})", content, count=1)
            else:
                content = content.replace(
                    "[editor_plugins]",
                    f'[editor_plugins]\n\nenabled=PackedStringArray("{plugin_path}")', 1)
            changed = True

        if changed:
            project_file.write_text(content)
            log("[InstanceManager] Updated project.godot")

    def get_instance(self, identifier: str | None) -> dict | None:
        if not identifier:
            return None
        if identifier in self.instances:
            return self.instances[identifier]
        try:
            resolved = str(Path(identifier).resolve())
            if resolved in self.instances:
                return self.instances[resolved]
        except Exception:
            pass
        return None

    def list_instances(self) -> list[dict]:
        return [
            {"id": i["id"], "ports": i["ports"], "status": i["status"]}
            for i in self.instances.values()
        ]

    async def terminate_instance(self, identifier: str) -> bool:
        instance = self.get_instance(identifier)
        if not instance:
            return False

        proc = instance.get("process")
        if proc:
            proc.terminate()
        elif instance.get("pid"):
            try:
                os.kill(instance["pid"], signal.SIGTERM)
            except OSError:
                pass

        task = self._monitor_tasks.pop(instance["id"], None)
        if task:
            task.cancel()

        self.instances.pop(instance["id"], None)
        await self.save_state()
        return True
