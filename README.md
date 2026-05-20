# WANEmulator

A Linux-based WAN impairment emulator built to replace hardware appliances like the PacketStorm 400E. Runs on any Linux server with multiple NICs and provides a web UI for controlling per-direction traffic shaping on fixed inline bridge pairs.

![Platform](https://img.shields.io/badge/platform-Linux-lightgrey)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## What it does

WANEmulator sits inline between two network segments. Traffic passes through Linux bridges; `tc/netem` applies impairments to each direction independently. The web UI lets you dial in realistic WAN conditions without touching the command line.

**Impairments supported:**
- Delay & jitter (with optional correlation)
- Packet loss — simple random or Gilbert-Elliott burst model
- Duplication, reordering, corruption (bit errors)
- Bandwidth throttling
- All of the above with optional per-flow traffic filters (IP, port, protocol, DSCP, VLAN, MPLS)

**Built-in presets:** 3G, 4G/LTE, 5G, Satellite (GEO & LEO), DSL, Cable, Fiber, Lossy Wi-Fi, Congested WAN, QoS Stress
<img width="638" height="842" alt="Screenshot 2026-05-20 at 10 26 58 AM" src="https://github.com/user-attachments/assets/359edb1a-6bcf-4d3f-96d0-61c9e20ce7ec" />

---

## Architecture

```
[ Device A ] ──── ens1f0 ┐
                          ├── br1 (Linux bridge) ── tc/netem shaping
[ Device B ] ──── ens1f1 ┘

FastAPI backend  →  /opt/wanemulator/backend/
React frontend   →  /opt/wanemulator/frontend/
Served on        →  http://<host>:8080
```

**Direction convention:**
- A→B traffic exits on `iface_b` → shape `iface_b` egress
- B→A traffic exits on `iface_a` → shape `iface_a` egress

---

## Requirements

- Linux with kernel 4.x+ (tested on Rocky Linux 10 / kernel 6.x)
- Python 3.10+
- Node.js 18+ (build only — not needed on server)
- `iproute2` / `tc` installed
- Root or `CAP_NET_ADMIN` capability

---

## Installation

### 1. Clone and install backend

```bash
git clone https://github.com/ausdac/wan-emulator.git
cd wan-emulator

python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. Build the frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. Configure

Edit `config.yaml`:

```yaml
protected_interfaces:
  - eno8303          # Management / SSH interface — NEVER touch this

links:
  link1:
    name: "Link 1"
    physical_label: "Ports 1-2"
    iface_a: "ens1f0"
    iface_b: "ens1f1"
    bridge: "br1"
    description: "1 GbE inline pair"
  link2:
    name: "Link 2"
    physical_label: "Ports 3-4"
    iface_a: "ens2f0"
    iface_b: "ens2f1"
    bridge: "br2"
    description: "Second inline pair"

auto_setup_bridges: true
profiles_db: "/var/lib/wanemulator/profiles.db"
dry_run: false
```

> **Important:** List every management/SSH interface under `protected_interfaces`. WANEmulator enforces this at startup and at every API call — a protected interface can never be added to a bridge or have impairments applied.

### 4. systemd service

```bash
cp wanemulator.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now wanemulator
```

### 5. Sysctl — prevent iptables from seeing bridged frames

```bash
cp sysctl/99-wanemulator-bridge.conf /etc/sysctl.d/
sysctl --system
```

### 6. NetworkManager — prevent NM from resetting bridge members on boot

```bash
cp networkmanager/wanemulator-unmanaged.conf /etc/NetworkManager/conf.d/
nmcli general reload
```

---

## Usage

Open `http://<server-ip>:8080` in a browser.

Each link card shows:

| Element | Description |
|---------|-------------|
| **Physical label** | Matches the port silkscreen on the chassis |
| **Notes / Label** | Free-form text field (ticket numbers, circuit IDs, etc.) — autosaves |
| **Bridge status** | Green = inline path is live |
| **Impairment table** | A→B and B→A configured independently |
| **Correlation** | Appears under each parameter when its value is non-zero |
| **Burst Loss** | Gilbert-Elliott GE model for bursty loss patterns |
| **Traffic Filter** | Optional tc flower classifier to target a specific flow |
| **Preset selector** | One-click WAN profile with preview-before-apply |
| **Live stats** | Real-time packet/byte/drop counters with sparklines |

---

## API

Full interactive docs available at `http://<server>:8080/docs`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service status |
| GET | `/links` | All link states |
| POST | `/links/{id}/impairment` | Apply impairments |
| POST | `/links/{id}/reset` | Clear impairments (bridge stays up) |
| POST | `/links/{id}/setup` | Restore bridge if down |
| PUT | `/links/{id}/label` | Save notes/label |
| GET | `/links/{id}/stats/live` | Live tc counters |
| GET | `/presets` | List built-in presets |
| POST | `/presets/{name}/apply/{link_id}` | Apply preset |
| GET/POST/DELETE | `/profiles` | Saved impairment profiles |

---

## Safety design

- `protected_interfaces` in `config.yaml` are enforced at four independent layers: config load, bridge manager, API guard, and the `/interfaces` endpoint
- Bridges are **never torn down** by normal operations — "Clear Impairments" only removes tc qdiscs; the inline forwarding path stays live
- `dry_run: true` in config prints all `tc`/`ip` commands without executing them

---

## Project structure

```
├── backend/
│   ├── main.py             FastAPI app, endpoints, lifespan
│   ├── models.py           Pydantic request/response models
│   ├── tc_manager.py       tc/netem command builder
│   ├── bridge_manager.py   Linux bridge lifecycle
│   ├── config.py           Config loader
│   ├── database.py         SQLite profile + label storage
│   ├── presets.py          Built-in WAN presets
│   ├── stats_collector.py  tc stats parser / ring buffer
│   ├── runner.py           Subprocess wrapper
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       └── components/
│           ├── LinkCard.jsx
│           ├── FilterConfig.jsx
│           ├── PresetSelector.jsx
│           └── StatsPanel.jsx
├── config.yaml
├── wanemulator.service
├── sysctl/99-wanemulator-bridge.conf
└── networkmanager/wanemulator-unmanaged.conf
```

---

## Logs

```bash
journalctl -u wanemulator -f
tail -f /var/log/wanemulator.log
```

---

## License

MIT
