"""
WANEmulator v2 — FastAPI backend.

Key behaviours added in this revision:
  - Protected interface enforcement: any iface in config.protected_interfaces
    is blocked at every API entry point and never appears in /interfaces.
  - Auto bridge setup: if config.auto_setup_bridges is true, all configured
    bridges are created at service start (runs on every boot via systemd).
  - Reset no longer tears down bridges — it only clears tc qdiscs so the
    inline path stays live while impairments are removed.
"""
import asyncio
import logging
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import re
import subprocess

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

import bridge_manager
import database
import presets as preset_lib
import stats_collector
import tc_manager
from config import config
from models import (
    CommandResult,
    CycleRequest,
    CycleStatus,
    DirectionImpairment,
    IfaceStats,
    LinkImpairmentRequest,
    LinkStatus,
    LiveStatsResponse,
    ProfileSaveRequest,
)

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("/var/log/wanemulator.log", mode="a"),
    ],
)
logger = logging.getLogger("wanemulator")

# ── In-memory link state ─────────────────────────────────────────────────────
_link_settings: Dict[str, LinkImpairmentRequest] = {}

# ── Cycle state ───────────────────────────────────────────────────────────────
_cycle_config: Dict[str, Tuple[float, float]] = {}   # link_id -> (on_secs, off_secs)
_cycle_phase:  Dict[str, str]                 = {}   # link_id -> "on" | "off"
_cycle_start:  Dict[str, float]               = {}   # link_id -> phase start time (monotonic)
_cycle_tasks:  Dict[str, asyncio.Task]        = {}   # link_id -> running Task


# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("WANEmulator v2 starting")
    logger.info("Protected interfaces: %s", config.protected_interfaces)

    # Register protected interfaces with bridge_manager (safety guard)
    bridge_manager.set_protected_interfaces(config.protected_interfaces)

    database.init_db(config.profiles_db)

    for link_id in config.links:
        _link_settings[link_id] = LinkImpairmentRequest()

    # Auto-setup bridges if configured — this runs on every service start
    # (i.e., on every boot), making bridges boot-persistent.
    if config.auto_setup_bridges:
        logger.info("auto_setup_bridges=true — setting up all configured bridges")
        for link_id, lc in config.links.items():
            ok, cmds, errs = bridge_manager.setup_bridge(
                lc.bridge, lc.iface_a, lc.iface_b, dry_run=config.dry_run
            )
            if ok:
                logger.info("Bridge %s ready (%s ↔ %s)", lc.bridge, lc.iface_a, lc.iface_b)
            else:
                logger.warning("Bridge %s setup issues: %s", lc.bridge, errs)

    yield  # ── server running ──

    logger.info("WANEmulator shutting down")
    for task in list(_cycle_tasks.values()):
        task.cancel()
    if _cycle_tasks:
        await asyncio.gather(*_cycle_tasks.values(), return_exceptions=True)


app = FastAPI(
    title="WANEmulator",
    version="2.0.0",
    description="Linux tc/netem WAN impairment controller",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Cycle helpers ─────────────────────────────────────────────────────────────

async def _cycle_loop(link_id: str) -> None:
    """Asyncio background task: alternates impairment on/off forever."""
    lc = config.links[link_id]
    logger.info("Cycle started for %s", link_id)
    try:
        while True:
            on_secs, off_secs = _cycle_config[link_id]

            # ON phase — apply saved impairment settings
            _cycle_phase[link_id] = "on"
            _cycle_start[link_id] = time.monotonic()
            settings = _link_settings[link_id]
            tc_manager.apply_direction(lc.iface_b, settings.a_to_b, dry_run=config.dry_run)
            tc_manager.apply_direction(lc.iface_a, settings.b_to_a, dry_run=config.dry_run)
            await asyncio.sleep(on_secs)

            # OFF phase — clear qdiscs
            _cycle_phase[link_id] = "off"
            _cycle_start[link_id] = time.monotonic()
            tc_manager.clear_qdisc(lc.iface_a, dry_run=config.dry_run)
            tc_manager.clear_qdisc(lc.iface_b, dry_run=config.dry_run)
            await asyncio.sleep(off_secs)

    except asyncio.CancelledError:
        # Clean up on stop: clear any active impairments
        tc_manager.clear_qdisc(lc.iface_a, dry_run=config.dry_run)
        tc_manager.clear_qdisc(lc.iface_b, dry_run=config.dry_run)
        logger.info("Cycle stopped for %s", link_id)
        raise


def _stop_cycle(link_id: str) -> None:
    task = _cycle_tasks.pop(link_id, None)
    if task:
        task.cancel()
    _cycle_config.pop(link_id, None)
    _cycle_phase.pop(link_id, None)
    _cycle_start.pop(link_id, None)


def _get_cycle_status(link_id: str) -> CycleStatus:
    if link_id not in _cycle_tasks or _cycle_tasks[link_id].done():
        return CycleStatus()
    on_secs, off_secs = _cycle_config.get(link_id, (0.0, 0.0))
    phase = _cycle_phase.get(link_id)
    start = _cycle_start.get(link_id, time.monotonic())
    duration = on_secs if phase == "on" else off_secs
    elapsed = time.monotonic() - start
    countdown = max(0.0, duration - elapsed)
    return CycleStatus(
        running=True,
        phase=phase,
        countdown=round(countdown, 1),
        on_secs=on_secs,
        off_secs=off_secs,
    )


# ── Guards ─────────────────────────────────────────────────────────────────

def _get_link(link_id: str):
    lc = config.links.get(link_id)
    if lc is None:
        raise HTTPException(404, f"Unknown link: {link_id!r}")
    return lc


def _assert_not_protected(iface: str) -> None:
    if config.is_protected(iface):
        raise HTTPException(
            403,
            f"Interface {iface!r} is a protected management interface and cannot "
            "be used for data-plane operations. Check protected_interfaces in config.yaml."
        )


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status":               "ok",
        "version":              "2.0.0",
        "dry_run":              config.dry_run,
        "links":                list(config.links.keys()),
        "protected_interfaces": config.protected_interfaces,
        "auto_setup_bridges":   config.auto_setup_bridges,
    }


# ── Interfaces ────────────────────────────────────────────────────────────────

@app.get("/interfaces")
async def list_interfaces():
    """
    Return all non-loopback, non-bridge, non-protected interfaces.
    Used by the UI to show which physical ports are available.
    Protected interfaces are never included.
    """
    try:
        out = subprocess.check_output(
            ["ip", "-o", "link", "show"], text=True
        )
    except Exception as exc:
        raise HTTPException(500, f"ip link show failed: {exc}")

    # Build a set of bridge interface names to exclude
    bridge_names = {lc.bridge for lc in config.links.values()}
    # Also exclude interfaces already enslaved in a bridge
    enslaved = set()
    for lc in config.links.values():
        enslaved.add(lc.iface_a)
        enslaved.add(lc.iface_b)

    result = []
    for line in out.splitlines():
        m = re.match(r"\d+:\s+(\S+?)(?:@\S+)?:", line)
        if not m:
            continue
        name = m.group(1)
        if name == "lo":
            continue
        if name in config.protected_interfaces:
            continue
        if name in bridge_names:
            continue
        state = "UP" if "state UP" in line else "DOWN"
        result.append({
            "name":      name,
            "state":     state,
            "protected": False,
            "in_use":    name in enslaved,
        })

    # Append protected interfaces as a separate list so the UI can display
    # a clear "management — do not use" note
    mgmt = [{"name": i, "protected": True} for i in config.protected_interfaces]

    return {"data_interfaces": result, "management_interfaces": mgmt}


# ── Links ─────────────────────────────────────────────────────────────────────

@app.get("/links")
async def list_links():
    result = []
    for link_id, lc in config.links.items():
        settings = _link_settings.get(link_id)
        result.append(LinkStatus(
            id=link_id, name=lc.name, physical_label=lc.physical_label,
            iface_a=lc.iface_a, iface_b=lc.iface_b,
            bridge=lc.bridge, description=lc.description,
            label=database.get_label(link_id),
            bridge_up=bridge_manager.is_bridge_up(lc.bridge),
            impairment_enabled=settings.enabled if settings else False,
            current_settings=settings,
            cycle=_get_cycle_status(link_id),
        ))
    return result


@app.post("/links/{link_id}/setup")
async def setup_link(link_id: str):
    """Force bridge recreation — useful after a partial failure or reboot."""
    lc = _get_link(link_id)
    _assert_not_protected(lc.iface_a)
    _assert_not_protected(lc.iface_b)

    ok, cmds, errs = bridge_manager.setup_bridge(
        lc.bridge, lc.iface_a, lc.iface_b, dry_run=config.dry_run
    )
    return CommandResult(
        success=ok,
        message="Bridge ready" if ok else "Bridge setup failed",
        commands=cmds, errors=errs,
    )


@app.post("/links/{link_id}/impairment")
async def set_impairment(link_id: str, body: LinkImpairmentRequest):
    lc = _get_link(link_id)
    _assert_not_protected(lc.iface_a)
    _assert_not_protected(lc.iface_b)
    _stop_cycle(link_id)
    _link_settings[link_id] = body

    all_cmds: List[str] = []
    all_errs: List[str] = []

    if not body.enabled:
        all_cmds += tc_manager.clear_qdisc(lc.iface_a, dry_run=config.dry_run)
        all_cmds += tc_manager.clear_qdisc(lc.iface_b, dry_run=config.dry_run)
        stats_collector.clear_history(lc.iface_a)
        stats_collector.clear_history(lc.iface_b)
        return CommandResult(success=True, message="Impairments cleared", commands=all_cmds)

    # A→B impairs iface_b egress; B→A impairs iface_a egress
    ok_ab, cmds_ab, errs_ab = tc_manager.apply_direction(
        lc.iface_b, body.a_to_b, dry_run=config.dry_run
    )
    ok_ba, cmds_ba, errs_ba = tc_manager.apply_direction(
        lc.iface_a, body.b_to_a, dry_run=config.dry_run
    )
    all_cmds += cmds_ab + cmds_ba
    all_errs += errs_ab + errs_ba

    return CommandResult(
        success=ok_ab and ok_ba,
        message="Impairments applied" if (ok_ab and ok_ba) else "Partial failure — see errors",
        commands=all_cmds, errors=all_errs,
    )


@app.post("/links/{link_id}/reset")
async def reset_link(link_id: str):
    """
    Clear all tc impairments on this link.
    The bridge is intentionally LEFT UP — the inline forwarding path stays live.
    Use DELETE /links/{id}/bridge to physically tear down the bridge.
    """
    lc = _get_link(link_id)
    all_cmds: List[str] = []

    _stop_cycle(link_id)
    all_cmds += tc_manager.clear_qdisc(lc.iface_a, dry_run=config.dry_run)
    all_cmds += tc_manager.clear_qdisc(lc.iface_b, dry_run=config.dry_run)

    stats_collector.clear_history(lc.iface_a)
    stats_collector.clear_history(lc.iface_b)
    _link_settings[link_id] = LinkImpairmentRequest()

    return CommandResult(
        success=True,
        message="Impairments cleared — bridge remains up",
        commands=all_cmds, errors=[],
    )


@app.post("/links/{link_id}/cycle")
async def set_cycle(link_id: str, body: CycleRequest):
    """Start or stop the server-side duty-cycle loop for a link."""
    lc = _get_link(link_id)
    _assert_not_protected(lc.iface_a)
    _assert_not_protected(lc.iface_b)

    _stop_cycle(link_id)

    if not body.enabled:
        return {"running": False, "message": "Cycle stopped"}

    if not _link_settings[link_id].enabled:
        raise HTTPException(400, "Apply impairment settings before starting a cycle")

    _cycle_config[link_id] = (body.on_secs, body.off_secs)
    task = asyncio.create_task(_cycle_loop(link_id))
    _cycle_tasks[link_id] = task
    return {"running": True, "message": "Cycle started", "on_secs": body.on_secs, "off_secs": body.off_secs}


@app.get("/links/{link_id}/cycle")
async def get_cycle(link_id: str):
    _get_link(link_id)
    return _get_cycle_status(link_id)


@app.put("/links/{link_id}/label")
async def set_label(link_id: str, body: dict):
    _get_link(link_id)
    label = str(body.get("label", ""))[:1000]
    database.set_label(link_id, label)
    return {"success": True, "message": "Label saved"}


@app.get("/links/{link_id}/stats")
async def link_stats(link_id: str):
    lc = _get_link(link_id)
    return {
        "link_id":       link_id,
        "iface_a_stats": tc_manager.get_qdisc_stats(lc.iface_a),
        "iface_b_stats": tc_manager.get_qdisc_stats(lc.iface_b),
        "filter_a":      tc_manager.get_filter_show(lc.iface_a),
        "filter_b":      tc_manager.get_filter_show(lc.iface_b),
        "all_qdiscs":    tc_manager.get_all_qdiscs(),
    }


@app.get("/links/{link_id}/stats/live", response_model=LiveStatsResponse)
async def link_stats_live(link_id: str):
    lc = _get_link(link_id)

    def _build(iface: str) -> IfaceStats:
        latest = stats_collector.sample(iface)
        hist = [
            {"ts": s["ts"], "pkt_rate": s["pkt_rate"], "drop_rate": s["drop_rate"]}
            for s in stats_collector.get_history(iface)
        ]
        if latest is None:
            return IfaceStats(history=hist)
        return IfaceStats(
            bytes_sent=latest["bytes_sent"],
            packets_sent=latest["packets_sent"],
            dropped=latest["dropped"],
            overlimits=latest["overlimits"],
            requeues=latest["requeues"],
            drop_percent=latest["drop_percent"],
            history=hist,
        )

    return LiveStatsResponse(
        link_id=link_id,
        iface_a=_build(lc.iface_a),
        iface_b=_build(lc.iface_b),
    )


# ── Profiles ──────────────────────────────────────────────────────────────────

@app.get("/profiles")
async def list_profiles():
    return database.list_profiles()


@app.post("/profiles")
async def save_profile(body: ProfileSaveRequest):
    settings_dict = {k: v.model_dump() for k, v in body.settings.items()}
    database.save_profile(body.name, body.description, settings_dict)
    return {"success": True, "message": f"Profile {body.name!r} saved"}


@app.get("/profiles/{profile_name}")
async def get_profile(profile_name: str):
    profile = database.get_profile(profile_name)
    if profile is None:
        raise HTTPException(404, f"Profile {profile_name!r} not found")
    return profile


@app.post("/profiles/{profile_name}/apply")
async def apply_profile(profile_name: str):
    profile = database.get_profile(profile_name)
    if profile is None:
        raise HTTPException(404, f"Profile {profile_name!r} not found")

    results = []
    for link_id, raw_settings in profile["settings"].items():
        if link_id not in config.links:
            results.append({"link_id": link_id, "success": False, "error": "Unknown link"})
            continue
        try:
            req = LinkImpairmentRequest.model_validate(raw_settings)
        except Exception as exc:
            results.append({"link_id": link_id, "success": False, "error": str(exc)})
            continue
        lc = config.links[link_id]
        _link_settings[link_id] = req

        if not req.enabled:
            tc_manager.clear_qdisc(lc.iface_a, dry_run=config.dry_run)
            tc_manager.clear_qdisc(lc.iface_b, dry_run=config.dry_run)
            results.append({"link_id": link_id, "success": True, "message": "Cleared"})
            continue

        ok_ab, _, errs_ab = tc_manager.apply_direction(
            lc.iface_b, req.a_to_b, dry_run=config.dry_run
        )
        ok_ba, _, errs_ba = tc_manager.apply_direction(
            lc.iface_a, req.b_to_a, dry_run=config.dry_run
        )
        results.append({
            "link_id": link_id,
            "success": ok_ab and ok_ba,
            "errors":  errs_ab + errs_ba,
        })
    return {"profile": profile_name, "results": results}


@app.delete("/profiles/{profile_name}")
async def delete_profile(profile_name: str):
    if not database.delete_profile(profile_name):
        raise HTTPException(404, f"Profile {profile_name!r} not found")
    return {"success": True, "message": f"Profile {profile_name!r} deleted"}


# ── Presets ───────────────────────────────────────────────────────────────────

@app.get("/presets")
async def list_presets():
    return preset_lib.list_presets()


@app.get("/presets/{preset_name}")
async def get_preset(preset_name: str):
    try:
        return preset_lib.get_preset(preset_name)
    except KeyError:
        raise HTTPException(404, f"Preset {preset_name!r} not found")


@app.post("/presets/{preset_name}/apply/{link_id}")
async def apply_preset(preset_name: str, link_id: str):
    lc = _get_link(link_id)
    _assert_not_protected(lc.iface_a)
    _assert_not_protected(lc.iface_b)
    try:
        req = preset_lib.build_impairment_request(preset_name)
    except KeyError:
        raise HTTPException(404, f"Preset {preset_name!r} not found")

    _link_settings[link_id] = req
    ok_ab, cmds_ab, errs_ab = tc_manager.apply_direction(
        lc.iface_b, req.a_to_b, dry_run=config.dry_run
    )
    ok_ba, cmds_ba, errs_ba = tc_manager.apply_direction(
        lc.iface_a, req.b_to_a, dry_run=config.dry_run
    )
    return CommandResult(
        success=ok_ab and ok_ba,
        message=f"Preset '{preset_name}' applied to {link_id}",
        commands=cmds_ab + cmds_ba,
        errors=errs_ab + errs_ba,
    )


# ── Serve React SPA ───────────────────────────────────────────────────────────
STATIC_DIR = Path(__file__).parent.parent / "frontend" / "dist"

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str = ""):
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return JSONResponse({"error": "Frontend not built"}, status_code=503)
else:
    @app.get("/", include_in_schema=False)
    async def no_frontend():
        return JSONResponse({"message": "WANEmulator v2 API.", "docs": "/docs"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=False)
