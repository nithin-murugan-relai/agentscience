"""Local AgentScience backend sandbox for simulation runs.

Serves a minimal mock of the agentscience.app API on an ephemeral localhost port so
the agent's `agentscience auth whoami` validation passes without touching the real
backend. Every other route 404s, which keeps publish/registry writes impossible.
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer


class _Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, obj: dict) -> None:
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path.startswith("/api/v1/me"):
            self._send(200, {"id": "usr_relai_demo", "name": "RELAI Demo",
                             "email": "demo@relai.ai", "institution": "RELAI (sandbox)"})
        else:
            self._send(404, {"error": f"sandbox: no route {self.path}"})

    def do_POST(self) -> None:
        self._send(404, {"error": f"sandbox: no route {self.path}"})

    def log_message(self, fmt: str, *args) -> None:
        pass


class Sandbox:
    """Context manager: `with Sandbox() as base_url:` serves the mock for one run."""

    def __init__(self) -> None:
        self._server = HTTPServer(("127.0.0.1", 0), _Handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)

    def __enter__(self) -> str:
        self._thread.start()
        return f"http://127.0.0.1:{self._server.server_port}"

    def __exit__(self, *exc) -> None:
        self._server.shutdown()
        self._server.server_close()
