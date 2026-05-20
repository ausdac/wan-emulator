#!/usr/bin/env bash
# WANEmulator install script – Rocky Linux 10
# Run as root: bash install.sh
set -euo pipefail

INSTALL_DIR="/opt/wanemulator"
DATA_DIR="/var/lib/wanemulator"
LOG_FILE="/var/log/wanemulator.log"
SERVICE="wanemulator"

echo "=== WANEmulator Installer ==="

# ── 1. System packages ──────────────────────────────────────────────────────
echo "[1/6] Installing system packages..."
dnf install -y iproute-tc tcpdump python3 python3-pip bridge-utils 2>/dev/null || \
    yum install -y iproute-tc tcpdump python3 python3-pip bridge-utils
python3 -m ensurepip --upgrade 2>/dev/null || true

# ── 2. Python dependencies ──────────────────────────────────────────────────
echo "[2/6] Installing Python packages..."
python3 -m pip install --quiet \
    fastapi \
    "uvicorn[standard]" \
    pydantic \
    pyyaml \
    aiofiles \
    python-multipart

# ── 3. Install project files ────────────────────────────────────────────────
echo "[3/6] Installing project files to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp -r backend config.yaml "$INSTALL_DIR/"
cp -r profiles "$INSTALL_DIR/" 2>/dev/null || true

# Install pre-built React frontend if present
if [ -d "frontend/dist" ]; then
    echo "  → Copying pre-built frontend..."
    cp -r frontend "$INSTALL_DIR/"
else
    echo "  → No pre-built frontend found. Build with: cd frontend && npm install && npm run build"
fi

# ── 4. Data directories ─────────────────────────────────────────────────────
echo "[4/6] Creating data directories..."
mkdir -p "$DATA_DIR/captures"
touch "$LOG_FILE"
chmod 640 "$LOG_FILE"

# ── 5. Firewall ─────────────────────────────────────────────────────────────
echo "[5/6] Opening firewall port 8080..."
firewall-cmd --permanent --add-port=8080/tcp 2>/dev/null && firewall-cmd --reload 2>/dev/null || \
    echo "  (firewall-cmd not available or already open)"

# ── 6. systemd service ──────────────────────────────────────────────────────
echo "[6/6] Installing systemd service..."
cp wanemulator.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"

echo ""
echo "✓ WANEmulator installed and started."
echo ""
echo "  Web UI:    http://$(hostname -I | awk '{print $1}'):8080"
echo "  API docs:  http://$(hostname -I | awk '{print $1}'):8080/docs"
echo "  Config:    $INSTALL_DIR/config.yaml"
echo "  Logs:      journalctl -u $SERVICE -f"
echo "  Captures:  $DATA_DIR/captures/"
echo ""
echo "Edit $INSTALL_DIR/config.yaml to set your actual interface names,"
echo "then restart: systemctl restart $SERVICE"
