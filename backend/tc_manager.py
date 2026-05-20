"""
tc/netem impairment management — WANEmulator V2.

V2 changes vs V1:
  - Unified single-netem approach: netem's built-in `rate` replaces TBF+netem chain.
  - Filter support: prio root + tc flower classifier + netem on band 1.
  - New impairment types: corrupt (bit errors), burst loss (GE model).
  - All bandwidth throttling handled via netem `rate` parameter.

Impairment direction convention (unchanged from V1):
  A→B traffic exits on iface_b  →  shape iface_b egress
  B→A traffic exits on iface_a  →  shape iface_a egress

Filter chain (when filter.is_active()):
  root: prio bands 3 (priomap all→band 3 = pass-through by default)
    band 1 (1:1): netem [all params including rate]   ← matched traffic
    band 3 (1:3): pfifo_fast (pass-through)           ← unmatched traffic
  filter: tc flower ... flowid 1:1
"""
import logging
from typing import List, Optional, Tuple

from models import DirectionImpairment, FilterConfig
from runner import run

logger = logging.getLogger(__name__)

# Default priomap — all 16 TOS/priority values map to band index 2 (= class 1:3, pass-through)
_PRIOMAP_PASSTHROUGH = ["2"] * 16


def _netem_args(s: DirectionImpairment) -> List[str]:
    """Build the netem argument list for a DirectionImpairment.

    Order: delay → loss/gemodel → duplicate → corrupt → reorder → rate
    """
    args: List[str] = []

    # ── Delay + jitter ─────────────────────────────────────────────────────
    has_delay   = s.delay_ms > 0
    has_jitter  = s.jitter_ms > 0
    has_reorder = s.reorder_percent > 0

    # Reorder requires a non-zero base delay; inject 1 ms floor if needed.
    effective_delay = s.delay_ms if has_delay else (1.0 if has_reorder else 0.0)
    if effective_delay > 0:
        args += ["delay", f"{effective_delay:.3f}ms"]
        if has_jitter:
            args += [f"{s.jitter_ms:.3f}ms"]
            if s.delay_correlation > 0:
                args += [f"{s.delay_correlation:.2f}%"]

    # ── Loss ──────────────────────────────────────────────────────────────
    if s.burst_loss_enabled and s.burst_loss_prob > 0:
        # Gilbert-Elliott 4-state Markov burst loss model:
        #   p  = P(good→bad)  — burst entry probability
        #   r  = P(bad→good)  — burst exit probability = 100 / avg_burst_length
        #   1-h = 0%          — delivery in bad state  (all dropped)
        #   1-k = 0%          — loss    in good state  (all pass)
        r_pct = min(100.0, 100.0 / s.burst_loss_avg_length)
        args += [
            "loss", "gemodel",
            f"{s.burst_loss_prob:.4f}%",
            f"{r_pct:.4f}%",
            "0%",   # 1-h: no delivery in bad state
            "0%",   # 1-k: no loss in good state
        ]
    elif s.loss_percent > 0:
        args += ["loss", f"{s.loss_percent:.4f}%"]
        if s.loss_correlation > 0:
            args += [f"{s.loss_correlation:.2f}%"]

    # ── Duplicate ─────────────────────────────────────────────────────────
    if s.duplicate_percent > 0:
        args += ["duplicate", f"{s.duplicate_percent:.4f}%"]
        if s.duplicate_correlation > 0:
            args += [f"{s.duplicate_correlation:.2f}%"]

    # ── Corruption (bit errors) ────────────────────────────────────────────
    if s.corrupt_percent > 0:
        args += ["corrupt", f"{s.corrupt_percent:.4f}%"]
        if s.corrupt_correlation > 0:
            args += [f"{s.corrupt_correlation:.2f}%"]

    # ── Reorder ───────────────────────────────────────────────────────────
    if has_reorder:
        args += ["reorder", f"{s.reorder_percent:.4f}%"]
        if s.reorder_correlation > 0:
            args += [f"{s.reorder_correlation:.2f}%"]

    # ── Rate (bandwidth cap) ───────────────────────────────────────────────
    if s.bandwidth_mbit > 0:
        args += ["rate", f"{s.bandwidth_mbit:.3f}mbit"]

    return args


def _has_any_impairment(s: DirectionImpairment) -> bool:
    return any([
        s.delay_ms > 0, s.jitter_ms > 0,
        s.loss_percent > 0, s.burst_loss_enabled,
        s.duplicate_percent > 0, s.reorder_percent > 0,
        s.corrupt_percent > 0, s.bandwidth_mbit > 0,
    ])


def _flower_filter_args(f: FilterConfig) -> List[str]:
    """Build the argument list for `tc filter add dev <iface> parent 1:0 ...`.

    Returns everything after `tc filter add dev <iface>`.
    The caller prefixes `parent 1:0` and appends `flowid 1:1`.
    """
    args: List[str] = ["parent", "1:0"]

    # Determine L2/L3 protocol for the filter
    if f.vlan_id is not None:
        args += ["protocol", "802.1q", "prio", "1", "flower",
                 "vlan_id", str(f.vlan_id),
                 "vlan_ethtype", "ip"]
    elif f.mpls_label is not None:
        args += ["protocol", "mpls", "prio", "1", "flower",
                 "mpls_label", str(f.mpls_label)]
    else:
        args += ["protocol", "ip", "prio", "1", "flower"]

    if f.src_ip:
        args += ["src_ip", f.src_ip]
    if f.dst_ip:
        args += ["dst_ip", f.dst_ip]
    if f.protocol:
        args += ["ip_proto", f.protocol]
    if f.src_port is not None:
        args += ["src_port", str(f.src_port)]
    if f.dst_port is not None:
        args += ["dst_port", str(f.dst_port)]
    if f.dscp is not None:
        # DSCP occupies bits 7:2 of the TOS byte; mask 0xFC isolates those bits.
        tos_val = (f.dscp << 2) & 0xFF
        args += ["ip_tos", f"{tos_val:#04x}/0xfc"]

    args += ["flowid", "1:1"]
    return args


def clear_qdisc(iface: str, dry_run: bool = False) -> List[str]:
    """Remove root qdisc from an interface.  Always ignore errors (idempotent)."""
    cmd = ["tc", "qdisc", "del", "dev", iface, "root"]
    run(cmd, dry_run=dry_run, ignore_errors=True)
    return [" ".join(cmd)]


def apply_direction(
    iface: str,
    settings: DirectionImpairment,
    dry_run: bool = False,
) -> Tuple[bool, List[str], List[str]]:
    """Apply impairment to a single interface egress.

    Returns (success, commands_run, errors).
    """
    commands: List[str] = []
    errors: List[str] = []

    def _exec(args: List[str]) -> bool:
        commands.append(" ".join(args))
        try:
            run(args, dry_run=dry_run)
            return True
        except RuntimeError as exc:
            errors.append(str(exc))
            return False

    # Always start from a clean state
    commands += clear_qdisc(iface, dry_run=dry_run)

    if not _has_any_impairment(settings):
        logger.info("No impairment for %s – qdisc cleared", iface)
        return True, commands, errors

    netem = _netem_args(settings)
    use_filter = settings.filter is not None and settings.filter.is_active()

    try:
        if use_filter:
            # ── Filtered mode: prio root + netem on band 1 ────────────────
            if not _exec(["tc", "qdisc", "add", "dev", iface,
                           "root", "handle", "1:", "prio",
                           "bands", "3",
                           "priomap"] + _PRIOMAP_PASSTHROUGH):
                return False, commands, errors

            if not _exec(["tc", "qdisc", "add", "dev", iface,
                           "parent", "1:1", "handle", "10:", "netem"] + netem):
                return False, commands, errors

            flower_args = _flower_filter_args(settings.filter)
            if not _exec(["tc", "filter", "add", "dev", iface] + flower_args):
                return False, commands, errors

        else:
            # ── Global mode: single netem as root ─────────────────────────
            if not _exec(["tc", "qdisc", "add", "dev", iface,
                           "root", "handle", "1:", "netem"] + netem):
                return False, commands, errors

        logger.info("Impairment applied to %s (filter=%s)", iface, use_filter)
        return True, commands, errors

    except Exception as exc:
        errors.append(f"Unexpected error: {exc}")
        logger.exception("apply_direction failed for %s", iface)
        return False, commands, errors


def get_qdisc_stats(iface: str) -> str:
    """Return raw `tc -s qdisc show dev <iface>` output."""
    try:
        result = run(["tc", "-s", "qdisc", "show", "dev", iface], ignore_errors=True)
        return result.stdout
    except Exception as exc:
        return f"Error: {exc}"


def get_filter_show(iface: str) -> str:
    """Return raw `tc filter show dev <iface>` output (for debugging filters)."""
    try:
        result = run(["tc", "filter", "show", "dev", iface], ignore_errors=True)
        return result.stdout
    except Exception as exc:
        return f"Error: {exc}"


def get_all_qdiscs() -> str:
    """Return raw `tc qdisc show` for all interfaces."""
    try:
        result = run(["tc", "qdisc", "show"], ignore_errors=True)
        return result.stdout
    except Exception as exc:
        return f"Error: {exc}"
