"""Observable database-call and cache regressions, using explicit HA doubles."""
import asyncio
from copy import deepcopy
import importlib
import types
import unittest
from unittest.mock import patch

from test_lifecycle import integration

Runtime = importlib.import_module("companion_lifecycle.runtime").VehicleRuntime


class RuntimePerformanceTests(unittest.IsolatedAsyncioTestCase):
    async def test_snapshot_does_not_treat_restored_current_as_live_charging(self):
        runtime = self.runtime(0)
        runtime.entities = {'ac': 'sensor.ac', 'batt': 'sensor.battery'}
        restored = types.SimpleNamespace(state='16', attributes={'restored': True})
        battery = types.SimpleNamespace(state='80', attributes={})
        runtime.hass.states = types.SimpleNamespace(get=lambda key: restored if key=='sensor.ac' else battery)
        self.assertEqual(runtime.snapshot(), {'ac': None, 'batt': '80'})

    async def test_page_prices_only_the_requested_database_records(self):
        runtime = self.runtime(100)
        result = await runtime.session_page(None, 5)
        self.assertEqual(len(result["rows"]), 5)
        self.assertEqual(result["total"], 100)
        self.assertNotIn("sessions", self.calls)
        self.assertEqual(self.requests, [5])

    async def test_dashboard_returns_aggregates_and_caches_them(self):
        runtime = self.runtime(100)
        module = importlib.import_module("companion_lifecycle.runtime")
        with patch.object(module.dt_util, "as_local", lambda value: value, create=True), patch.object(module.time, "time", return_value=1700000000+100*7200):
            result = await runtime.charging_dashboard()
            before = len(self.calls)
            again = await runtime.charging_dashboard()
        self.assertEqual(result, again)
        self.assertEqual(len(self.calls), before)
        self.assertEqual(result["total"], 100)
        self.assertEqual(result["priced"], 100)
        self.assertGreater(result["cost"], 0)
        self.assertAlmostEqual(result["energy"], 100 * 9.2 / .9)
        self.assertLessEqual(len(result["chart_rows"]), 31)
        self.assertNotIn("rows", result)

    async def test_dashboard_respects_zero_entered_energy(self):
        runtime = self.runtime(0)
        async def sessions():
            return [{"s": 1700000000000, "live": False, "kwh": 9.2, "pricing": {"energy": 0, "cost": 0}}]
        runtime.priced_sessions = sessions
        module = importlib.import_module("companion_lifecycle.runtime")
        with patch.object(module.dt_util, "as_local", lambda value: value, create=True), patch.object(module.time, "time", return_value=1700000010):
            result = await runtime.charging_dashboard()
        self.assertEqual(result["chart_rows"][0]["pricing"]["energy"], 0)
        self.assertEqual(result["energy"], 0)
        self.assertEqual(result["priced"], 1)

    async def test_historical_chart_period_keeps_global_totals(self):
        runtime = self.runtime(100)
        module = importlib.import_module("companion_lifecycle.runtime")
        start = 1700000000
        with patch.object(module.dt_util, "as_local", lambda value: value, create=True), patch.object(module.time, "time", return_value=start+100*86400):
            result = await runtime.charging_dashboard(start, start+3*7200)
        self.assertEqual(result['total'],100)
        self.assertAlmostEqual(sum(day['pricing']['energy'] for day in result['chart_rows']),4*9.2/.9)

    def runtime(self, count):
        self.calls = []
        self.requests = []
        rows, assignments = [], {}
        profile = {"id": "home", "name": "Home", "source": "total", "entity": "sensor.meter", "price": .25, "free": False, "efficiency": 90}
        for i in range(count):
            start = 1700000000000 + i * 7200000
            rows.append({"id": str(i), "s": start, "e": start + 3600000, "live": False, "from": 20, "to": 70, "kwh": 9.2, "capacity": 18.4})
            assignments[str(round(start / 1000))] = {"profile": deepcopy(profile), "capacity": 18.4}
        async def db(method, *args):
            self.calls.append(method)
            await asyncio.sleep(0)
            if method == "sessions":
                return deepcopy(rows)
            if method == "session_page":
                before, limit = args[1:3]
                page = [row for row in reversed(rows) if before is None or row["s"] < before][:limit]
                return {"rows": deepcopy(page), "total": len(rows), "has_more": len(rows)>limit, "next_before": page[-1]["s"]}
            if method == "get":
                return {"profiles": [profile], "sessions": assignments}
            if method == "pricing_inputs":
                self.requests.append(len(args[1]))
                return {key: {"readings": [], "unit": "kWh"} for key, *_ in args[1]}
            raise AssertionError(method)
        hass = types.SimpleNamespace(states=types.SimpleNamespace(get=lambda entity: None))
        hub = types.SimpleNamespace(hass=hass, db=db)
        return Runtime(hub, types.SimpleNamespace(unique_id="car"))

    async def test_four_sensors_share_one_summary_query(self):
        runtime = self.runtime(100)
        results = await asyncio.gather(*(runtime.summary_values() for _ in range(4)))
        self.assertEqual(self.calls, ["sessions", "get", "pricing_inputs"])
        self.assertTrue(all(row == results[0] for row in results))
        self.assertEqual(results[0]["sessions"], 100)
        self.assertEqual(results[0]["unpriced"], 0)
        self.assertAlmostEqual(results[0]["battery_kwh"], 920)
        results[0]["sessions"] = -1
        self.assertEqual((await runtime.summary_values())["sessions"], 100)

    async def test_large_archives_keep_cache_hits_and_batch_cold_meter_reads(self):
        runtime = self.runtime(1200)
        await runtime.priced_sessions()
        self.assertEqual(len(runtime.price_cache), 1000)
        await runtime.priced_sessions()
        self.assertEqual(self.requests, [1200, 200])
        self.assertEqual(self.calls.count("pricing_inputs"), 2)
        self.assertEqual(len(runtime.price_cache), 1000)

    async def test_summary_revision_recomputes_after_cost_or_session_change(self):
        runtime = self.runtime(10)
        await runtime.summary_values()
        count = len(self.calls)
        await runtime.summary_values()
        self.assertEqual(len(self.calls), count)
        runtime._summary_revision += 1
        await runtime.summary_values()
        self.assertEqual(self.calls.count("sessions"), 2)

    async def test_concurrent_pricing_reads_do_not_repeat_cold_meter_queries(self):
        runtime = self.runtime(100)
        await asyncio.gather(runtime.priced_sessions(), runtime.priced_sessions())
        self.assertEqual(self.requests, [100])

    async def test_stopped_runtime_ignores_late_callbacks(self):
        runtime = self.runtime(0)
        runtime._stopped = True
        runtime._tick(None)
        runtime._event(types.SimpleNamespace(data={"new_state": types.SimpleNamespace(state="8", attributes={}, entity_id="sensor.ac")}))
        self.assertTrue(runtime.queue.empty())

    async def test_attribute_only_state_changes_do_not_queue_duplicate_samples(self):
        runtime = self.runtime(0)
        old = types.SimpleNamespace(state="8", attributes={"unit_of_measurement": "A"})
        new = types.SimpleNamespace(state="8", attributes={"unit_of_measurement": "A", "friendly_name": "Renamed"}, entity_id="sensor.ac")
        runtime._event(types.SimpleNamespace(data={"old_state": old, "new_state": new}))
        self.assertTrue(runtime.queue.empty())
