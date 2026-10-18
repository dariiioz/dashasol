"""Read-only LAN adapter for dé / Tuya DP 102, 109, 150, 152.

Mapping: make-all/tuya-local dewall_evcharger.yaml; metrics documented in
make-all/tuya-local issue 5107. Never issue a write or refresh command.
"""
import asyncio
import ipaddress
import json
import math
import os
import time
from pathlib import Path


def number(value, low=0, high=1e9, scale=1):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    value = value / scale
    return value if low <= value <= high else None


def object_value(value):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return {}
    return value if isinstance(value, dict) else {}


def normalize(payload):
    dps = payload.get('dps') if isinstance(payload, dict) else None
    if not isinstance(dps, dict):
        raise ValueError('Missing device data')
    metrics = object_value(dps.get('102'))
    if not metrics:
        raise ValueError('Missing metrics')
    phases = []
    for name in ['L1', 'L2', 'L3']:
        phase = metrics.get(name)
        phase = phase if isinstance(phase, list) and len(phase) >= 2 else [None, None]
        phases.append({'name': name, 'voltage': number(phase[0], high=500, scale=10), 'current': number(phase[1], high=100, scale=10)})
    states = {'IDLE': 'idle', 'SLEEP': 'sleep', 'IDLEINS': 'plugged', 'WORKING': 'charging', 'WAIT': 'waiting', 'ERRORPAUSE': 'fault', 'PAUSE': 'paused', 'STOP': 'finished'}
    return {'state': states.get(dps.get('109'), 'unknown'), 'power': number(metrics.get('p'), high=50000, scale=1000), 'energy': number(metrics.get('e'), high=1000, scale=1000), 'temperature': number(metrics.get('t'), low=-40, high=150, scale=10), 'currentLimit': number(dps.get('150'), high=100), 'maximumCurrent': number(dps.get('152'), high=100), 'phases': phases, 'hasAlarm': bool(dps.get('104')), 'readAt': int(time.time() * 1000)}


class Charger:
    def __init__(self, directory):
        self.path = Path(directory) / 'charger.json'
        self.lock = asyncio.Lock()
        self.snapshot = None
        self.attempted = 0
        self.archive = ChargeArchive(Path(directory) / 'charger-history.json')

    def read(self):
        import tinytuya
        config = json.loads(self.path.read_text())
        ip = ipaddress.ip_address(config['ip'])
        if ip.version != 4 or not ip.is_private or ip.is_loopback or ip.is_multicast or ip.is_unspecified:
            raise ValueError('Invalid charger address')
        device = tinytuya.Device(config['id'], str(ip), config['key'], version=config.get('version', 3.5))
        device.set_socketTimeout(4)
        device.set_socketRetryLimit(1)
        try:
            return normalize(device.status())
        finally:
            device.close()

    async def status(self):
        if not self.path.exists():
            return {'configured': False, 'online': False, 'data': None}
        async with self.lock:
            if time.monotonic() - self.attempted >= 15:
                self.attempted = time.monotonic()
                try:
                    self.snapshot = await asyncio.to_thread(self.read)
                    self.archive.observe(self.snapshot)
                    self.error = None
                except Exception:
                    self.error = 'Borne injoignable sur le réseau local. Dernier relevé conservé.'
            return {'configured': True, 'online': not getattr(self, 'error', None), 'data': self.snapshot, 'message': getattr(self, 'error', None), 'history': self.archive.public()}

    async def collect(self):
        """Keep recording while the local service runs, even with the tablet closed."""
        while True:
            await self.status()
            await asyncio.sleep(15)


class ChargeArchive:
    """Observed sessions only. Integrate measured kW; never fabricate offline energy."""
    def __init__(self, path):
        self.path = Path(path)
        self.previous = None
        self.last_save = 0
        self.value = {'startedAt': int(time.time() * 1000), 'sessions': [], 'active': None}
        try:
            saved = json.loads(self.path.read_text())
            if isinstance(saved, dict) and isinstance(saved.get('sessions'), list):
                self.value = saved
        except (OSError, ValueError):
            pass

    def public(self):
        return self.value

    def observe(self, data):
        stamp = data['readAt']
        previous = self.previous
        if previous and stamp <= previous['readAt']:
            return
        active = self.value['active']
        changed = False
        if data.get('state') == 'charging' and active is None:
            active = {'id': str(stamp), 'start': stamp, 'end': None, 'lastSeen': stamp, 'energyKwh': 0, 'peakKw': 0, 'partial': previous is None or stamp - previous['readAt'] > 90000, 'segments': []}
            self.value['active'] = active
            changed = True
        if active is not None:
            if previous and previous['readAt'] >= active['start']:
                seconds = (stamp - previous['readAt']) / 1000
                # Only bridge short gaps and measured power values. A missing reading is not zero.
                powers = (previous.get('power'), data.get('power'))
                if seconds <= 90 and all(isinstance(p, (int, float)) and not isinstance(p, bool) and math.isfinite(p) and 0 <= p <= 50 for p in powers):
                    energy = (powers[0] + powers[1]) / 2 * seconds / 3600
                    active['energyKwh'] += energy
                    # Split at UTC five-minute boundaries (also respects French tariff boundaries).
                    cursor = previous['readAt']
                    while cursor < stamp:
                        boundary = min(stamp, (cursor // 300000 + 1) * 300000)
                        bucket = int(cursor // 300000 * 300000)
                        piece = energy * (boundary - cursor) / (stamp - previous['readAt'])
                        if active['segments'] and active['segments'][-1]['time'] == bucket:
                            active['segments'][-1]['kwh'] += piece
                        else:
                            active['segments'].append({'time': bucket, 'kwh': piece})
                        cursor = boundary
                else:
                    active['partial'] = True
            elif stamp > active.get('lastSeen', stamp):
                active['partial'] = True
            active['lastSeen'] = stamp
            power = data.get('power')
            if isinstance(power, (int, float)) and math.isfinite(power):
                active['peakKw'] = max(active['peakKw'], power)
            if data.get('state') in ('idle', 'sleep', 'finished'):
                active['end'] = stamp
                self.value['sessions'] = ([active] + self.value['sessions'])[:365]
                self.value['active'] = None
                changed = True
        self.previous = dict(data)
        if changed or not self.path.exists() or active and time.monotonic() - self.last_save > 60:
            self.save()

    def save(self):
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        temporary = self.path.with_suffix('.tmp')
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as output:
            json.dump(self.value, output, separators=(',', ':'), allow_nan=False)
        os.replace(temporary, self.path)
        self.last_save = time.monotonic()
