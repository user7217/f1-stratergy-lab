import math
import threading
import pandas as pd
import fastf1

_F1_LOCK = threading.Lock()

def to_seconds(val, t0=None):
    if val is None or pd.isna(val):
        return None
    try:
        if hasattr(val, 'total_seconds'):
            sec = float(val.total_seconds())
            return None if math.isnan(sec) else sec
        if hasattr(val, 'timestamp'):
            if t0 is not None and pd.notna(t0):
                sec = float((val - t0).total_seconds())
                return None if math.isnan(sec) else sec
            return float(val.hour * 3600 + val.minute * 60 + val.second + val.microsecond / 1e6)
        sec = float(val)
        return None if math.isnan(sec) else sec
    except (ValueError, TypeError):
        return None

def safe_float(val, default=None):
    if val is None or pd.isna(val):
        return default
    try:
        if math.isnan(float(val)):
            return default
        return float(val)
    except (TypeError, ValueError):
        return default

def _get_safe_session(year: int, race: str, session_type: str, telemetry: bool = False):
    with _F1_LOCK:
        session = fastf1.get_session(year, race, session_type)
        if session.date > pd.Timestamp.now():
            raise ValueError(f"The {year} {race} {session_type} session has not occurred yet.")
        session.load(laps=True, telemetry=telemetry, weather=True, messages=True)
        if getattr(session, 'laps', None) is None or session.laps.empty:
            raise ValueError("No lap data found.")
        return session