"""Restart-safe charging-session state machine, independent of frontend/Recorder."""
from __future__ import annotations

import math
from uuid import uuid4

GAP = 15 * 60
JUMP = 20  # a single reading this many points above the session's level must be confirmed by the next one


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError, OverflowError):
        return None


class ChargingEngine:
    def __init__(self, state=None):
        self.state = state or {"session": None, "off_since": None, "last": None}

    def feed(self, now, level, charging, capacity, dc=False, jump=JUMP):
        """Return changed sessions; timestamps in records are milliseconds for the card."""
        state = self.state
        session = state.get("session")
        changed = []
        if session and state.get("last") and now - state["last"] > GAP:
            session.update(e=state["last"] * 1000, live=False, gap=True)
            changed.append(dict(session))
            session = state["session"] = None
            state["off_since"] = None
        level = number(level)
        if level is not None and not 0 <= level <= 100:
            level = None
        if level == 0 and session and (session.get("to") or 0) > 5:
            level = None
        if charging is True and session is None:
            session = {
                "id": uuid4().hex, "s": now * 1000, "e": now * 1000,
                "from": level, "to": level, "kwh": None, "capacity": capacity,
                "live": True, "dc": bool(dc), "gap": False,
            }
            state["session"] = session
        if session:
            if charging is None:
                session["gap"] = True
            if level is not None:
                if session["from"] is None:
                    session["from"] = level
                top = session["to"] if session["to"] is not None else level
                candidate = state.pop("candidate", None)
                if level > top + jump and not (candidate is not None and level >= candidate - 2):
                    state["candidate"] = level  # one odd high reading (41, 97, 41) is not believed until it repeats
                else:
                    session["to"] = max(top, level)
            if session["from"] is not None and session["to"] is not None:
                session["kwh"] = max(0, session["to"] - session["from"]) * session["capacity"] / 100
            if charging is True:
                state["off_since"] = None
                session["e"] = now * 1000
                session["dc"] = session["dc"] or bool(dc)
            else:
                if state.get("off_since") is None:
                    state["off_since"] = now
                    session["e"] = now * 1000
                if now - state["off_since"] >= GAP:
                    session["live"] = False
                    state["session"] = None
                    state["off_since"] = None
            changed.append(dict(session))
        state["last"] = now
        return changed
