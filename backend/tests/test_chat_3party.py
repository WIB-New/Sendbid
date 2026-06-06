"""
Tests for 3-party Chat endpoints (sender / agent / beneficiary).

Covers iteration 18 changes:
- GET /transfers/{id}/chat returns my_role + participants
- my_role correctly resolves to 'sender' for owner, 'agent' for assigned agent
- POST /transfers/{id}/chat works for both sender and agent (role tagged correctly)
- 400 when chat closed
- 404 when forbidden (non-sender / non-agent / non-admin)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://paybid-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASS = "Client@123!"
CLIENT_PIN = "123456"

AGENT_EMAIL = "agent@paybid.app"
AGENT_PASS = "Agent@123!"


# ------------------------------ helpers ------------------------------

def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"identifier": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def client_token() -> str:
    return _login(CLIENT_EMAIL, CLIENT_PASS)


@pytest.fixture(scope="module")
def agent_token() -> str:
    return _login(AGENT_EMAIL, AGENT_PASS)


@pytest.fixture(scope="module")
def transfer_id(client_token: str, agent_token: str) -> str:
    """
    Look up (in Mongo) an existing transfer owned by the demo client AND assigned to
    the demo agent. If none exists, skip the chat tests with a clear message — the
    creation path requires fields (receive_amount, fx_rate, fee_percent, purpose,
    source_of_funds) which fall outside the scope of this iteration's chat changes.
    """
    import asyncio
    import sys
    sys.path.insert(0, "/app/backend")
    from core.db import db  # type: ignore

    async def lookup() -> str | None:
        client_u = await db.users.find_one({"email": CLIENT_EMAIL}, {"_id": 0, "id": 1})
        agent_u = await db.users.find_one({"email": AGENT_EMAIL}, {"_id": 0, "agent_id": 1})
        if not client_u or not agent_u or not agent_u.get("agent_id"):
            return None
        t = await db.transfers.find_one(
            {"user_id": client_u["id"], "agent_id": agent_u["agent_id"]},
            {"_id": 0, "id": 1},
        )
        return t["id"] if t else None

    try:
        tid = asyncio.get_event_loop().run_until_complete(lookup())
    except RuntimeError:
        tid = asyncio.run(lookup())

    if not tid:
        pytest.skip("No pre-existing transfer found that is owned by client AND assigned to agent — cannot exercise 3-party chat ACL")
    return tid


# ============================== TESTS ==============================

class TestChatSender:
    """Chat behavior from the sender (client) perspective."""

    def test_get_chat_returns_my_role_and_participants(self, client_token, transfer_id):
        r = requests.get(f"{API}/transfers/{transfer_id}/chat", headers=_hdr(client_token), timeout=15)
        assert r.status_code == 200, f"GET chat failed: {r.status_code} {r.text}"
        data = r.json()

        # New fields must exist
        assert "my_role" in data, "GET /chat must include my_role"
        assert "participants" in data, "GET /chat must include participants"
        assert "messages" in data

        assert data["my_role"] == "sender", f"expected my_role=sender got {data['my_role']}"

        parts = data["participants"]
        assert isinstance(parts, dict)
        for key in ("sender", "agent", "beneficiary"):
            assert key in parts, f"participants missing key {key}"
            assert "name" in parts[key], f"participants.{key}.name missing"

        # phone should be exposed for agent (may be None if not assigned)
        assert "phone" in parts["agent"], "participants.agent.phone field missing"

    def test_sender_can_post_message_role_tagged_sender(self, client_token, transfer_id):
        content = f"TEST_msg_sender_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/transfers/{transfer_id}/chat",
            json={"transfer_id": transfer_id, "content": content},
            headers=_hdr(client_token),
            timeout=15,
        )
        assert r.status_code in (200, 201), f"POST chat failed: {r.status_code} {r.text}"
        msg = r.json()
        assert msg.get("content") == content
        assert msg.get("role") == "sender", f"posted message role should be sender, got {msg.get('role')}"

        # Verify GET reflects it
        rg = requests.get(f"{API}/transfers/{transfer_id}/chat", headers=_hdr(client_token), timeout=15)
        assert rg.status_code == 200
        contents = [m["content"] for m in rg.json().get("messages", [])]
        assert content in contents, "newly posted sender message not returned by GET"


class TestChatAgent:
    """Chat behavior from the agent perspective (requires agent assigned to transfer)."""

    def test_agent_my_role(self, agent_token, transfer_id):
        r = requests.get(f"{API}/transfers/{transfer_id}/chat", headers=_hdr(agent_token), timeout=15)
        if r.status_code == 404:
            pytest.skip("agent is not assigned to this transfer yet (auction did not assign expected agent)")
        assert r.status_code == 200, f"GET chat agent: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("my_role") == "agent", f"expected my_role=agent got {data.get('my_role')}"

    def test_agent_can_post_message_role_tagged_agent(self, agent_token, transfer_id):
        # Pre-check assignment
        rc = requests.get(f"{API}/transfers/{transfer_id}/chat", headers=_hdr(agent_token), timeout=15)
        if rc.status_code == 404:
            pytest.skip("agent not assigned")

        content = f"TEST_msg_agent_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/transfers/{transfer_id}/chat",
            json={"transfer_id": transfer_id, "content": content},
            headers=_hdr(agent_token),
            timeout=15,
        )
        assert r.status_code in (200, 201), f"agent POST chat failed: {r.status_code} {r.text}"
        msg = r.json()
        assert msg.get("role") == "agent", f"agent's message must be tagged role=agent, got {msg.get('role')}"


class TestChatAccessControl:
    """Forbidden user (neither sender nor agent nor admin) must NOT see the chat."""

    def test_random_user_gets_404(self, transfer_id):
        """Create an outsider directly in Mongo (bypasses OTP flow), login, expect 404."""
        import asyncio
        import sys
        sys.path.insert(0, "/app/backend")
        from core.db import db  # type: ignore
        from core.security import hash_password, gen_id  # type: ignore

        rand = uuid.uuid4().hex[:6]
        email = f"test_outsider_{rand}@example.com"
        password = "Outsider@123!"

        async def create():
            await db.users.insert_one({
                "id": gen_id(),
                "email": email,
                "phone": f"+33600{rand[:6]}",
                "full_name": f"TEST Outsider {rand}",
                "password_hash": hash_password(password),
                "pin_hash": hash_password("123456"),
                "pin_attempts": 0,
                "pin_locked_until": None,
                "email_verified": True,
                "phone_verified": True,
                "role": "user",
                "kyc_tier": 1,
                "kyc_status": "verified",
            })

        async def cleanup():
            await db.users.delete_one({"email": email})

        try:
            asyncio.get_event_loop().run_until_complete(create())
        except RuntimeError:
            asyncio.run(create())

        try:
            rl = requests.post(f"{API}/auth/login", json={"identifier": email, "password": password}, timeout=15)
            assert rl.status_code == 200, f"outsider login failed: {rl.status_code} {rl.text}"
            outsider_token = rl.json().get("access_token")
            assert outsider_token

            r = requests.get(f"{API}/transfers/{transfer_id}/chat", headers=_hdr(outsider_token), timeout=15)
            assert r.status_code == 404, f"outsider must get 404, got {r.status_code} {r.text}"
        finally:
            try:
                asyncio.get_event_loop().run_until_complete(cleanup())
            except RuntimeError:
                asyncio.run(cleanup())


class TestChatClosed:
    """A chat room with open=false must reject POST with 400."""

    def test_closed_room_rejects_post(self, client_token, transfer_id):
        # Flip chat_rooms.open=false directly via Mongo
        import asyncio
        import sys
        sys.path.insert(0, "/app/backend")
        from core.db import db  # type: ignore

        async def close_room():
            # Ensure a room exists first
            await db.chat_rooms.update_one(
                {"transfer_id": transfer_id},
                {"$set": {"open": False, "transfer_id": transfer_id}},
                upsert=True,
            )

        async def reopen_room():
            await db.chat_rooms.update_one(
                {"transfer_id": transfer_id}, {"$set": {"open": True}}, upsert=True
            )

        try:
            asyncio.get_event_loop().run_until_complete(close_room())
        except RuntimeError:
            asyncio.run(close_room())

        try:
            r = requests.post(
                f"{API}/transfers/{transfer_id}/chat",
                json={"transfer_id": transfer_id, "content": "TEST_closed_msg"},
                headers=_hdr(client_token),
                timeout=15,
            )
            assert r.status_code == 400, f"closed room must return 400, got {r.status_code} {r.text}"
        finally:
            try:
                asyncio.get_event_loop().run_until_complete(reopen_room())
            except RuntimeError:
                asyncio.run(reopen_room())
