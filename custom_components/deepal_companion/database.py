"""Versioned SQLite archive. All methods run on HA's executor, never its event loop."""
from __future__ import annotations

from contextlib import closing, contextmanager
from copy import deepcopy
import json
from pathlib import Path
import sqlite3
import time
from uuid import uuid4

from .const import DEFAULT_PROFILES, DEFAULT_PROMPT_MIN_GAIN, DEFAULT_PROMPT_RECENT, RANGES, SHARED_KEYS
from .storage import HistoryStorage

UNDO_DAYS = 30  # a deleted charge can be restored for this long


def encode(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


class Database(HistoryStorage):
    """Connections are short-lived; the caller serializes operations with an async lock."""

    def __init__(self, path: str):
        self.path = path

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            db.execute("PRAGMA foreign_keys=ON")
            with db:
                yield db
        finally:
            db.close()

    def initialize(self):
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table'").fetchone():
                db.execute("PRAGMA auto_vacuum=INCREMENTAL")
            db.execute("PRAGMA journal_mode=WAL")
            version = db.execute("PRAGMA user_version").fetchone()[0]
            if version > 2:
                raise RuntimeError("Archive was created by a newer Companion version")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS vehicles (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, config TEXT NOT NULL,
                    created REAL NOT NULL, revision INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS views (
                    id TEXT PRIMARY KEY, vehicle TEXT NOT NULL REFERENCES vehicles(id),
                    name TEXT NOT NULL, config TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS kv (
                    vehicle TEXT NOT NULL REFERENCES vehicles(id), key TEXT NOT NULL,
                    value TEXT NOT NULL, PRIMARY KEY(vehicle,key)
                );
                CREATE TABLE IF NOT EXISTS readings (
                    vehicle TEXT NOT NULL REFERENCES vehicles(id), entity TEXT NOT NULL,
                    t REAL NOT NULL, state TEXT NOT NULL, unit TEXT NOT NULL DEFAULT '',
                    PRIMARY KEY(vehicle,entity,t)
                );
                CREATE INDEX IF NOT EXISTS readings_time ON readings(vehicle,t);
                CREATE TABLE IF NOT EXISTS reading_blocks (
                    vehicle TEXT NOT NULL REFERENCES vehicles(id), entity TEXT NOT NULL,
                    bucket REAL NOT NULL, count INTEGER NOT NULL, data BLOB NOT NULL,
                    PRIMARY KEY(vehicle,entity,bucket)
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY, vehicle TEXT NOT NULL REFERENCES vehicles(id),
                    start REAL NOT NULL, end REAL NOT NULL, active INTEGER NOT NULL,
                    data TEXT NOT NULL, UNIQUE(vehicle,start)
                );
                CREATE INDEX IF NOT EXISTS sessions_time ON sessions(vehicle,start);
                CREATE TABLE IF NOT EXISTS session_costs (
                    vehicle TEXT NOT NULL REFERENCES vehicles(id),
                    session TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                    cost REAL, PRIMARY KEY(vehicle,session)
                );
                CREATE INDEX IF NOT EXISTS session_costs_order ON session_costs(vehicle,cost);
                CREATE TABLE IF NOT EXISTS reading_exclusions (
                    vehicle TEXT NOT NULL REFERENCES vehicles(id), entity TEXT NOT NULL,
                    start REAL NOT NULL, end REAL NOT NULL, created REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS reading_exclusions_time ON reading_exclusions(vehicle,entity,start);
                PRAGMA user_version=2;
            """)
            if "deleted" not in {r["name"] for r in db.execute("PRAGMA table_info(sessions)")}:
                db.execute("ALTER TABLE sessions ADD COLUMN deleted REAL")  # when a user removed the charge; NULL = kept

    def ensure_vehicle(self, vehicle, name, config):
        config = {**config, "_configured_prefix": config["prefix"],
                  "_configured_battery": config["battery_entity"]}
        # Setup appearance seeds profiles once; each profile stays independent.
        appearance = {key: config.pop(key) for key in ("car_color", "iso_wheels") if key in config}
        with self.connect() as db:
            exists = db.execute("SELECT id FROM vehicles WHERE id=?", (vehicle,)).fetchone()
            if not exists:
                db.execute("INSERT INTO vehicles(id,name,config,created) VALUES(?,?,?,?)",
                           (vehicle, name, encode(config), time.time()))
                for label in ("Mobile", "Tablet", "Energy"):
                    view_config = dict(appearance)
                    if label == "Energy":
                        view_config.update({"hidden": ["actions", "diagnostics", "charge", "costs"], "info": ["odometer", "fuel_level"]})
                    db.execute("INSERT INTO views(id,vehicle,name,config) VALUES(?,?,?,?)",
                               (uuid4().hex, vehicle, label, encode(view_config)))
                db.execute("INSERT INTO kv VALUES(?,?,?)",
                           (vehicle, "costs", encode({"profiles": deepcopy(DEFAULT_PROFILES), "sessions": {}})))
            else:
                # Options update the source entity, without overwriting appearance/settings.
                row = db.execute("SELECT config FROM vehicles WHERE id=?", (vehicle,)).fetchone()
                current = json.loads(row["config"])
                if current.get("_configured_prefix") != config["_configured_prefix"]:
                    current["prefix"] = config["prefix"]
                if current.get("_configured_battery") != config["_configured_battery"]:
                    current["battery_entity"] = config["battery_entity"]
                    current["entities"] = {**current.get("entities", {}), **config["entities"]}
                # A vehicle created before the type was stored takes the type confirmed in setup;
                # any stored choice, including an explicit "auto", is never overwritten.
                # Only an explicit Settings choice ("_powertrain_explicit") is kept; anything else,
                # including a default "auto" saved by an older version, takes the setup type.
                if not current.get("_powertrain_explicit") and config.get("powertrain") in {"auto", "phev", "ev"}:
                    current["powertrain"] = config["powertrain"]
                current["_configured_prefix"] = config["_configured_prefix"]
                current["_configured_battery"] = config["_configured_battery"]
                db.execute("UPDATE vehicles SET name=?, config=? WHERE id=?", (name, encode(current), vehicle))

    def list_vehicles(self):
        with self.connect() as db:
            return [
                {"id": r["id"], "name": r["name"], "config": json.loads(r["config"]),
                 "views": [{"id": v["id"], "name": v["name"], "revision": v["revision"]}
                           for v in db.execute("SELECT * FROM views WHERE vehicle=? ORDER BY rowid", (r["id"],))]}
                for r in db.execute("SELECT * FROM vehicles ORDER BY created")
            ]

    def config(self, vehicle, view=None):
        with self.connect() as db:
            car = db.execute("SELECT * FROM vehicles WHERE id=?", (vehicle,)).fetchone()
            if not car:
                raise ValueError("Unknown vehicle")
            v = db.execute("SELECT * FROM views WHERE vehicle=? AND id=?", (vehicle, view)).fetchone() if view else db.execute(
                "SELECT * FROM views WHERE vehicle=? ORDER BY rowid LIMIT 1", (vehicle,)).fetchone()
            if not v:
                raise ValueError("Unknown display profile")
            shared = json.loads(car["config"])
            # Internal source fields never reach the renderer's settings object.
            shared.pop("battery_entity", None)
            shared = {k: v for k, v in shared.items() if not k.startswith("_")}
            # Car colour and wheels became vehicle-wide: until one is saved at vehicle level, every profile
            # uses the value already chosen in the oldest profile that has one (nothing is overwritten).
            for key in ("car_color", "iso_wheels"):
                if key not in shared:
                    for row in db.execute("SELECT config FROM views WHERE vehicle=? ORDER BY rowid", (vehicle,)):
                        local = json.loads(row["config"])
                        if key in local:
                            shared[key] = local[key]
                            break
            return {"vehicle_id": vehicle, "view_id": v["id"], "view_name": v["name"],
                    "revision": [car["revision"], v["revision"]],
                    "config": {**json.loads(v["config"]), **shared}}

    def patch_config(self, vehicle, view, patch, reset=False, expected_revision=None):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            v = db.execute("SELECT * FROM views WHERE vehicle=? AND id=?", (vehicle, view)).fetchone()
            if not v:
                raise ValueError("Unknown display profile")
            car = db.execute("SELECT * FROM vehicles WHERE id=?", (vehicle,)).fetchone()
            if expected_revision is not None and [car["revision"], v["revision"]] != expected_revision:
                raise ValueError("Settings changed elsewhere. Reload before saving.")
            common = json.loads(car["config"])
            original = json.loads(car["config"])
            local = {} if reset else json.loads(v["config"])
            for key, value in patch.items():
                if key in SHARED_KEYS:
                    common[key] = value
                    if key == "powertrain":
                        common["_powertrain_explicit"] = True
                elif key not in {"type", "vehicle_id", "view_id", "battery_entity"}:
                    local[key] = value
            if common != original:  # only shared settings invalidate every open card
                db.execute("UPDATE vehicles SET config=?,revision=revision+1 WHERE id=?", (encode(common), vehicle))
            db.execute("UPDATE views SET config=?,revision=revision+1 WHERE id=?", (encode(local), view))
        return self.config(vehicle, view)

    def view(self, vehicle, action, view=None, name="", source=None):
        with self.connect() as db:
            if not db.execute("SELECT 1 FROM vehicles WHERE id=?", (vehicle,)).fetchone():
                raise ValueError("Unknown vehicle")
            if action == "create":
                cfg = {}
                if source:
                    row = db.execute("SELECT config FROM views WHERE vehicle=? AND id=?", (vehicle, source)).fetchone()
                    if not row:
                        raise ValueError("Unknown source profile")
                    cfg = json.loads(row["config"])
                view = uuid4().hex
                db.execute("INSERT INTO views(id,vehicle,name,config) VALUES(?,?,?,?)",
                           (view, vehicle, name or "New view", encode(cfg)))
            elif action == "rename":
                if not db.execute("UPDATE views SET name=? WHERE vehicle=? AND id=?", (name, vehicle, view)).rowcount:
                    raise ValueError("Unknown display profile")
            elif action == "delete":
                if db.execute("SELECT COUNT(*) FROM views WHERE vehicle=?", (vehicle,)).fetchone()[0] <= 1:
                    raise ValueError("Keep at least one display profile")
                db.execute("DELETE FROM views WHERE vehicle=? AND id=?", (vehicle, view))
            else:
                raise ValueError("Unknown profile action")
        return {"view_id": view}

    def get(self, vehicle, key, default=None):
        with self.connect() as db:
            row = db.execute("SELECT value FROM kv WHERE vehicle=? AND key=?", (vehicle, key)).fetchone()
            return json.loads(row["value"]) if row else default

    def put(self, vehicle, key, value):
        with self.connect() as db:
            db.execute("INSERT INTO kv VALUES(?,?,?) ON CONFLICT(vehicle,key) DO UPDATE SET value=excluded.value",
                       (vehicle, key, encode(value)))

    def sample(self, vehicle, entity, t, state, unit=""):
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO readings VALUES(?,?,?,?,?)", (vehicle, entity, t, str(state), unit))

    def last_good_readings(self, vehicle, entities):
        """Last stored state per entity, skipping later 'unavailable' readings. Entities with no reading are left out."""
        result = {}
        with self.connect() as db:
            for entity in entities:
                row = db.execute("SELECT state FROM readings WHERE vehicle=? AND entity=? AND state!='unavailable' ORDER BY t DESC LIMIT 1",
                                 (vehicle, entity)).fetchone()
                if row:
                    result[entity] = row["state"]
        return result

    def save_costs(self, vehicle, value, expected=None):
        """Reject stale editors before they can replace another user's receipts."""
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT value FROM kv WHERE vehicle=? AND key='costs'", (vehicle,)).fetchone()
            current = json.loads(row["value"]) if row else {}
            if expected is not None and current != expected:
                raise ValueError("Charging settings changed elsewhere. Cancel changes and reload before saving.")
            db.execute("INSERT INTO kv VALUES(?,?,?) ON CONFLICT(vehicle,key) DO UPDATE SET value=excluded.value",
                       (vehicle, "costs", encode(value)))

    def record_update(self, vehicle, samples, sessions, engine):
        """Commit telemetry, sessions and restart state together, or none of them."""
        with self.connect() as db:
            db.executemany("INSERT OR REPLACE INTO readings VALUES(?,?,?,?,?)",
                           [(vehicle, entity, t, str(state), unit) for entity, t, state, unit in samples])
            for data in sessions:
                db.execute("""INSERT INTO sessions(id,vehicle,start,end,active,data) VALUES(?,?,?,?,?,?)
                              ON CONFLICT(vehicle,start) DO UPDATE SET
                              end=excluded.end,active=excluded.active,data=excluded.data""",
                           (data["id"], vehicle, data["s"] / 1000, data["e"] / 1000, int(data["live"]), encode(data)))
                if not data["live"]:
                    self._queue_prompt(db, vehicle, data["id"])
            db.execute("INSERT INTO kv VALUES(?,?,?) ON CONFLICT(vehicle,key) DO UPDATE SET value=excluded.value",
                       (vehicle, "engine", encode(engine)))

    @staticmethod
    def _prompt_queue(db, vehicle):
        """Charges waiting for a profile, oldest first. It is kept apart from the session list so new charges never push an unanswered one out."""
        saved = db.execute("SELECT value FROM kv WHERE vehicle=? AND key='charge_prompt_queue'", (vehicle,)).fetchone()
        if saved:
            return list(json.loads(saved["value"]))
        # First use after an update: start from the latest charges, so older history does not suddenly ask.
        rows = db.execute("SELECT id FROM sessions WHERE vehicle=? AND active=0 ORDER BY start DESC LIMIT ?", (vehicle, DEFAULT_PROMPT_RECENT)).fetchall()
        return [row["id"] for row in reversed(rows)]

    @staticmethod
    def _store_prompt_queue(db, vehicle, queue):
        db.execute("INSERT INTO kv VALUES(?,?,?) ON CONFLICT(vehicle,key) DO UPDATE SET value=excluded.value",
                   (vehicle, "charge_prompt_queue", encode(queue)))  # unanswered charges are never dropped silently

    @staticmethod
    def _queue_prompt(db, vehicle, session):
        queue = Database._prompt_queue(db, vehicle)
        if session not in queue:
            Database._store_prompt_queue(db, vehicle, [*queue, session])
        elif not db.execute("SELECT 1 FROM kv WHERE vehicle=? AND key='charge_prompt_queue'", (vehicle,)).fetchone():
            Database._store_prompt_queue(db, vehicle, queue)

    def patch_costs(self, vehicle, changes, expected, validate=None):
        """Save only edited tariffs/receipts, with conflict checks scoped to those edits.

        `validate` checks the final merged state before it is written, in the same transaction."""
        if not isinstance(expected, dict) or set(expected) != set(changes):
            raise ValueError("Reload charging settings before saving")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT value FROM kv WHERE vehicle=? AND key='costs'", (vehicle,)).fetchone()
            current = json.loads(row["value"]) if row else {"profiles": [], "sessions": {}}
            if "profiles" in changes:
                if expected["profiles"] != current["profiles"]:
                    raise ValueError("Charging profiles changed elsewhere. Reload before saving.")
                current["profiles"] = changes["profiles"]
            if "sessions" in changes:
                previous = expected["sessions"]
                if not isinstance(previous, dict) or set(previous) != set(changes["sessions"]):
                    raise ValueError("Reload charging receipts before saving")
                for ident, value in changes["sessions"].items():
                    if previous[ident] != current["sessions"].get(ident):
                        raise ValueError("This charging receipt changed elsewhere. Reload before saving.")
                    current["sessions"][ident] = value
            if validate is not None:
                current = validate(current)
            db.execute("INSERT INTO kv VALUES(?,?,?) ON CONFLICT(vehicle,key) DO UPDATE SET value=excluded.value",
                       (vehicle, "costs", encode(current)))

    def pricing_inputs(self, vehicle, requests):
        """Batch historical meter reads in one executor job/connection."""
        result = {}
        with self.connect() as db:
            for key, entity, start, end in requests:
                rows = self._history_rows(db, vehicle, entity, start, end)
                unit = self._prior_reading(db, vehicle, entity, end, unit_only=True)
                result[key] = {"readings": [[r["t"] * 1000, r["state"]] for r in rows], "unit": unit["unit"] if unit else ""}
        return result

    def history(self, vehicle, entities, start, end):
        result = {}
        with self.connect() as db:
            for entity in entities:
                rows = self._history_rows(db, vehicle, entity, start, end)
                result[entity] = [{"lu": r["t"], "s": r["state"]} for r in rows]
        return result

    def save_session(self, vehicle, data):
        with self.connect() as db:
            db.execute("""INSERT INTO sessions(id,vehicle,start,end,active,data) VALUES(?,?,?,?,?,?)
                          ON CONFLICT(vehicle,start) DO UPDATE SET
                          end=excluded.end,active=excluded.active,data=excluded.data""",
                       (data["id"], vehicle, data["s"] / 1000, data["e"] / 1000, int(data["live"]), encode(data)))
            if not data["live"]:
                self._queue_prompt(db, vehicle, data["id"])

    def import_sessions(self, vehicle, rows, entities=None):
        """Archive recovered completed charges without replacing canonical or overlapping sessions."""
        count = 0
        with self.connect() as db:
            for row in rows:
                start, end = row["s"] / 1000, row["e"] / 1000
                for role, samples in row.get("curve", {}).items():
                    entity = (entities or {}).get(role)
                    if entity and samples:
                        prior = {r["t"] for r in self._history_rows(db, vehicle, entity, samples[0][0]/1000, samples[-1][0]/1000)}
                        db.executemany("INSERT OR IGNORE INTO readings VALUES(?,?,?,?,?)",
                                       [(vehicle, entity, t/1000, str(value) if value is not None else "unavailable", "%" if role == "battery" else "A") for t, value in samples if t/1000 not in prior])
                existing = db.execute("SELECT id,data FROM sessions WHERE vehicle=? AND start<=? AND end>=? LIMIT 1", (vehicle, end, start)).fetchone()
                if existing:
                    saved = json.loads(existing["data"])
                    if row.get("curve") and not saved.get("curve") and saved.get("origin") == "recorder":
                        saved["curve"] = row["curve"]
                        db.execute("UPDATE sessions SET data=? WHERE id=?", (encode(saved), existing["id"]))
                    continue
                data = {k: row[k] for k in ("s", "e", "from", "to", "kwh", "capacity")}
                data.update(id=uuid4().hex, live=False, origin="recorder", dc=bool(row.get("dc", False)), gap=False,
                            recovered_pricing=row.get("pricing"), recovered_assignment=row.get("assignment"))
                if row.get("curve"):
                    data["curve"] = row["curve"]
                db.execute("INSERT INTO sessions(id,vehicle,start,end,active,data) VALUES(?,?,?,?,?,?)", (data["id"], vehicle, start, end, 0, encode(data)))
                count += 1
        return count

    # Charges a user removed stay in the table for UNDO_DAYS so they can be restored and so a recorder
    # import cannot bring them back; maintenance purges them afterwards.
    def _session_row(self, db, vehicle, ident):
        row = db.execute("SELECT id,data,deleted FROM sessions WHERE vehicle=? AND id=?", (vehicle, ident)).fetchone()
        if not row:
            raise ValueError("Charging session was not found")
        return row

    def delete_session(self, vehicle, ident, now=None):
        with self.connect() as db:
            row = self._session_row(db, vehicle, ident)
            if json.loads(row["data"]).get("live"):
                raise ValueError("A running charge cannot be deleted; wait until it ends")
            if row["deleted"] is None:
                db.execute("UPDATE sessions SET deleted=? WHERE vehicle=? AND id=?", (now if now is not None else time.time(), vehicle, ident))

    def restore_session(self, vehicle, ident):
        with self.connect() as db:
            self._session_row(db, vehicle, ident)
            db.execute("UPDATE sessions SET deleted=NULL WHERE vehicle=? AND id=?", (vehicle, ident))

    def deleted_sessions(self, vehicle):
        with self.connect() as db:
            rows = db.execute("SELECT data,deleted FROM sessions WHERE vehicle=? AND deleted IS NOT NULL ORDER BY deleted DESC", (vehicle,))
            result = []
            for r in rows:
                session = json.loads(r["data"])
                session.pop("curve", None)
                session["deleted"] = r["deleted"] * 1000
                result.append(session)
            return result

    def purge_deleted(self, vehicle, now=None):
        """Remove charges deleted more than UNDO_DAYS ago, with their costs index and receipts."""
        cutoff = (now if now is not None else time.time()) - UNDO_DAYS * 86400
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            rows = db.execute("SELECT id,data FROM sessions WHERE vehicle=? AND deleted IS NOT NULL AND deleted<?", (vehicle, cutoff)).fetchall()
            if not rows:
                return 0
            keys = {str(int(json.loads(r["data"])["s"] / 1000 + .5)) for r in rows}
            record = db.execute("SELECT value FROM kv WHERE vehicle=? AND key='costs'", (vehicle,)).fetchone()
            if record:
                costs = json.loads(record["value"])
                receipts = costs.get("sessions", {})
                if any(key in receipts for key in keys):
                    costs["sessions"] = {k: v for k, v in receipts.items() if k not in keys}
                    db.execute("UPDATE kv SET value=? WHERE vehicle=? AND key='costs'", (encode(costs), vehicle))
            ids = {r["id"] for r in rows}
            db.executemany("DELETE FROM session_costs WHERE vehicle=? AND session=?", [(vehicle, i) for i in ids])
            db.executemany("DELETE FROM sessions WHERE vehicle=? AND id=?", [(vehicle, i) for i in ids])
            self._store_prompt_queue(db, vehicle, [ident for ident in self._prompt_queue(db, vehicle) if ident not in ids])
            return len(rows)

    def set_session_mode(self, vehicle, ident, dc):
        """Correct a charge recorded with the wrong type (a false DC reading after an AC charge)."""
        with self.connect() as db:
            row = self._session_row(db, vehicle, ident)
            session = json.loads(row["data"])
            session["dc"] = bool(dc)
            db.execute("UPDATE sessions SET data=? WHERE vehicle=? AND id=?", (encode(session), vehicle, ident))
            session.pop("curve", None)
            return session

    def exclude_readings(self, vehicle, entities, start, end, now=None):
        """Hide current readings in a time range from every curve. Battery readings are never excluded."""
        entities = [e for e in entities if e]
        if not entities:
            raise ValueError("No charging current sensor to edit")
        with self.connect() as db:
            created = now if now is not None else time.time()
            for entity in entities:
                db.execute("INSERT INTO reading_exclusions VALUES(?,?,?,?,?)", (vehicle, entity, start, end, created))
                db.execute("DELETE FROM readings WHERE vehicle=? AND entity=? AND t>=? AND t<=?", (vehicle, entity, start, end))

    def session_curve(self, vehicle, ident, entities):
        with self.connect() as db:
            row = db.execute("SELECT data FROM sessions WHERE vehicle=? AND id=?", (vehicle, ident)).fetchone()
        if not row:
            raise ValueError("Charging session was not found")
        session = json.loads(row["data"])
        series = {}
        for role, entity in session.get("curve_entities", entities).items():
            if entity:
                series[role] = self.history(vehicle, [entity], session["s"]/1000, session["e"]/1000).get(entity, [])
        for role, readings in session.get("curve", {}).items():
            if readings:
                series[role] = [{"lu": t/1000, "s": value} for t, value in readings]
        mode = ("DC" if session["dc"] else "AC") if isinstance(session.get("dc"), bool) else None
        return {"series": series, "start": session["s"], "end": session["e"], "session_id": session["id"], "mode": mode}

    def reading_unit(self, vehicle, entity, end=None):
        with self.connect() as db:
            row = self._prior_reading(db, vehicle, entity, end if end is not None else time.time(), unit_only=True)
            return row["unit"] if row else ""

    def sessions(self, vehicle, start=None, end=None, include_curve=False):
        with self.connect() as db:
            rows = db.execute("SELECT data FROM sessions WHERE vehicle=? AND deleted IS NULL AND end>=? AND start<=? ORDER BY start",
                              (vehicle, start if start is not None else 0, end if end is not None else time.time() + 86400))
            result = [json.loads(r["data"]) for r in rows]
            if not include_curve:
                for session in result:
                    session.pop("curve", None)  # Curve data is fetched only when opened.
            return result

    def index_session_costs(self, vehicle, rows):
        with self.connect() as db:
            db.execute("DELETE FROM session_costs WHERE vehicle=?", (vehicle,))
            db.executemany("INSERT INTO session_costs VALUES(?,?,?)", [(vehicle, row["id"], row["pricing"].get("cost")) for row in rows])

    def session_page(self, vehicle, before=None, limit=5, location="", sort="newest"):
        with self.connect() as db:
            record = db.execute("SELECT value FROM kv WHERE vehicle=? AND key='costs'", (vehicle,)).fetchone()
            settings = json.loads(record["value"]) if record else {}
            locations = {p["id"]: p.get("name") or p["id"] for p in settings.get("profiles", [])}
            assigned, matching = [], []
            for key, assignment in settings.get("sessions", {}).items():
                profile = assignment.get("profile", {})
                ident = profile.get("id")
                if not key.isdigit() or not ident:
                    continue
                assigned.append(int(key))
                locations.setdefault(ident, "Manual charge" if ident == "manual" else profile.get("name") or ident)
                if ident == location:
                    matching.append(int(key))
            where, params = "s.vehicle=? AND s.deleted IS NULL", [vehicle]
            if location:
                where += " AND CAST(s.start+0.5 AS INTEGER) " + ("NOT IN" if location == "__unset__" else "IN") + " (SELECT value FROM json_each(?))"
                params.append(encode(assigned if location == "__unset__" else matching))
            total = db.execute("SELECT COUNT(*) FROM sessions s WHERE " + where, params).fetchone()[0]
            cursor, cursor_params, join, extra = "", [], "", "NULL sort_cost"
            if sort in {"highest", "lowest"}:
                join = " LEFT JOIN session_costs c ON c.vehicle=s.vehicle AND c.session=s.id"
                extra = "c.cost sort_cost"
                order = "c.cost IS NULL,c.cost " + ("DESC" if sort == "highest" else "ASC") + ",s.start DESC"
                if before is not None:
                    if before["cost"] is None:
                        cursor, cursor_params = " AND c.cost IS NULL AND s.start<?", [before["start"] / 1000]
                    else:
                        op = "<" if sort == "highest" else ">"
                        cursor = " AND (c.cost IS NULL OR c.cost" + op + "? OR (c.cost=? AND s.start<?))"
                        cursor_params = [before["cost"], before["cost"], before["start"] / 1000]
            else:
                order = "s.start " + ("ASC" if sort == "oldest" else "DESC")
                if before is not None:
                    cursor = " AND s.start" + (">" if sort == "oldest" else "<") + "?"
                    cursor_params = [before / 1000]
            records = list(db.execute("SELECT s.data," + extra + " FROM sessions s" + join + " WHERE " + where + cursor + " ORDER BY " + order + " LIMIT ?", (*params, *cursor_params, limit+1)))
        rows = [json.loads(record["data"]) for record in records[:limit]]
        for session in rows:
            session.pop("curve", None)
        next_before = None
        if rows and len(records) > limit:
            next_before = {"start": rows[-1]["s"], "cost": records[limit-1]["sort_cost"]} if sort in {"highest","lowest"} else rows[-1]["s"]
        return {"rows": rows, "total": total, "has_more": len(records) > limit,
                "locations": [{"id": ident, "name": name} for ident, name in sorted(locations.items(), key=lambda item: item[1].casefold())],
                "next_before": next_before}

    def summary(self, vehicle):
        records = self.sessions(vehicle)
        completed = [s for s in records if not s["live"]]
        return {"sessions": len(completed), "active": next((s for s in records if s["live"]), None),
                "battery_kwh": round(sum(s.get("kwh") or 0 for s in completed), 4)}

    @staticmethod
    def _dismissed_prompts(db, vehicle, user):
        saved = db.execute("SELECT value FROM kv WHERE vehicle=? AND key=?", (vehicle, "charge_prompt_dismissed:" + user)).fetchone()
        value = json.loads(saved["value"]) if saved else []
        return list(value) if isinstance(value, list) else [value]  # older versions stored one id

    @staticmethod
    def _charge_prompt(db, vehicle, user):
        """The oldest recent charge that still needs a profile; the rest follow once it is answered."""
        car = db.execute("SELECT config FROM vehicles WHERE id=?", (vehicle,)).fetchone()
        settings = json.loads(car["config"]) if car else {}
        def setting(key, default):
            value = settings.get(key)
            low, high = RANGES[key]
            return value if not isinstance(value, bool) and isinstance(value, (int, float)) and low <= value <= high else default
        minimum = setting("charge_prompt_min_gain", DEFAULT_PROMPT_MIN_GAIN)
        recent = int(setting("charge_prompt_recent", DEFAULT_PROMPT_RECENT))
        queue = Database._prompt_queue(db, vehicle)
        rows = [db.execute("SELECT data FROM sessions WHERE vehicle=? AND id=? AND deleted IS NULL", (vehicle, ident)).fetchone() for ident in queue]
        rows = [row for row in rows if row]
        if not rows:
            return None
        dismissed = set(Database._dismissed_prompts(db, vehicle, user))
        costs = db.execute("SELECT value FROM kv WHERE vehicle=? AND key='costs'", (vehicle,)).fetchone()
        value = json.loads(costs["value"]) if costs else {}
        pending = []
        for row in rows:  # oldest first, as queued
            session = json.loads(row["data"])
            before, after = session.get("from"), session.get("to")
            if (session.get("gap") or session.get("live") or not isinstance(before, (int, float)) or not isinstance(after, (int, float))
                    or not 0 <= before < after <= 100 or after - before < minimum):
                continue
            if session["id"] in dismissed:
                continue
            assignment = value.get("sessions", {}).get(str(int(session["s"] / 1000 + .5)), {})
            if assignment.get("profile", {}).get("id"):
                continue
            pending.append(session)
        pending = pending[:recent]  # the setting limits how many wait in line; the rest stay queued
        if not pending:
            return None
        session = pending[0]
        return {**{key: session.get(key) for key in ("id", "s", "e", "from", "to", "kwh", "live")},
                "gain": session["to"] - session["from"], "more": len(pending) - 1,
                "profiles": [{key: profile.get(key) for key in ("id", "name", "free", "price")}
                             for profile in value.get("profiles", [])]}

    def schema_version(self):
        with self.connect() as db:
            return db.execute("PRAGMA user_version").fetchone()[0]

    def charge_prompt(self, vehicle, user):
        with self.connect() as db:
            return self._charge_prompt(db, vehicle, user)

    def dismiss_charge_prompt(self, vehicle, user, session):
        with self.connect() as db:
            prompt = self._charge_prompt(db, vehicle, user)
            if not prompt or prompt["id"] != session:
                return
            # Keep a dismissal for as long as its charge is still queued, so it can never reappear.
            queued = set(self._prompt_queue(db, vehicle))
            dismissed = list(dict.fromkeys(s for s in [*self._dismissed_prompts(db, vehicle, user), session] if s in queued))
            db.execute("INSERT INTO kv VALUES(?,?,?) ON CONFLICT(vehicle,key) DO UPDATE SET value=excluded.value",
                       (vehicle, "charge_prompt_dismissed:" + user, encode(dismissed)))

    def assign_charge_profile(self, vehicle, session, profile):
        """Snapshot one profile atomically without replacing other assignments."""
        with self.connect() as db:
            row = db.execute("SELECT data FROM sessions WHERE vehicle=? AND id=?", (vehicle, session)).fetchone()
            costs = db.execute("SELECT value FROM kv WHERE vehicle=? AND key='costs'", (vehicle,)).fetchone()
            value = json.loads(costs["value"]) if costs else {}
            selected = next((p for p in value.get("profiles", []) if p.get("id") == profile), None)
            if not row or selected is None:
                raise ValueError("Charging session or profile was not found")
            charge = json.loads(row["data"])
            key = str(int(charge["s"] / 1000 + .5))
            if value.get("sessions", {}).get(key, {}).get("profile", {}).get("id"):
                raise ValueError("This charging session already has a profile. Refresh to see its saved cost.")
            value.setdefault("sessions", {})[key] = {"start": charge["s"], "capacity": charge.get("capacity"),
                                                    "profile": deepcopy(selected), "energy": None, "total": None}
            db.execute("INSERT INTO kv VALUES(?,?,?) ON CONFLICT(vehicle,key) DO UPDATE SET value=excluded.value",
                       (vehicle, "costs", encode(value)))
            self._store_prompt_queue(db, vehicle, [i for i in self._prompt_queue(db, vehicle) if i != session])

    def export(self, vehicle):
        cars = [v for v in self.list_vehicles() if v["id"] == vehicle]
        if not cars:
            raise ValueError("Unknown vehicle")
        with self.connect() as db:
            views = [{"id": r["id"], "name": r["name"], "config": json.loads(r["config"])}
                     for r in db.execute("SELECT * FROM views WHERE vehicle=?", (vehicle,))]
        sessions = self.sessions(vehicle, include_curve=True)
        for session in sessions:
            if session.get("curve_entities"):
                saved = self.session_curve(vehicle, session["id"], {})
                session["curve"] = {role: [[point["lu"]*1000, point["s"]] for point in series]
                                    for role, series in saved["series"].items()}
        return {"format": "deepal_companion", "version": 1, "exported": time.time(),
                "vehicle": cars[0], "views": views, "costs": self.get(vehicle, "costs", {}),
                "sessions": sessions,
                "notifications": self.get(vehicle, "local_notifications", {"enabled": False, "rules": []}),
                "notification_history": self.get(vehicle, "local_notification_history", [])}

    def backup(self, target):
        """SQLite backup includes committed WAL data and produces a consistent snapshot."""
        with self.connect() as db:
            with closing(sqlite3.connect(target)) as destination:
                db.backup(destination)
