"""Debug Adapter Protocol client for Godot (JSON over TCP with Content-Length headers)."""

import asyncio
import json
import sys

LONG_RUNNING_COMMANDS = {"evaluate", "continue", "stepIn", "stepOut", "next"}


def log(*args):
    print(*args, file=sys.stderr, flush=True)


class DAPClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 6006):
        self.host = host
        self.port = port
        self.reader: asyncio.StreamReader | None = None
        self.writer: asyncio.StreamWriter | None = None
        self.pending_requests: dict[int, asyncio.Future] = {}
        self.sequence = 1
        self.connected = False
        self.attached = False
        self.events: list[dict] = []
        self._reader_task: asyncio.Task | None = None

    async def connect(self):
        try:
            self.reader, self.writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port), timeout=5)
        except (asyncio.TimeoutError, OSError) as e:
            raise ConnectionError(f"DAP connection failed at {self.host}:{self.port}: {e}")

        self.connected = True
        log(f"Connected to Godot debug port at {self.host}:{self.port}")
        self._reader_task = asyncio.get_event_loop().create_task(self._read_loop())

        await self.send_request("initialize", {
            "clientID": "godot-mcp-server",
            "adapterID": "godot",
            "linesStartAt1": True,
            "columnsStartAt1": True,
            "pathFormat": "path",
        })

    async def _read_loop(self):
        buffer = b""
        try:
            while True:
                data = await self.reader.read(65536)
                if not data:
                    break
                buffer += data
                while True:
                    header_end = buffer.find(b"\r\n\r\n")
                    if header_end == -1:
                        break
                    header = buffer[:header_end].decode("utf-8", "replace")
                    content_length = None
                    for line in header.split("\r\n"):
                        if line.lower().startswith("content-length:"):
                            content_length = int(line.split(":", 1)[1].strip())
                    if content_length is None:
                        buffer = buffer[header_end + 4:]
                        continue
                    total = header_end + 4 + content_length
                    if len(buffer) < total:
                        break
                    body = buffer[header_end + 4:total]
                    buffer = buffer[total:]
                    try:
                        self._handle_message(json.loads(body))
                    except json.JSONDecodeError as e:
                        log(f"Error parsing DAP message: {e}")
        except Exception as e:
            log(f"DAP socket error: {e}")
        finally:
            self.connected = False
            log("DAP connection closed")

    def _handle_message(self, message: dict):
        if message.get("type") == "response":
            future = self.pending_requests.pop(message.get("request_seq"), None)
            if future and not future.done():
                if message.get("success"):
                    future.set_result(message.get("body") or {})
                else:
                    future.set_exception(RuntimeError(message.get("message") or "Request failed"))
        elif message.get("type") == "event":
            self.events.append(message)

    async def send_request(self, command: str, args: dict | None = None,
                           timeout: float | None = None):
        if not self.connected:
            raise ConnectionError("Not connected to Godot debug port")

        if timeout is None:
            timeout = 30 if command in LONG_RUNNING_COMMANDS else 10

        seq = self.sequence
        self.sequence += 1
        request = {"type": "request", "seq": seq, "command": command, "arguments": args or {}}
        body = json.dumps(request).encode("utf-8")

        future = asyncio.get_event_loop().create_future()
        self.pending_requests[seq] = future

        self.writer.write(f"Content-Length: {len(body)}\r\n\r\n".encode() + body)
        await self.writer.drain()

        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            self.pending_requests.pop(seq, None)
            raise TimeoutError(f"Request timeout after {int(timeout * 1000)}ms")

    def disconnect(self):
        if self._reader_task:
            self._reader_task.cancel()
            self._reader_task = None
        if self.writer:
            self.writer.close()
            self.writer = None
        self.reader = None
        self.connected = False
        self.attached = False

    def is_connected(self) -> bool:
        return self.connected
