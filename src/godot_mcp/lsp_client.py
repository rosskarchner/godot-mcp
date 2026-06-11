"""Language Server Protocol client for Godot.

LSP uses JSON-RPC 2.0 over TCP with Content-Length headers (similar to DAP).
"""

import asyncio
import json
import os
import sys


def log(*args):
    print(*args, file=sys.stderr, flush=True)


class LSPClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 6005):
        self.host = host
        self.port = port
        self.reader: asyncio.StreamReader | None = None
        self.writer: asyncio.StreamWriter | None = None
        self.pending_requests: dict[int, asyncio.Future] = {}
        self.sequence = 1
        self.connected = False
        self.initialized = False
        self.diagnostics_map: dict[str, list] = {}
        self._reader_task: asyncio.Task | None = None

    async def connect(self):
        try:
            self.reader, self.writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port), timeout=5)
        except (asyncio.TimeoutError, OSError) as e:
            raise ConnectionError(f"LSP connection failed at {self.host}:{self.port}: {e}")

        self.connected = True
        log(f"Connected to Godot LSP port at {self.host}:{self.port}")
        self._reader_task = asyncio.get_event_loop().create_task(self._read_loop())

        result = await self.send_request("initialize", {
            "processId": os.getpid(),
            "clientInfo": {"name": "godot-mcp-server", "version": "1.0.0"},
            "rootUri": None,
            "capabilities": {
                "textDocument": {
                    "hover": {"contentFormat": ["markdown", "plaintext"]},
                    "completion": {
                        "completionItem": {
                            "snippetSupport": True,
                            "documentationFormat": ["markdown", "plaintext"],
                        }
                    },
                    "definition": {"linkSupport": True},
                    "documentSymbol": {"hierarchicalDocumentSymbolSupport": True},
                    "publishDiagnostics": {"relatedInformation": True},
                },
                "workspace": {
                    "symbol": {"symbolKind": {"valueSet": list(range(1, 27))}}
                },
            },
        })
        self.initialized = True
        await self.send_notification("initialized", {})
        log("LSP initialized successfully")
        return result

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
                        log(f"Error parsing LSP message: {e}")
        except Exception as e:
            log(f"LSP socket error: {e}")
        finally:
            self.connected = False
            self.initialized = False
            log("LSP connection closed")

    def _handle_message(self, message: dict):
        msg_id = message.get("id")
        if msg_id is not None and msg_id in self.pending_requests:
            future = self.pending_requests.pop(msg_id)
            if not future.done():
                if message.get("error"):
                    future.set_exception(
                        RuntimeError(message["error"].get("message") or "LSP request failed"))
                else:
                    future.set_result(message.get("result"))
        elif message.get("method"):
            # Notification
            if message["method"] == "textDocument/publishDiagnostics":
                params = message.get("params") or {}
                if params.get("uri"):
                    self.diagnostics_map[params["uri"]] = params.get("diagnostics", [])

    async def send_request(self, method: str, params: dict | None = None, timeout: float = 10):
        if not self.connected:
            raise ConnectionError("Not connected to Godot LSP port")

        msg_id = self.sequence
        self.sequence += 1
        body = json.dumps({
            "jsonrpc": "2.0", "id": msg_id, "method": method, "params": params or {}
        }).encode("utf-8")

        future = asyncio.get_event_loop().create_future()
        self.pending_requests[msg_id] = future

        self.writer.write(f"Content-Length: {len(body)}\r\n\r\n".encode() + body)
        await self.writer.drain()

        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            self.pending_requests.pop(msg_id, None)
            raise TimeoutError("LSP request timeout")

    async def send_notification(self, method: str, params: dict | None = None):
        if not self.connected:
            raise ConnectionError("Not connected to Godot LSP port")
        body = json.dumps({
            "jsonrpc": "2.0", "method": method, "params": params or {}
        }).encode("utf-8")
        self.writer.write(f"Content-Length: {len(body)}\r\n\r\n".encode() + body)
        await self.writer.drain()

    async def did_open_text_document(self, uri: str, language_id: str = "gdscript",
                                     version: int = 1, text: str = ""):
        await self.send_notification("textDocument/didOpen", {
            "textDocument": {
                "uri": uri, "languageId": language_id, "version": version, "text": text
            }
        })

    async def get_document_diagnostics(self, uri: str | None = None):
        """LSP sends diagnostics as notifications, so return cached values."""
        if uri:
            return self.diagnostics_map.get(uri, [])
        return dict(self.diagnostics_map)

    def _require_initialized(self):
        if not self.initialized:
            raise RuntimeError("LSP not initialized")

    async def hover(self, uri: str, line: int, character: int):
        self._require_initialized()
        return await self.send_request("textDocument/hover", {
            "textDocument": {"uri": uri},
            "position": {"line": line, "character": character},
        })

    async def definition(self, uri: str, line: int, character: int):
        self._require_initialized()
        return await self.send_request("textDocument/definition", {
            "textDocument": {"uri": uri},
            "position": {"line": line, "character": character},
        })

    async def completion(self, uri: str, line: int, character: int):
        self._require_initialized()
        return await self.send_request("textDocument/completion", {
            "textDocument": {"uri": uri},
            "position": {"line": line, "character": character},
        })

    async def document_symbols(self, uri: str):
        self._require_initialized()
        return await self.send_request("textDocument/documentSymbol", {
            "textDocument": {"uri": uri}
        })

    async def workspace_symbols(self, query: str = ""):
        self._require_initialized()
        return await self.send_request("workspace/symbol", {"query": query})

    def disconnect(self):
        if self._reader_task:
            self._reader_task.cancel()
            self._reader_task = None
        if self.writer:
            self.writer.close()
            self.writer = None
        self.reader = None
        self.connected = False
        self.initialized = False

    def is_connected(self) -> bool:
        return self.connected

    def is_initialized(self) -> bool:
        return self.initialized
