"""WebSocket connection manager — singleton across routers."""
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}
        # Separate channel for agents (PAYBID) — receives auction invitations
        # and round events globally, keyed by "all" or by agent_id.
        self.agents: Dict[str, List[WebSocket]] = {}

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

    # === Agent global channel (PAYBID) ===
    async def connect_agent(self, agent_id: str, ws: WebSocket):
        await ws.accept()
        self.agents.setdefault(agent_id, []).append(ws)
        # Also subscribe to "all" so broadcasts hit them
        self.agents.setdefault("all", []).append(ws)

    def disconnect_agent(self, agent_id: str, ws: WebSocket):
        for key in (agent_id, "all"):
            if key in self.agents:
                try:
                    self.agents[key].remove(ws)
                except ValueError:
                    pass

    async def broadcast_agents(self, message: dict, agent_ids: list = None):
        """Push event to specific agents (list) or to all subscribed agents."""
        targets = []
        if agent_ids:
            for aid in agent_ids:
                targets.extend(self.agents.get(aid, []))
        else:
            targets = list(self.agents.get("all", []))
        seen = set()
        dead = []
        for ws in targets:
            if id(ws) in seen:
                continue
            seen.add(id(ws))
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            for key in list(self.agents.keys()):
                try:
                    self.agents[key].remove(ws)
                except ValueError:
                    pass


manager = ConnectionManager()

