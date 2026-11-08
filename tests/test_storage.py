"""Lossless cold history, atomic maintenance, migrations and archive longevity."""
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from test_archive import Database, calculate


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.tmp.name) / 'archive.sqlite')
        self.db = Database(self.path)
        self.db.initialize()
        self.db.ensure_vehicle('car', 'Car', {'prefix': 's05', 'battery_entity': 'sensor.battery'})
        self.start = 1700000000 // 3600 * 3600
        self.now = self.start + 40 * 86400

    def tearDown(self):
        self.tmp.cleanup()

    def test_setup_vehicle_type_seeds_once_and_never_overwrites(self):
        self.db.ensure_vehicle('typed', 'Typed', {'prefix': 's05', 'battery_entity': 'sensor.b', 'powertrain': 'phev'})
        self.assertEqual(self.db.config('typed')['config']['powertrain'], 'phev')
        self.db.patch_config('typed', self.db.config('typed')['view_id'], {'powertrain': 'auto'})
        self.db.ensure_vehicle('typed', 'Typed', {'prefix': 's05', 'battery_entity': 'sensor.b', 'powertrain': 'phev'})
        self.assertEqual(self.db.config('typed')['config']['powertrain'], 'auto', 'Explicit Automatic survives restarts')

    def test_existing_vehicle_without_type_takes_the_setup_choice(self):
        self.db.ensure_vehicle('car', 'Car', {'prefix': 's05', 'battery_entity': 'sensor.battery', 'powertrain': 'ev'})
        self.assertEqual(self.db.config('car')['config']['powertrain'], 'ev')

    def seed(self, entity='sensor.current', hours=2, vehicle='car'):
        with self.db.connect() as db:
            db.executemany('INSERT INTO readings VALUES(?,?,?,?,?)',
                           [(vehicle, entity, self.start + i*300, str(8 + i % 5), 'A') for i in range(hours*12)])

    def test_exact_history_and_units_survive_compaction_and_restart(self):
        self.seed()
        ranges = [(self.start-1, self.start+7200), (self.start+100, self.start+3100),
                  (self.start+3600, self.start+3600), (self.start+8000, self.start+9000)]
        before = [self.db.history('car', ['sensor.current'], a, b) for a, b in ranges]
        result = self.db.maintain_storage('car', now=self.now)
        self.assertEqual(result, {'blocks': 2, 'readings': 24, 'more': False})
        reopened = Database(self.path)
        for (a, b), expected in zip(ranges, before):
            self.assertEqual(reopened.history('car', ['sensor.current'], a, b), expected)
        self.assertEqual(reopened.reading_unit('car', 'sensor.current'), 'A')
        self.assertEqual(reopened.reading_unit('car', 'sensor.current', self.start-1), '')
        self.assertEqual(reopened.maintain_storage('car', now=self.now)['blocks'], 0)

    def test_recent_and_sparse_readings_are_kept(self):
        self.seed()
        self.db.sample('car', 'sensor.sparse', self.start, '42', '%')
        self.db.sample('car', 'sensor.current', self.now-100, '16', 'A')
        self.db.maintain_storage('car', now=self.now)
        stats = self.db.storage_stats()
        self.assertEqual(stats['hot_readings'], 2)
        self.assertEqual(stats['compressed_readings'], 24)

    def test_corrections_override_cold_points_and_recompact_without_duplicates(self):
        self.seed()
        self.db.maintain_storage('car', now=self.now)
        self.db.sample('car', 'sensor.current', self.start+300, '99', 'mA')
        point = self.db.history('car', ['sensor.current'], self.start, self.start+300)['sensor.current'][-1]
        self.assertEqual(point['s'], '99')
        self.assertEqual(self.db.reading_unit('car', 'sensor.current', self.start+300), 'mA')
        for i in range(8):
            self.db.sample('car', 'sensor.current', self.start+i*300, str(20+i), 'A')
        self.db.maintain_storage('car', now=self.now)
        self.assertEqual(self.db.storage_stats()['compressed_readings'], 24)
        self.assertEqual(self.db.history('car', ['sensor.current'], self.start, self.start+300)['sensor.current'][-1]['s'], '21')

    def test_old_and_recent_meter_readings_produce_identical_costs(self):
        self.seed('sensor.meter')
        session = {'s': (self.start+100)*1000, 'e': (self.start+6500)*1000, 'kwh': 3}
        record = {'profile': {'source': 'power', 'efficiency': 90, 'price': .3}}
        def price():
            data = self.db.pricing_inputs('car', [('s', 'sensor.meter', self.start+100, self.start+6500)])['s']
            return calculate(session, record, data['readings'], 'kW')
        expected = price()
        self.db.maintain_storage('car', now=self.now)
        self.assertEqual(price(), expected)

    def test_maintenance_is_vehicle_scoped_and_bounded(self):
        self.db.ensure_vehicle('other', 'Other', {'prefix': 's05', 'battery_entity': 'sensor.battery'})
        self.seed(hours=3)
        self.seed(vehicle='other')
        result = self.db.maintain_storage('car', now=self.now, limit=1)
        self.assertEqual(result, {'blocks': 1, 'readings': 12, 'more': True})
        with self.db.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM readings WHERE vehicle='other'").fetchone()[0], 24)

    def test_compression_failure_leaves_all_source_readings(self):
        self.seed()
        module = __import__(Database.__module__.rsplit('.', 1)[0]+'.storage', fromlist=['zlib'])
        with patch.object(module.zlib, 'compress', return_value=b'broken'):
            with self.assertRaises(Exception):
                self.db.maintain_storage('car', now=self.now)
        self.assertEqual(self.db.storage_stats()['hot_readings'], 24)
        self.assertEqual(self.db.storage_stats()['compressed_readings'], 0)

    def test_version_one_upgrade_preserves_data_and_newer_schema_is_rejected(self):
        self.seed()
        with self.db.connect() as db:
            db.execute('DROP TABLE reading_blocks')
            db.execute('PRAGMA user_version=1')
        self.db.initialize()
        self.assertEqual(self.db.storage_stats()['hot_readings'], 24)
        with self.db.connect() as db:
            self.assertEqual(db.execute('PRAGMA user_version').fetchone()[0], 2)

    def test_backup_keeps_cold_readings_and_sessions(self):
        self.seed()
        session = {'id': 'session', 's': self.start*1000, 'e': (self.start+7000)*1000,
                   'from': 20, 'to': 80, 'kwh': 11.04, 'live': False, 'dc': False,
                   'curve_entities': {'ac': 'sensor.current'}}
        self.db.save_session('car', session)
        expected = self.db.session_curve('car', 'session', {})
        self.db.maintain_storage('car', now=self.now)
        target = str(Path(self.tmp.name) / 'backup.sqlite')
        self.db.backup(target)
        self.assertEqual(Database(target).session_curve('car', 'session', {}), expected)
        self.assertEqual(self.db.sessions('car')[0]['kwh'], 11.04)
        exported = self.db.export('car')['sessions'][0]
        self.assertEqual(exported['curve']['ac'], [[r['lu']*1000, r['s']] for r in expected['series']['ac']])

    def test_recorder_import_does_not_overwrite_compressed_source_points(self):
        self.seed()
        self.db.maintain_storage('car', now=self.now)
        row = {'s': self.start*1000, 'e': (self.start+3600)*1000, 'from': 20, 'to': 80, 'kwh': 11.04,
               'capacity': 18.4, 'curve': {'ac': [[self.start*1000, 400]]}}
        self.db.import_sessions('car', [row], {'ac': 'sensor.current'})
        self.assertEqual(self.db.history('car', ['sensor.current'], self.start, self.start)['sensor.current'][0]['s'], '8')

    def test_unknown_states_and_unicode_roundtrip_without_loss(self):
        for i, value in enumerate(['unknown', 'unavailable', '', '0', '12.000', 'Στάση', 'é', '😀']):
            self.db.sample('car', 'sensor.current', self.start+i, value, '°C')
        expected = self.db.history('car', ['sensor.current'], self.start-1, self.start+10)
        self.db.maintain_storage('car', now=self.now)
        self.assertEqual(self.db.history('car', ['sensor.current'], self.start-1, self.start+10), expected)
