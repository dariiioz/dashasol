"""Narrow, read-only payloads: no cookies, credentials or raw portal responses."""
from datetime import datetime, timezone
import math


def numeric(value, minimum=0, maximum=1_000_000):
    if value is None or isinstance(value, bool) or (isinstance(value, str) and not value.strip()):
        return None
    try:
        value = float(value)
        return value if math.isfinite(value) and minimum <= value <= maximum else None
    except (TypeError, ValueError):
        return None


def timestamp(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None or parsed.year < 2000:
            return None
        return parsed.astimezone(timezone.utc).isoformat()
    except ValueError:
        return None


def snapshot(vin, charging, maintenance, fetched_at):
    def text(key):
        val = charging.get(key)
        return val[:100] if isinstance(val, str) else None
    return {
        "vin": vin,
        "battery": numeric(charging.get("soc"), maximum=100),
        "range": numeric(charging.get("electric_range"), maximum=1500),
        "target": numeric(charging.get("target_soc"), maximum=100),
        "batteryTemperature": numeric(charging.get("battery_temp"), minimum=-50, maximum=90),
        "chargingState": text("charging_state"),
        "power": numeric(charging.get("charge_power"), maximum=500),
        "chargeRate": numeric(charging.get("charge_rate"), maximum=3000),
        "remainingMinutes": numeric(charging.get("charge_time_remaining"), maximum=7 * 24 * 60),
        "chargeType": text("charge_type"),
        "plug": text("plug_connection"),
        "plugLock": text("plug_lock"),
        "externalPower": text("external_power"),
        "odometer": numeric(maintenance.get("mileage_km"), maximum=5_000_000),
        "inspectionDays": numeric(maintenance.get("inspectionDue_days"), minimum=-3650, maximum=3650),
        "inspectionKm": numeric(maintenance.get("inspectionDue_km"), minimum=-100_000, maximum=1_000_000),
        "reportedAt": timestamp(charging.get("reported_at")),
        "chargingReportedAt": timestamp(charging.get("charging_reported_at")),
        "plugReportedAt": timestamp(charging.get("plug_reported_at")),
        "odometerReportedAt": timestamp(maintenance.get("carCapturedTimestamp")),
        "fetchedAt": fetched_at,
    }
