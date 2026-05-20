"""
Live tc statistics collector — WANEmulator V2.

Parses `tc -s qdisc show dev <iface>` output and maintains a 60-sample
ring buffer per interface.  Callers poll sample() and read get_history().
"""
import logging
import re
import time
from collections import deque
from typing import Dict, List, Optional

from runner import run

logger = logging.getLogger(__name__)

# Per-interface ring buffer: iface → deque of sample dicts
_history: Dict[str, deque] = {}
_HISTORY_SIZE = 60  # 60 samples × 2-second poll interval = 2-minute window

# Regex to extract Sent statistics from `tc -s qdisc show dev <iface>` output
_SENT_RE = re.compile(
    r"Sent\s+(\d+)\s+bytes\s+(\d+)\s+pkt\s+"
    r"\(dropped\s+(\d+),\s+overlimits\s+(\d+)\s+requeues\s+(\d+)\)"
)


def _parse_stats(raw: str) -> Optional[dict]:
    """Parse the first 'Sent ...' line from tc -s output.  Returns None if not found."""
    m = _SENT_RE.search(raw)
    if not m:
        return None
    return {
        "bytes_sent":  int(m.group(1)),
        "packets_sent": int(m.group(2)),
        "dropped":      int(m.group(3)),
        "overlimits":   int(m.group(4)),
        "requeues":     int(m.group(5)),
    }


def sample(iface: str) -> Optional[dict]:
    """
    Read current tc stats for *iface*, compute per-interval deltas,
    append to history, and return the latest sample dict.

    Returns None if tc stats are not available (interface has no qdisc).
    """
    try:
        result = run(["tc", "-s", "qdisc", "show", "dev", iface], ignore_errors=True)
        parsed = _parse_stats(result.stdout)
    except Exception as exc:
        logger.warning("stats_collector.sample(%s): %s", iface, exc)
        return None

    if parsed is None:
        return None

    ts = time.time()
    buf = _history.setdefault(iface, deque(maxlen=_HISTORY_SIZE))

    # Compute deltas vs. previous sample (counters are cumulative)
    if buf:
        prev = buf[-1]
        dt = ts - prev["ts"] or 1.0
        pkt_rate  = max(0, parsed["packets_sent"] - prev["packets_sent"]) / dt
        byte_rate = max(0, parsed["bytes_sent"]   - prev["bytes_sent"])   / dt
        drop_rate = max(0, parsed["dropped"]       - prev["dropped"])      / dt
    else:
        pkt_rate = byte_rate = drop_rate = 0.0

    # Drop percentage (cumulative)
    total = parsed["packets_sent"] + parsed["dropped"]
    drop_pct = (parsed["dropped"] / total * 100.0) if total > 0 else 0.0

    entry = {
        "ts":           ts,
        "bytes_sent":   parsed["bytes_sent"],
        "packets_sent": parsed["packets_sent"],
        "dropped":      parsed["dropped"],
        "overlimits":   parsed["overlimits"],
        "requeues":     parsed["requeues"],
        "pkt_rate":     round(pkt_rate,  2),
        "byte_rate":    round(byte_rate, 2),
        "drop_rate":    round(drop_rate, 2),
        "drop_percent": round(drop_pct,  2),
    }
    buf.append(entry)
    return entry


def get_history(iface: str) -> List[dict]:
    """Return the full sample history for an interface (up to 60 samples)."""
    buf = _history.get(iface)
    if buf is None:
        return []
    return list(buf)


def get_latest(iface: str) -> Optional[dict]:
    """Return only the most recent sample without re-reading tc."""
    buf = _history.get(iface)
    if not buf:
        return None
    return buf[-1]


def clear_history(iface: str) -> None:
    """Clear history for an interface (e.g. after reset)."""
    _history.pop(iface, None)
