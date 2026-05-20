"""
Load and expose WANEmulator configuration from config.yaml.
"""
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List

import yaml

logger = logging.getLogger(__name__)

CONFIG_PATH = os.environ.get(
    "WANEMULATOR_CONFIG",
    str(Path(__file__).resolve().parent.parent / "config.yaml"),
)


@dataclass
class LinkConfig:
    id: str
    name: str
    iface_a: str
    iface_b: str
    bridge: str
    description: str = ""
    physical_label: str = ""


@dataclass
class AppConfig:
    links: Dict[str, LinkConfig] = field(default_factory=dict)
    protected_interfaces: List[str] = field(default_factory=list)
    auto_setup_bridges: bool = True
    captures_dir: str = "/var/lib/wanemulator/captures"
    profiles_db: str = "/var/lib/wanemulator/profiles.db"
    dry_run: bool = False

    def is_protected(self, iface: str) -> bool:
        """Return True if *iface* is in the protected (management) list."""
        return iface in self.protected_interfaces


def load_config(path: str = CONFIG_PATH) -> AppConfig:
    with open(path) as fh:
        raw = yaml.safe_load(fh)

    cfg = AppConfig(
        protected_interfaces=raw.get("protected_interfaces", []),
        auto_setup_bridges=raw.get("auto_setup_bridges", True),
        captures_dir=raw.get("captures_dir", "/var/lib/wanemulator/captures"),
        profiles_db=raw.get("profiles_db", "/var/lib/wanemulator/profiles.db"),
        dry_run=raw.get("dry_run", False),
    )

    for link_id, ldata in raw.get("links", {}).items():
        iface_a = ldata["iface_a"]
        iface_b = ldata["iface_b"]
        if iface_a in cfg.protected_interfaces or iface_b in cfg.protected_interfaces:
            logger.error(
                "FATAL: link %s uses protected interface(s) — check config.yaml. "
                "iface_a=%s iface_b=%s protected=%s",
                link_id, iface_a, iface_b, cfg.protected_interfaces,
            )
            raise ValueError(
                f"Link {link_id!r} references a protected interface "
                f"({iface_a!r} or {iface_b!r}). "
                "Remove it from protected_interfaces or change the link config."
            )
        cfg.links[link_id] = LinkConfig(
            id=link_id,
            name=ldata.get("name", link_id),
            iface_a=iface_a,
            iface_b=iface_b,
            bridge=ldata["bridge"],
            description=ldata.get("description", ""),
            physical_label=ldata.get("physical_label", ""),
        )

    logger.info(
        "Config loaded from %s — %d link(s), protected: %s, auto_setup_bridges: %s",
        path, len(cfg.links), cfg.protected_interfaces, cfg.auto_setup_bridges,
    )
    return cfg


config = load_config()
