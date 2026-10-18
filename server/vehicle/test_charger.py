import unittest
from charger import normalize

class ChargerMappingTest(unittest.TestCase):
    def test_metrics_units_and_current_limit_are_distinct(self):
        result = normalize({'dps': {'102': '{"L1":[2320,135,3132],"L2":[2310,0,0],"t":285,"p":3132,"e":8750}', '109': 'WORKING', '150': 32, '152': 32}})
        self.assertEqual(result['state'], 'charging')
        self.assertEqual(result['power'], 3.132)
        self.assertEqual(result['energy'], 8.75)
        self.assertEqual(result['temperature'], 28.5)
        self.assertEqual(result['phases'][0], {'name': 'L1', 'voltage': 232, 'current': 13.5})
        self.assertIsNone(result['phases'][2]['current'])
        self.assertEqual(result['currentLimit'], 32)
        self.assertNotIn('key', result)

    def test_unknown_values_and_zero_are_preserved(self):
        result = normalize({'dps': {'102': {'p': 0, 't': -50, 'e': True, 'L1': [float('nan'), '32']}, '109': 'NEW_STATE'}})
        self.assertEqual(result['power'], 0)
        self.assertEqual(result['temperature'], -5)
        self.assertEqual(result['state'], 'unknown')
        self.assertIsNone(result['energy'])
        self.assertIsNone(result['phases'][0]['voltage'])
        self.assertIsNone(result['phases'][0]['current'])

    def test_failed_reads_do_not_become_zero_power(self):
        for response in [{'Error': 'Offline'}, {'dps': {}}, {'dps': {'102': 'broken'}}]:
            with self.assertRaises(ValueError): normalize(response)

import asyncio
import tempfile
from pathlib import Path
from unittest.mock import patch
from charger import Charger
from charger import ChargeArchive


class ChargeArchiveTest(unittest.TestCase):
    def test_records_sessions_with_no_offline_interpolation_and_restores(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, 'history.json')
            archive = ChargeArchive(path)
            archive.observe({'state': 'idle', 'power': 0, 'readAt': 1000000})
            archive.observe({'state': 'charging', 'power': 6, 'readAt': 1015000})
            archive.observe({'state': 'charging', 'power': 6, 'readAt': 1075000})
            self.assertAlmostEqual(archive.public()['active']['energyKwh'], .1)
            archive.observe({'state': 'charging', 'power': 6, 'readAt': 1675000})
            self.assertAlmostEqual(archive.public()['active']['energyKwh'], .1)
            archive.observe({'state': 'finished', 'power': 0, 'readAt': 1690000})
            session = archive.public()['sessions'][0]
            self.assertTrue(session['partial'])
            self.assertAlmostEqual(session['energyKwh'], .1125)
            self.assertAlmostEqual(sum(s['kwh'] for s in session['segments']), session['energyKwh'])
            self.assertIsNone(archive.public()['active'])
            self.assertEqual(ChargeArchive(path).public()['sessions'], [session])
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_first_observation_mid_charge_is_partial_and_duplicate_does_not_add_energy(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = ChargeArchive(Path(directory, 'history.json'))
            archive.observe({'state': 'charging', 'power': 6, 'readAt': 1000000})
            archive.observe({'state': 'charging', 'power': 6, 'readAt': 1060000})
            archive.observe({'state': 'charging', 'power': 6, 'readAt': 1060000})
            self.assertTrue(archive.public()['active']['partial'])
            self.assertAlmostEqual(archive.public()['active']['energyKwh'], .1)

    def test_tariff_boundary_splits_energy_and_pause_is_not_a_new_session(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = ChargeArchive(Path(directory, 'history.json'))
            for state, power, stamp in [('charging', 6, 299000), ('charging', 6, 314000), ('paused', 0, 329000), ('charging', 6, 344000)]:
                archive.observe({'state': state, 'power': power, 'readAt': stamp})
            session = archive.public()['active']
            self.assertEqual([s['time'] for s in session['segments']], [0, 300000])
            self.assertEqual(session['start'], 299000)
            self.assertAlmostEqual(sum(s['kwh'] for s in session['segments']), session['energyKwh'])

class ChargerReadTest(unittest.IsolatedAsyncioTestCase):
    async def test_concurrent_reads_share_cache_and_outage_keeps_timestamp(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, 'charger.json').write_text('{}')
            charger = Charger(directory)
            snapshot = {'power': 2.5, 'readAt': 123}
            with patch.object(charger, 'read', return_value=snapshot) as read:
                first, second = await asyncio.gather(charger.status(), charger.status())
                self.assertTrue(first['online'])
                self.assertEqual(second['data'], snapshot)
                self.assertEqual(read.call_count, 1)
            charger.attempted = 0
            with patch.object(charger, 'read', side_effect=ValueError('private key must not leak')):
                offline = await charger.status()
                self.assertFalse(offline['online'])
                self.assertEqual(offline['data']['readAt'], 123)
                self.assertNotIn('private key', str(offline))

    async def test_no_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(await Charger(directory).status(), {'configured': False, 'online': False, 'data': None})
