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
const conditions=[true,false].map(withCurrent=>{const states=Object.fromEntries(['sensor.s05_battery_level','binary_sensor.s05_charger_plugged','binary_sensor.s05_charging','sensor.s05_charge_status',...(withCurrent?current:[])].map(key=>[key,{state:'unknown'}]));return rules.localRules({states},{prefix:'s05',notify:{local:true}}).find(rule=>rule.id==='charge_done').condition;});
process.stdout.write(JSON.stringify(conditions));
"""
        cls.conditions = json.loads(subprocess.check_output(
            ['node', '-e', script, str(ROOT/'custom_components/deepal_companion/frontend/notification-rules.js')], text=True))

    def evaluate(self, ac='0', dc='0', battery='100', charging='off', status='unknown', plugged='on', currents=True, age=10):
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
        result = env.from_string(self.conditions[0 if currents else 1]).render(
            states=States(), is_state=lambda key, state: values.get(key)==state, now=lambda: now)
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
