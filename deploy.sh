#!/usr/bin/env bash
# deploy.sh — push all WANEmulator V2 files to the server and restart the service.
# Run from /tmp/wanemulator on your Mac.
set -euo pipefail

SERVER="root@10.210.130.67"
REMOTE_APP="/opt/wanemulator"
REMOTE_DATA="/var/lib/wanemulator"

echo "==> Checking connectivity..."
ssh -o ConnectTimeout=10 "$SERVER" "echo 'Server reachable'"

# ── 1. Backend files ─────────────────────────────────────────────────────────
echo "==> Uploading backend..."
scp backend/config.py          "$SERVER:$REMOTE_APP/backend/config.py"
scp backend/bridge_manager.py  "$SERVER:$REMOTE_APP/backend/bridge_manager.py"
scp backend/main.py            "$SERVER:$REMOTE_APP/backend/main.py"
scp backend/models.py          "$SERVER:$REMOTE_APP/backend/models.py"
scp backend/tc_manager.py      "$SERVER:$REMOTE_APP/backend/tc_manager.py"
scp backend/presets.py         "$SERVER:$REMOTE_APP/backend/presets.py"
scp backend/stats_collector.py "$SERVER:$REMOTE_APP/backend/stats_collector.py"
scp backend/runner.py          "$SERVER:$REMOTE_APP/backend/runner.py"

# ── 2. Config file ───────────────────────────────────────────────────────────
echo "==> Uploading config.yaml..."
scp config.yaml "$SERVER:$REMOTE_APP/config.yaml"

# ── 3. sysctl (boot-persistent bridge-nf settings) ──────────────────────────
echo "==> Installing sysctl settings..."
scp sysctl/99-wanemulator-bridge.conf \
    "$SERVER:/etc/sysctl.d/99-wanemulator-bridge.conf"
ssh "$SERVER" "sysctl --system 2>&1 | grep -E 'bridge-nf|Applying' || true"

# ── 4. NetworkManager unmanaged config ──────────────────────────────────────
echo "==> Installing NetworkManager unmanaged config..."
ssh "$SERVER" "mkdir -p /etc/NetworkManager/conf.d"
scp networkmanager/wanemulator-unmanaged.conf \
    "$SERVER:/etc/NetworkManager/conf.d/wanemulator-unmanaged.conf"
ssh "$SERVER" "nmcli general reload 2>/dev/null || true"

# ── 5. Build and deploy frontend ─────────────────────────────────────────────
echo "==> Building frontend..."
(cd frontend && npm run build)

echo "==> Uploading frontend..."
ssh "$SERVER" "rm -rf $REMOTE_APP/frontend/dist && mkdir -p $REMOTE_APP/frontend/dist"
scp -r frontend/dist/* "$SERVER:$REMOTE_APP/frontend/dist/"

# ── 6. Ensure data directories exist ────────────────────────────────────────
echo "==> Ensuring data directories..."
ssh "$SERVER" "mkdir -p $REMOTE_DATA/captures && touch $REMOTE_DATA/profiles.db || true"

# ── 7. Restart service ───────────────────────────────────────────────────────
echo "==> Restarting wanemulator service..."
ssh "$SERVER" "systemctl restart wanemulator"
sleep 3
ssh "$SERVER" "systemctl is-active wanemulator && echo 'Service: OK' || echo 'Service: FAILED'"

# ── 8. Smoke test ────────────────────────────────────────────────────────────
echo "==> Smoke test..."
ssh "$SERVER" "curl -s http://localhost:8080/health | python3 -m json.tool"

echo ""
echo "==> Deploy complete. Open http://10.210.130.67:8080"
