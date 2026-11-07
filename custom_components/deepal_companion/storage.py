"""Lossless cold-history storage; no saved readings are expired or downsampled."""
from __future__ import annotations

import json
import time
import zlib

HOUR = 3600
HOT_DAYS = 30


class HistoryStorage:
    @staticmethod
    def _unpack(blob):
        return [{"t": t, "state": state, "unit": unit}
                for t, state, unit in json.loads(zlib.decompress(blob))]

    def _prior_reading(self, db, vehicle, entity, end, unit_only=False):
        extra = " AND unit<>''" if unit_only else ""
        row = db.execute("SELECT t,state,unit FROM readings WHERE vehicle=? AND entity=? AND t<=?" +
                         extra + " ORDER BY t DESC LIMIT 1", (vehicle, entity, end)).fetchone()
        best = dict(row) if row else None
        for packed in db.execute("SELECT bucket,data FROM reading_blocks WHERE vehicle=? AND entity=? "
                                 "AND bucket<=? ORDER BY bucket DESC", (vehicle, entity, end)):
            if best and packed["bucket"] + HOUR <= best["t"]:
                break
            candidate = next((r for r in reversed(self._unpack(packed["data"]))
                              if r["t"] <= end and (not unit_only or r["unit"])), None)
            if candidate:
                if best is None or candidate["t"] > best["t"]:
                    best = candidate
                break
        return best

    def _history_rows(self, db, vehicle, entity, start, end):
        rows = {}
        for packed in db.execute("SELECT data FROM reading_blocks WHERE vehicle=? AND entity=? "
                                 "AND bucket>=? AND bucket<=? ORDER BY bucket",
                                 (vehicle, entity, start // HOUR * HOUR, end)):
            for row in self._unpack(packed["data"]):
                if start < row["t"] <= end:
                    rows[row["t"]] = row
        # A later correction at the same timestamp takes precedence over its cold copy.
        for row in db.execute("SELECT t,state,unit FROM readings WHERE vehicle=? AND entity=? "
                              "AND t>? AND t<=? ORDER BY t", (vehicle, entity, start, end)):
            rows[row["t"]] = dict(row)
        before = self._prior_reading(db, vehicle, entity, start)
        if before:
            rows[before["t"]] = before
        return [rows[t] for t in sorted(rows)]

    def maintain_storage(self, vehicle, now=None, limit=64):
        """Compress a bounded batch of dense hours older than 30 days, atomically."""
        now = time.time() if now is None else now
        if type(limit) is not int or not 1 <= limit <= 256:
            raise ValueError("Invalid maintenance batch size")
        cutoff = (now - HOT_DAYS * 86400) // HOUR * HOUR
        processed = readings = 0
        with self.connect() as db:
            # The time index avoids grouping the recent, high-volume history.
            groups = list(db.execute(
                "SELECT entity,CAST(t / ? AS INTEGER)*? AS bucket,COUNT(*) AS n "
                "FROM readings WHERE vehicle=? AND t<? GROUP BY entity,bucket "
                "HAVING COUNT(*)>=8 ORDER BY bucket,entity LIMIT ?",
                (HOUR, HOUR, vehicle, cutoff, limit + 1)))
            for group in groups[:limit]:
                entity, bucket = group["entity"], group["bucket"]
                existing = db.execute("SELECT data FROM reading_blocks WHERE vehicle=? AND entity=? AND bucket=?",
                                      (vehicle, entity, bucket)).fetchone()
                values = {r["t"]: r for r in self._unpack(existing["data"])} if existing else {}
                hot = list(db.execute("SELECT t,state,unit FROM readings WHERE vehicle=? AND entity=? AND t>=? AND t<? ORDER BY t",
                                      (vehicle, entity, bucket, bucket + HOUR)))
                values.update({r["t"]: dict(r) for r in hot})
                payload = json.dumps([[t, values[t]["state"], values[t]["unit"]] for t in sorted(values)],
                                     ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
                packed = zlib.compress(payload, level=6)
                # Verify the encoded payload before deleting its row representation.
                if zlib.decompress(packed) != payload:
                    raise RuntimeError("History compression verification failed")
                db.execute("INSERT INTO reading_blocks VALUES(?,?,?,?,?) ON CONFLICT(vehicle,entity,bucket) "
                           "DO UPDATE SET count=excluded.count,data=excluded.data",
                           (vehicle, entity, bucket, len(values), packed))
                db.execute("DELETE FROM readings WHERE vehicle=? AND entity=? AND t>=? AND t<?",
                           (vehicle, entity, bucket, bucket + HOUR))
                readings += len(hot)
                processed += 1
        # New archives reclaim pages incrementally; existing archives reuse freed pages.
        # These operations run after the data transaction has committed.
        if processed:
            with self.connect() as db:
                db.execute("PRAGMA incremental_vacuum(256)").fetchall()
                db.execute("PRAGMA optimize")
                db.execute("PRAGMA wal_checkpoint(PASSIVE)").fetchall()
        return {"blocks": processed, "readings": readings, "more": len(groups) > limit}

    def storage_stats(self):
        from pathlib import Path
        with self.connect() as db:
            hot = db.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
            cold = db.execute("SELECT COALESCE(SUM(count),0),COUNT(*),COALESCE(SUM(LENGTH(data)),0) FROM reading_blocks").fetchone()
            return {"database_bytes": Path(self.path).stat().st_size,
                    "wal_bytes": Path(self.path + "-wal").stat().st_size if Path(self.path + "-wal").exists() else 0,
                    "hot_readings": hot, "compressed_readings": cold[0], "compressed_blocks": cold[1],
                    "compressed_bytes": cold[2], "hot_days": HOT_DAYS,
                    "reusable_bytes": db.execute("PRAGMA freelist_count").fetchone()[0] * db.execute("PRAGMA page_size").fetchone()[0]}
