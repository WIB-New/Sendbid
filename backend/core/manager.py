"""WebSocket connection manager — singleton across routers."""
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, transfer_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(transfer_id, []).append(ws)

    def disconnect(self, transfer_id: str, ws: WebSocket):
        if transfer_id in self.active:
            try:
                self.active[transfer_id].remove(ws)
            except ValueError:
                pass

    async def broadcast(self, transfer_id: str, message: dict):
        if transfer_id not in self.active:
            return
        dead = []
        for ws in self.active[transfer_id]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(transfer_id, ws)


manager = ConnectionManager()
