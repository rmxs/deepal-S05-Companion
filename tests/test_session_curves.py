"""Curves persist independently of Recorder and receipt edits."""
import json
from pathlib import Path
import tempfile
import unittest
from test_archive import Database


class SessionCurves(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.path=str(Path(self.tmp.name)/'archive.sqlite')
        self.db=Database(self.path);self.db.initialize()
        self.db.ensure_vehicle('car','Car',{'prefix':'s05','battery_entity':'sensor.battery','entities':{}})
        self.row={'s':1700000000000,'e':1700003600000,'from':20,'to':80,'kwh':11.04,'capacity':18.4,
                  'pricing':{'energy':12.2,'cost':4.3},'curve':{'ac':[[1700000000000,8],[1700001800000,16]],'dc':[],'battery':[[1700000000000,20],[1700003600000,80]]}}
    def tearDown(self):
        self.tmp.cleanup()
    def test_imported_curve_survives_reopening_without_recorder(self):
        self.db.import_sessions('car',[self.row])
        ident=self.db.sessions('car')[0]['id']
        reopened=Database(self.path)
        curve=reopened.session_curve('car',ident,{})
        self.assertEqual([point['s'] for point in curve['series']['ac']],[8,16])
        self.assertNotIn('curve',reopened.sessions('car')[0])
        self.assertNotIn('curve',reopened.session_page('car')['rows'][0])
    def test_enrichment_preserves_existing_session_identity_and_price(self):
        row={**self.row};row.pop('curve')
        self.db.import_sessions('car',[row]);before=self.db.sessions('car')[0]
        self.assertEqual(self.db.import_sessions('car',[self.row]),0)
        after=self.db.sessions('car')[0]
        self.assertEqual(after,before)
        self.assertEqual(self.db.session_curve('car',before['id'],{})['series']['ac'][1]['s'],16)
    def test_native_curve_keeps_original_sensor_mapping(self):
        row={**self.row,'id':'native','live':False,'curve_entities':{'ac':'sensor.original_ac'}};row.pop('curve')
        self.db.save_session('car',row)
        self.db.sample('car','sensor.original_ac',row['s']/1000,8,'A')
        self.db.sample('car','sensor.original_ac',row['s']/1000+600,16,'A')
        curve=self.db.session_curve('car','native',{'ac':'sensor.renamed_ac'})
        self.assertEqual(len(curve['series']['ac']),2)
        with self.assertRaises(ValueError):self.db.session_curve('another-car','native',{})

    def test_curve_reports_saved_charging_mode_without_removing_raw_samples(self):
        row={**self.row,'dc':False,'curve':{**self.row['curve'],'dc':[[1700001800000,400]]}}
        self.db.import_sessions('car',[row])
        ident=self.db.sessions('car')[0]['id']
        curve=self.db.session_curve('car',ident,{})
        self.assertEqual(curve['mode'],'AC')
        self.assertEqual(curve['series']['dc'][0]['s'],400)
