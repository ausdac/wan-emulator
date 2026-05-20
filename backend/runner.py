"""
Safe subprocess wrapper.  All external commands go through here.
Never builds shell strings – always uses argument lists.
"""
import logging
import subprocess
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)


class RunResult:
    def __init__(self, args: List[str], returncode: int, stdout: str, stderr: str):
        self.args = args
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr
        self.success = returncode == 0

    def __repr__(self) -> str:
        return f"RunResult(rc={self.returncode}, cmd={self.args!r})"


def run(
    args: List[str],
    *,
    dry_run: bool = False,
    ignore_errors: bool = False,
    timeout: int = 30,
) -> RunResult:
    """
    Execute a command given as an argument list.

    Args:
        args:          Command + arguments as a list (never a shell string).
        dry_run:       If True, log the command and return a fake success result.
        ignore_errors: If True, do not raise on non-zero exit.
        timeout:       Maximum seconds to wait for the command.

    Returns:
        RunResult with returncode, stdout, stderr.

    Raises:
        RuntimeError if the command fails and ignore_errors is False.
    """
    cmd_str = " ".join(args)
    if dry_run:
        logger.info("[DRY-RUN] %s", cmd_str)
        return RunResult(args, 0, f"[dry-run] {cmd_str}", "")

    logger.debug("RUN: %s", cmd_str)
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        msg = f"Command timed out after {timeout}s: {cmd_str}"
        logger.error(msg)
        if ignore_errors:
            return RunResult(args, -1, "", msg)
        raise RuntimeError(msg)
    except FileNotFoundError as exc:
        msg = f"Executable not found: {args[0]!r}"
        logger.error(msg)
        if ignore_errors:
            return RunResult(args, -1, "", msg)
        raise RuntimeError(msg) from exc

    r = RunResult(args, result.returncode, result.stdout.strip(), result.stderr.strip())

    if r.success:
        logger.debug("OK (rc=0): %s", cmd_str)
    else:
        logger.warning("FAILED (rc=%d): %s — stderr: %s", r.returncode, cmd_str, r.stderr)
        if not ignore_errors:
            raise RuntimeError(f"Command failed (rc={r.returncode}): {cmd_str}\n{r.stderr}")

    return r
