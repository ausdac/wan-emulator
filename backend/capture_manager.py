"""
tcpdump capture management.

Captures are started as background processes with their PID tracked in memory.
Each link gets one capture at a time.  Files are stored under captures_dir.
"""
import logging
import os
import signal
import subprocess
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# link_id -> subprocess.Popen
_active_captures: Dict[str, subprocess.Popen] = {}
# link_id -> capture file path
_capture_files: Dict[str, str] = {}


def start_capture(
    link_id: str,
    iface: str,
    captures_dir: str,
    dry_run: bool = False,
) -> Tuple[bool, str, str]:
    """
    Start tcpdump on *iface* and write to a timestamped .pcap file.

    Returns (success, message, filepath).
    """
    if link_id in _active_captures:
        proc = _active_captures[link_id]
        if proc.poll() is None:
            return False, f"Capture already running for {link_id} (pid {proc.pid})", _capture_files.get(link_id, "")

    Path(captures_dir).mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{link_id}_{ts}.pcap"
    filepath = str(Path(captures_dir) / filename)

    args = ["tcpdump", "-i", iface, "-w", filepath, "-U", "--immediate-mode"]

    if dry_run:
        logger.info("[DRY-RUN] %s", " ".join(args))
        return True, f"[dry-run] Would start: {' '.join(args)}", filepath

    try:
        proc = subprocess.Popen(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
    except FileNotFoundError:
        return False, "tcpdump not found – install tcpdump", ""
    except Exception as exc:
        return False, f"Failed to start tcpdump: {exc}", ""

    _active_captures[link_id] = proc
    _capture_files[link_id] = filepath
    logger.info("Capture started for %s: pid=%d file=%s", link_id, proc.pid, filepath)
    return True, f"Capture started (pid {proc.pid}): {filepath}", filepath


def stop_capture(link_id: str) -> Tuple[bool, str]:
    """
    Stop an active tcpdump capture.

    Returns (success, message).
    """
    proc = _active_captures.get(link_id)
    if proc is None:
        return False, f"No capture running for {link_id}"

    if proc.poll() is not None:
        _active_captures.pop(link_id, None)
        return True, f"Capture for {link_id} had already exited"

    try:
        proc.send_signal(signal.SIGTERM)
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
    except Exception as exc:
        return False, f"Error stopping capture: {exc}"

    filepath = _capture_files.pop(link_id, "")
    _active_captures.pop(link_id, None)
    logger.info("Capture stopped for %s: %s", link_id, filepath)
    return True, f"Capture stopped: {filepath}"


def is_capture_active(link_id: str) -> bool:
    proc = _active_captures.get(link_id)
    return proc is not None and proc.poll() is None


def get_capture_file(link_id: str) -> Optional[str]:
    return _capture_files.get(link_id)


def stop_all_captures() -> None:
    for link_id in list(_active_captures.keys()):
        stop_capture(link_id)
