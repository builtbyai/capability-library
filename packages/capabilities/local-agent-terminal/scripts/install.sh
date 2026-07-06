#!/usr/bin/env bash
# install.sh — install the PTY bridge daemon as a per-user systemd service.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
DAEMON="$REPO/packages/capabilities/local-agent-terminal/dist/backend/pty-bridge-daemon.js"
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"

: "${MMD_CLOUD_WS_BASE:=wss://your-worker.workers.dev}"

cat > "$UNIT_DIR/mmd-pty-bridge.service" <<UNIT
[Unit]
Description=MultimarcDown PTY bridge daemon
After=network-online.target

[Service]
Environment=MMD_CLOUD_WS_BASE=${MMD_CLOUD_WS_BASE}
Environment=MMD_DAEMON_STATUS_PORT=5181
Environment=MMD_AGENT_SECRET_FILE=${REPO}/packages/capabilities/local-agent-terminal/backend/data/agent-secret.txt
ExecStart=$(command -v node) ${DAEMON}
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now mmd-pty-bridge.service
echo "Installed + started mmd-pty-bridge.service"
echo "Put your agent secret in: $REPO/packages/capabilities/local-agent-terminal/backend/data/agent-secret.txt"
echo "Check: curl http://127.0.0.1:5181/status"
