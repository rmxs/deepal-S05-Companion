"""Evaluate the actual frontend-generated alert conditions in Jinja."""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import types
import unittest

from jinja2 import Environment

ROOT = Path(__file__).resolve().parents[1]


class RuleTemplates(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        script = r"""
const fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(process.argv[1],'utf8').replace('export function','function');
const factory=vm.runInNewContext(source+';createNotificationRules');
const rules=factory({T:s=>s,resolveId:(_,__,key)=>key.replace('.', '.s05_'),DIAG:[],OPEN_ITEMS:[],TIRES:[]});
const current=['sensor.s05_ac_charge_current','sensor.s05_dc_charge_current'];
const all={};
for(const id of ['charge_done','plugged_idle','charge_interrupted','charge_target'])all[id]=[true,false].map(withCurrent=>{const states=Object.fromEntries(['sensor.s05_battery_level','binary_sensor.s05_charger_plugged','binary_sensor.s05_charging','sensor.s05_charge_status',...(withCurrent?current:[])].map(key=>[key,{state:'unknown'}]));return rules.localRules({states},{prefix:'s05',notify:{local:true}}).find(rule=>rule.id===id).condition;});
process.stdout.write(JSON.stringify(all));
"""
        cls.all = json.loads(subprocess.check_output(
            ['node', '-e', script, str(ROOT/'custom_components/deepal_companion/frontend/notification-rules.js')], text=True))
        cls.conditions = cls.all['charge_done']

    def evaluate(self, ac='0', dc='0', battery='100', charging='off', status='unknown', plugged='on', currents=True, age=10, preset='charge_done', **extra):
        now = datetime(2026, 11, 7, tzinfo=timezone.utc)
        values = {'sensor.s05_ac_charge_current': ac, 'sensor.s05_dc_charge_current': dc,
                  'sensor.s05_battery_level': battery, 'binary_sensor.s05_charging': charging,
                  'sensor.s05_charge_status': status, 'binary_sensor.s05_charger_plugged': plugged}
        class States:
            def __call__(self, entity):
                return values.get(entity, 'unknown')
            def __getattr__(self, domain):
                return types.SimpleNamespace(**{key.split('.', 1)[1]: types.SimpleNamespace(last_changed=now-timedelta(seconds=age))
                                                for key in values if key.startswith(domain+'.')})
        env = Environment()
        result = env.from_string(self.all[preset][0 if currents else 1]).render(
            states=States(), is_state=lambda key, state: values.get(key)==state, now=lambda: now, **extra)
        return result.strip().lower() == 'true'

    def test_stale_complete_status_cannot_override_positive_current(self):
        self.assertFalse(self.evaluate(ac='8', battery='90', status='complete'))
        self.assertFalse(self.evaluate(dc='50', battery='100', status='charge_complete'))

    def test_stopped_currents_and_completion_level_trigger_alert(self):
        self.assertTrue(self.evaluate(battery='90'))
        self.assertTrue(self.evaluate(battery='100', status='unavailable'))
        self.assertFalse(self.evaluate(battery='70'))

    def test_unavailable_evidence_and_old_stop_do_not_count_as_completion(self):
        self.assertFalse(self.evaluate(ac='unknown', status='complete'))
        self.assertFalse(self.evaluate(currents=False, charging='unknown', status='complete'))
        self.assertFalse(self.evaluate(age=3000))
        self.assertTrue(self.evaluate(currents=False, charging='off'))

    def test_the_three_alerts_do_not_fire_while_the_charger_limit_holds_the_charger(self):
        cases = {'charge_done': dict(battery='90'), 'plugged_idle': dict(battery='50'), 'charge_interrupted': dict(battery='50')}
        for preset, values in cases.items():
            self.assertTrue(self.evaluate(preset=preset, **values), preset)
            self.assertTrue(self.evaluate(preset=preset, limit_stopped=False, **values), preset)
            self.assertFalse(self.evaluate(preset=preset, limit_stopped=True, **values), preset)

    def test_reached_target_follows_the_charging_target(self):
        def reached(battery, target, **extra):
            return self.evaluate(preset='charge_target', charging='on', battery=battery, charge_target_pct=target, **extra)
        self.assertTrue(reached('70', 65))
        self.assertFalse(reached('70', 75))
        self.assertTrue(reached('75', 75), 'it follows the target as it changes, without a new save')
        self.assertTrue(reached('40', 30), 'a target below 50 follows too')
        self.assertFalse(reached('40', 45))

    def test_reached_target_uses_its_own_number_without_a_usable_target(self):
        for target in (0, 100, 150):
            self.assertFalse(self.evaluate(preset='charge_target', charging='on', battery='79', charge_target_pct=target), target)
            self.assertTrue(self.evaluate(preset='charge_target', charging='on', battery='80', charge_target_pct=target), target)
        self.assertTrue(self.evaluate(preset='charge_target', charging='on', battery='85'), 'no value supplied at all')
        self.assertFalse(self.evaluate(preset='charge_target', charging='off', battery='85', charge_target_pct=70), 'only while charging')

    def test_reached_target_gives_way_to_the_limit_message(self):
        self.assertTrue(self.evaluate(preset='charge_target', charging='on', battery='85', charge_target_pct=80, limit_stopping=False))
        self.assertFalse(self.evaluate(preset='charge_target', charging='on', battery='85', charge_target_pct=80, limit_stopping=True))
