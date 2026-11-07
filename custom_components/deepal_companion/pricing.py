"""Deterministic fixed-tariff accounting; receipts take precedence over estimates."""
from __future__ import annotations

from .charging import number


def nonnegative(value):
    if value in (None, ""):
        return None
    n = number(value)
    return n if n is not None and n >= 0 else None


def calculate(session, record=None, readings=None, unit=""):
    if not record:
        return {"energy": None, "cost": None, "source": "unassigned", "estimated": True}
    profile = record["profile"]
    energy = nonnegative(record.get("energy"))
    source, estimated = "receipt", False
    kind = profile.get("source", "battery")
    if energy is None and kind != "battery":
        power = kind == "power"
        factor = ({"W": .001, "kW": 1} if power else {"Wh": .001, "kWh": 1}).get(unit)
        rows = [(t, n) for t, v in (readings or []) if (n := nonnegative(v)) is not None and t <= session["e"]]
        before = [r for r in rows if r[0] <= session["s"]]
        if factor is not None and before and session["s"] - before[-1][0] <= 20 * 60e3:
            previous, value, valid = before[-1], 0.0, True
            for row in (r for r in rows if r[0] > session["s"]):
                if row[0] - previous[0] > 20 * 60e3:
                    valid = False
                    break
                if power:
                    value += previous[1] * (row[0] - max(session["s"], previous[0])) / 36e5
                elif row[1] >= previous[1]:
                    value += row[1] - previous[1]
                else:
                    valid = False
                    break
                previous = row
            valid = valid and session["e"] - previous[0] <= 20 * 60e3
            if valid and power:
                value += previous[1] * (session["e"] - max(session["s"], previous[0])) / 36e5
            measured = nonnegative(value * factor)
            if valid and measured is not None and 0 < measured <= 1000000:
                energy, source, estimated = measured, "power" if power else "meter", power
    if energy is None:
        efficiency = number(profile.get("efficiency"))
        stored = session.get("kwh")
        if record.get("capacity") and session.get("to") is not None and session.get("from") is not None:
            stored = max(0, session["to"] - session["from"]) * record["capacity"] / 100
        energy = stored / (efficiency / 100) if stored and efficiency and 0 < efficiency <= 100 else None
        source, estimated = ("battery" if kind == "battery" else "fallback"), True
    total, price = nonnegative(record.get("total")), nonnegative(profile.get("price"))
    cost = total if total is not None else 0 if profile.get("free") else nonnegative(energy * price) if energy is not None and price is not None else None
    return {"energy": energy, "cost": cost, "source": source, "estimated": estimated,
            "cost_estimated": total is None and not profile.get("free") and estimated}
