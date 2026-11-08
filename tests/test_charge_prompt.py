"""Only archived, sufficiently large charges can request a cost assignment."""
import copy
import tempfile
from pathlib import Path
import unittest

from test_archive import Database


class ChargePromptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(str(Path(self.tmp.name) / 'prompt.sqlite'))
        self.db.initialize()
        self.db.ensure_vehicle('car', 'Car', {'prefix': 's05', 'battery_entity': 'sensor.battery', 'entities': {}})
        self.charge = {'id': 'first', 's': 1700000000000, 'e': 1700003600000, 'from': 30, 'to': 40,
                       'kwh': 1.84, 'capacity': 18.4, 'live': False, 'gap': False, 'dc': False}

    def tearDown(self):
        self.tmp.cleanup()

    def test_empty_archive_and_small_gains_do_not_prompt(self):
        self.assertIsNone(self.db.charge_prompt('car', 'user'))
        self.db.save_session('car', {**self.charge, 'to': 32})
        self.assertIsNone(self.db.charge_prompt('car', 'user'))
        self.db.save_session('car', self.charge)
        self.assertEqual(self.db.charge_prompt('car', 'user')['gain'], 10)

    def test_a_charge_still_in_progress_does_not_prompt(self):
        self.db.save_session('car', {**self.charge, 'live': True})
        self.assertIsNone(self.db.charge_prompt('car', 'user'))
        self.db.save_session('car', {**self.charge, 'live': False})
        self.assertIsNotNone(self.db.charge_prompt('car', 'user'))

    def test_default_minimum_lets_a_seven_point_charge_ask_for_a_profile(self):
        self.db.save_session('car', {**self.charge, 'from': 65, 'to': 72})
        self.assertEqual(self.db.charge_prompt('car', 'user')['gain'], 7)

    def test_minimum_gain_is_a_setting(self):
        view = self.db.list_vehicles()[0]['views'][0]['id']
        self.db.save_session('car', {**self.charge, 'from': 65, 'to': 72})
        self.db.patch_config('car', view, {'charge_prompt_min_gain': 8})
        self.assertIsNone(self.db.charge_prompt('car', 'user'))
        self.db.patch_config('car', view, {'charge_prompt_min_gain': 1})
        self.assertEqual(self.db.charge_prompt('car', 'user')['gain'], 7)
        self.db.patch_config('car', view, {'charge_prompt_min_gain': 'bad'})  # unusable value: back to the default
        self.assertEqual(self.db.charge_prompt('car', 'user')['gain'], 7)

    def test_number_of_recent_charges_checked_is_a_setting(self):
        view = self.db.list_vehicles()[0]['views'][0]['id']
        day = 86400000
        for index, ident in enumerate(('first', 'second', 'third')):
            self.db.save_session('car', {**self.charge, 'id': ident, 's': self.charge['s'] + index * day, 'e': self.charge['e'] + index * day})
        self.db.patch_config('car', view, {'charge_prompt_recent': 2})
        prompt = self.db.charge_prompt('car', 'user')
        self.assertEqual((prompt['id'], prompt['more']), ('first', 1))  # only two wait in line; the third stays queued
        self.db.dismiss_charge_prompt('car', 'user', 'first')
        self.assertEqual(self.db.charge_prompt('car', 'user')['id'], 'second')
        self.db.dismiss_charge_prompt('car', 'user', 'second')
        self.assertEqual(self.db.charge_prompt('car', 'user')['id'], 'third')  # nothing is lost
        self.db.patch_config('car', view, {'charge_prompt_recent': 99})  # out of range: the default of 10 applies

    def test_unanswered_charges_are_offered_oldest_first(self):
        day = 86400000
        for index, ident in enumerate(('first', 'second', 'third')):
            self.db.save_session('car', {**self.charge, 'id': ident, 's': self.charge['s'] + index * day, 'e': self.charge['e'] + index * day})
        prompt = self.db.charge_prompt('car', 'user')
        self.assertEqual((prompt['id'], prompt['more']), ('first', 2))
        self.db.dismiss_charge_prompt('car', 'user', 'first')
        self.assertEqual(self.db.charge_prompt('car', 'user')['id'], 'second')
        self.assertEqual(self.db.charge_prompt('car', 'other')['id'], 'first')  # dismissal is per user
        costs = self.db.get('car', 'costs')
        costs['sessions'][str(int((self.charge['s'] + day) / 1000))] = {'profile': costs['profiles'][0]}
        self.db.put('car', 'costs', costs)
        prompt = self.db.charge_prompt('car', 'user')
        self.assertEqual((prompt['id'], prompt['more']), ('third', 0))
        self.db.dismiss_charge_prompt('car', 'user', 'third')
        self.assertIsNone(self.db.charge_prompt('car', 'user'))

    def test_dismissal_saved_by_an_older_version_still_applies(self):
        self.db.save_session('car', self.charge)
        self.db.put('car', 'charge_prompt_dismissed:user', 'first')
        self.assertIsNone(self.db.charge_prompt('car', 'user'))

    def test_uncertain_or_invalid_levels_do_not_prompt(self):
        for patch in ({'gap': True}, {'from': None}, {'to': 101}, {'from': 50, 'to': 40}):
            self.db.save_session('car', {**self.charge, **patch})
            self.assertIsNone(self.db.charge_prompt('car', 'user'))

    def test_dismissal_is_per_user_persistent_and_only_for_one_charge(self):
        self.db.save_session('car', self.charge)
        self.db.dismiss_charge_prompt('car', 'one', 'first')
        reopened = Database(self.db.path)
        self.assertIsNone(reopened.charge_prompt('car', 'one'))
        self.assertEqual(reopened.charge_prompt('car', 'two')['id'], 'first')
        self.db.save_session('car', {**self.charge, 'id': 'second', 's': self.charge['s'] + 86400000,
                                     'e': self.charge['e'] + 86400000})
        self.assertEqual(self.db.charge_prompt('car', 'one')['id'], 'second')

    def test_more_than_a_hundred_unanswered_charges_are_all_kept_and_dismissed_once(self):
        day = 86400000
        for i in range(105):
            self.db.save_session('car', {**self.charge, 'id': 'c%d' % i, 's': self.charge['s'] + i * day,
                                         'e': self.charge['e'] + i * day})
        with self.db.connect() as db:
            self.assertEqual(len(Database._prompt_queue(db, 'car')), 105)
        for _ in range(105):
            prompt = self.db.charge_prompt('car', 'one')
            self.assertIsNotNone(prompt)
            self.db.dismiss_charge_prompt('car', 'one', prompt['id'])
        self.assertIsNone(self.db.charge_prompt('car', 'one'))
        with self.db.connect() as db:
            self.assertEqual(len(Database._dismissed_prompts(db, 'car', 'one')), 105)

    def test_stale_dismissal_does_not_hide_new_charge(self):
        self.db.save_session('car', self.charge)
        self.db.dismiss_charge_prompt('car', 'user', 'wrong')
        self.assertIsNotNone(self.db.charge_prompt('car', 'user'))

    def test_assignment_from_another_page_clears_prompt_for_every_user(self):
        self.db.save_session('car', self.charge)
        costs = self.db.get('car', 'costs')
        costs['sessions'][str(int(self.charge['s'] / 1000))] = {'profile': costs['profiles'][0]}
        self.db.put('car', 'costs', costs)
        self.assertIsNone(self.db.charge_prompt('car', 'one'))
        self.assertIsNone(self.db.charge_prompt('car', 'two'))

    def test_atomic_profile_assignment_preserves_other_sessions_and_snapshots_tariff(self):
        self.db.save_session('car', self.charge)
        costs = self.db.get('car', 'costs')
        costs['sessions']['older'] = {'total': 4.5}
        costs['profiles'][0]['price'] = .25
        self.db.put('car', 'costs', costs)
        profile = costs['profiles'][0]
        self.db.assign_charge_profile('car', 'first', profile['id'])
        saved = self.db.get('car', 'costs')
        record = saved['sessions'][str(int(self.charge['s'] / 1000))]
        self.assertEqual(record['profile']['price'], .25)
        self.assertEqual(record['capacity'], 18.4)
        self.assertEqual(saved['sessions']['older'], {'total': 4.5})
        saved['profiles'][0]['price'] = .99
        self.db.put('car', 'costs', saved)
        self.assertEqual(self.db.get('car', 'costs')['sessions'][str(int(self.charge['s'] / 1000))]['profile']['price'], .25)
        self.assertIsNone(self.db.charge_prompt('car', 'user'))

    def test_missing_profile_or_cross_vehicle_session_does_not_write(self):
        self.db.save_session('car', self.charge)
        original = copy.deepcopy(self.db.get('car', 'costs'))
        for session, profile in [('missing', 'home'), ('first', 'missing')]:
            with self.assertRaises(ValueError):
                self.db.assign_charge_profile('car', session, profile)
        self.assertEqual(original, self.db.get('car', 'costs'))

    def test_stale_prompt_cannot_overwrite_a_receipt_assigned_elsewhere(self):
        self.db.save_session('car', self.charge)
        costs = self.db.get('car', 'costs')
        key = str(int(self.charge['s'] / 1000))
        costs['sessions'][key] = {'profile': {'id': 'manual'}, 'total': 12.5}
        self.db.put('car', 'costs', costs)
        with self.assertRaises(ValueError):
            self.db.assign_charge_profile('car', 'first', costs['profiles'][0]['id'])
        self.assertEqual(self.db.get('car', 'costs')['sessions'][key]['total'], 12.5)
