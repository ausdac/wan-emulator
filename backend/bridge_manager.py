"""
Linux bridge lifecycle management — WANEmulator V2.

SAFETY: All functions check against the protected_interfaces list before
touching any interface.  Passing a protected interface raises RuntimeError.

Bridge forwarding notes:
  - Linux bridges operate at Layer 2 — they do NOT require net.ipv4.ip_forward.
  - Bridged traffic bypasses the IP stack entirely; the bridge kernel module
    handles forwarding between member interfaces.
  - If br_netfilter is loaded, iptables/nftables will see bridged frames.
    We set bridge-nf-call-iptables=0 via sysctl to prevent interference.
  - STP is disabled (stp_state 0) to eliminate the 30-second convergence
    delay that would stall inline traffic on bridge creation.
  - Member interfaces are set promiscuous so they pass all MAC addresses.
"""
import logging
from typing import List, Optional, Tuple

from runner import run

logger = logging.getLogger(__name__)

# Injected at startup from config to avoid circular imports
_protected: List[str] = []


def set_protected_interfaces(ifaces: List[str]) -> None:
    """Called once at startup to register the protected interface list."""
    global _protected
    _protected = list(ifaces)
    logger.info("Protected interfaces: %s", _protected)


def _guard(iface: str) -> None:
    """Raise RuntimeError if *iface* is protected (management)."""
    if iface in _protected:
        raise RuntimeError(
            f"Refusing to touch protected interface {iface!r}. "
            "Edit protected_interfaces in config.yaml if this is intentional."
        )


def _iface_exists(iface: str) -> bool:
    r = run(["ip", "link", "show", iface], ignore_errors=True)
    return r.success


def bridge_exists(bridge: str) -> bool:
    r = run(["ip", "link", "show", "type", "bridge"], ignore_errors=True)
    return bridge in r.stdout


def is_bridge_up(bridge: str) -> bool:
    r = run(["ip", "link", "show", bridge], ignore_errors=True)
    return r.success and "state UP" in r.stdout


def setup_bridge(
    bridge: str,
    iface_a: str,
    iface_b: str,
    dry_run: bool = False,
) -> Tuple[bool, List[str], List[str]]:
    """
    Create a bridge and enslave two data-plane interfaces.
    Idempotent — safe to call if already set up.

    Both iface_a and iface_b are checked against the protected list first.
    """
    commands: List[str] = []
    errors: List[str] = []

    # ── Safety checks ──────────────────────────────────────────────────────
    for iface in (iface_a, iface_b):
        if iface in _protected:
            msg = (
                f"BLOCKED: {iface!r} is a protected management interface. "
                "It will not be added to any bridge."
            )
            logger.error(msg)
            errors.append(msg)
            return False, commands, errors

    def _run(args):
        commands.append(" ".join(args))
        return run(args, dry_run=dry_run, ignore_errors=False)

    try:
        # ── Create bridge if needed ────────────────────────────────────────
        if not bridge_exists(bridge):
            _run(["ip", "link", "add", "name", bridge, "type", "bridge"])
            # Disable STP — eliminates 30s convergence delay for inline use
            _run(["ip", "link", "set", bridge, "type", "bridge", "stp_state", "0"])

        _run(["ip", "link", "set", bridge, "up"])

        # ── Enslave member interfaces ──────────────────────────────────────
        for iface in (iface_a, iface_b):
            if not _iface_exists(iface):
                msg = f"Interface {iface!r} not found — skipping"
                logger.warning(msg)
                errors.append(msg)
                continue
            # Remove any IP addresses (bridge members must be L2 only)
            run(["ip", "addr", "flush", "dev", iface],
                dry_run=dry_run, ignore_errors=True)
            _run(["ip", "link", "set", iface, "up"])
            _run(["ip", "link", "set", iface, "promisc", "on"])
            # Add to bridge only if not already a member
            master_check = run(
                ["ip", "link", "show", iface], ignore_errors=True
            )
            if f"master {bridge}" not in master_check.stdout:
                _run(["ip", "link", "set", iface, "master", bridge])

        logger.info("Bridge %s ready (%s ↔ %s)", bridge, iface_a, iface_b)
        return True, commands, errors

    except RuntimeError as exc:
        errors.append(str(exc))
        logger.error("Bridge setup failed for %s: %s", bridge, exc)
        return False, commands, errors


def teardown_bridge(
    bridge: str,
    iface_a: str,
    iface_b: str,
    dry_run: bool = False,
) -> Tuple[bool, List[str], List[str]]:
    """
    Remove bridge and release member interfaces.
    Protected interfaces are silently skipped (they were never enslaved anyway).
    """
    commands: List[str] = []

    def _run(args):
        commands.append(" ".join(args))
        return run(args, dry_run=dry_run, ignore_errors=True)

    for iface in (iface_a, iface_b):
        if iface in _protected:
            continue
        _run(["ip", "link", "set", iface, "nomaster"])
        _run(["ip", "link", "set", iface, "promisc", "off"])
        _run(["ip", "link", "set", iface, "down"])

    _run(["ip", "link", "set", bridge, "down"])
    _run(["ip", "link", "del", bridge])

    logger.info("Bridge %s torn down", bridge)
    return True, commands, []
