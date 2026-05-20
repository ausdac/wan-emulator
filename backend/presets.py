"""
Built-in WAN emulation presets for WANEmulator V2.

Each preset defines symmetric impairment parameters (same A→B and B→A)
representing a real-world network link type.  Users can apply a preset
as a starting point and then fine-tune individual parameters.
"""
from typing import Dict, List

from models import DirectionImpairment, LinkImpairmentRequest

# ── Preset definitions ──────────────────────────────────────────────────────
# Each entry: name → {description, category, params}
# params are passed directly to DirectionImpairment (applied symmetrically).

_PRESET_DEFS: Dict[str, dict] = {
    "3g-mobile": {
        "description": "3G cellular (UMTS/HSPA) — high latency, low bandwidth",
        "category":    "Mobile",
        "params": dict(delay_ms=150, jitter_ms=30, loss_percent=0.5,  bandwidth_mbit=2),
    },
    "4g-lte": {
        "description": "4G LTE — moderate latency, good bandwidth",
        "category":    "Mobile",
        "params": dict(delay_ms=40,  jitter_ms=10, loss_percent=0.1,  bandwidth_mbit=20),
    },
    "5g": {
        "description": "5G NR — very low latency, high bandwidth",
        "category":    "Mobile",
        "params": dict(delay_ms=10,  jitter_ms=3,  loss_percent=0.01, bandwidth_mbit=100),
    },
    "satellite-geo": {
        "description": "GEO satellite (36,000 km orbit) — very high latency",
        "category":    "Satellite",
        "params": dict(delay_ms=600, jitter_ms=15, loss_percent=0.5,  bandwidth_mbit=5),
    },
    "satellite-leo": {
        "description": "LEO satellite (Starlink-class) — low latency, moderate bandwidth",
        "category":    "Satellite",
        "params": dict(delay_ms=30,  jitter_ms=5,  loss_percent=0.1,  bandwidth_mbit=50),
    },
    "dsl": {
        "description": "ADSL broadband — asymmetric, moderate latency",
        "category":    "Broadband",
        "params": dict(delay_ms=20,  jitter_ms=5,  loss_percent=0.1,  bandwidth_mbit=10),
    },
    "cable": {
        "description": "DOCSIS cable — low latency, higher bandwidth",
        "category":    "Broadband",
        "params": dict(delay_ms=15,  jitter_ms=5,  loss_percent=0.05, bandwidth_mbit=100),
    },
    "fiber": {
        "description": "Fiber optic (GPON/EPON) — very low latency, gigabit",
        "category":    "Broadband",
        "params": dict(delay_ms=5,   jitter_ms=1,  loss_percent=0.001,bandwidth_mbit=1000),
    },
    "lossy-wifi": {
        "description": "Congested 2.4 GHz WiFi — high jitter, elevated loss",
        "category":    "Wireless",
        "params": dict(delay_ms=10,  jitter_ms=20, loss_percent=5.0,  bandwidth_mbit=54),
    },
    "congested-wan": {
        "description": "Congested enterprise WAN — high delay, jitter, and loss",
        "category":    "WAN",
        "params": dict(delay_ms=100, jitter_ms=50, loss_percent=2.0,  bandwidth_mbit=10),
    },
    "qos-stress": {
        "description": "QoS stress test — worst-case: max delay, jitter, and loss",
        "category":    "Testing",
        "params": dict(delay_ms=200, jitter_ms=100,loss_percent=10.0, bandwidth_mbit=1),
    },
}


def list_presets() -> List[dict]:
    """Return list of preset summaries (name, description, category)."""
    return [
        {"name": name, "description": d["description"], "category": d["category"]}
        for name, d in _PRESET_DEFS.items()
    ]


def get_preset(name: str) -> dict:
    """Return a preset definition dict, or raise KeyError if not found."""
    entry = _PRESET_DEFS.get(name)
    if entry is None:
        raise KeyError(f"Unknown preset: {name!r}")
    return {
        "name":        name,
        "description": entry["description"],
        "category":    entry["category"],
        "params":      entry["params"],
    }


def build_impairment_request(name: str) -> LinkImpairmentRequest:
    """Build a LinkImpairmentRequest from a preset name (symmetric A↔B)."""
    entry = _PRESET_DEFS.get(name)
    if entry is None:
        raise KeyError(f"Unknown preset: {name!r}")
    direction = DirectionImpairment(**entry["params"])
    return LinkImpairmentRequest(
        enabled=True,
        a_to_b=direction,
        b_to_a=direction.model_copy(),
    )
