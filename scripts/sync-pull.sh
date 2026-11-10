#!/usr/bin/env bash
# ========================================================
# Anti-Gallery (آرت‌گشت) Sync Pull Script
# Runs on MIRROR (Iran VPS - artgasht.ir) via systemd timer every 5 minutes.
# Syncs galleries.json and uploaded posters from PRIMARY (Germany VPS - artgasht.com).
# ========================================================

set -uo pipefail

APP_DIR="${APP_DIR:-/opt/artgasht}"
DATA_DIR="${DATA_DIR:-${APP_DIR}/data}"
LOG_FILE="${LOG_FILE:-/var/log/artgasht-sync.log}"
ENV_FILE="${APP_DIR}/.env"

# Load environment configuration if available
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE" 2>/dev/null || true
fi

PRIMARY_HOST="${PRIMARY_HOST:-artgasht.com}"
PRIMARY_USER="${PRIMARY_USER:-root}"
PRIMARY_PORT="${PRIMARY_PORT:-22}"
PRIMARY_KEY="${PRIMARY_KEY:-/root/.ssh/id_rsa}"
PRIMARY_DATA_DIR="${PRIMARY_DATA_DIR:-/opt/artgasht/data}"

mkdir -p "$DATA_DIR/uploads"
touch "$LOG_FILE" 2>/dev/null || LOG_FILE="${DATA_DIR}/sync.log"

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" >> "$LOG_FILE"
}

# 1. Check if STANDALONE flag exists (Mirror operating autonomously during shutdown)
if [ -f "${DATA_DIR}/STANDALONE" ]; then
    log "STANDALONE mode active. Skipping sync-pull to preserve local edits."
    exit 0
fi

# 2. Sync from Primary via rsync over SSH (fail silently/log-only on network drop)
SSH_CMD="ssh -p ${PRIMARY_PORT} -i ${PRIMARY_KEY} -o ConnectTimeout=10 -o StrictHostKeyChecking=no"

# Pull galleries.json to temporary file first
if rsync -avz --timeout=15 -e "$SSH_CMD" "${PRIMARY_USER}@${PRIMARY_HOST}:${PRIMARY_DATA_DIR}/galleries.json" "${DATA_DIR}/galleries.json.tmp" >/dev/null 2>&1; then
    # Validate JSON integrity before overwriting
    if node -e "JSON.parse(require('fs').readFileSync('${DATA_DIR}/galleries.json.tmp'))" >/dev/null 2>&1; then
        mv "${DATA_DIR}/galleries.json.tmp" "${DATA_DIR}/galleries.json"
    else
        log "Warning: Downloaded galleries.json is corrupted. Discarding."
        rm -f "${DATA_DIR}/galleries.json.tmp"
        exit 0
    fi

    # Sync uploaded poster images
    rsync -avz --timeout=30 -e "$SSH_CMD" "${PRIMARY_USER}@${PRIMARY_HOST}:${PRIMARY_DATA_DIR}/uploads/" "${DATA_DIR}/uploads/" >/dev/null 2>&1 || true

    # Record timestamp of last successful sync
    date -u +"%Y-%m-%dT%H:%M:%SZ" > "${DATA_DIR}/last-sync.txt"
    log "Sync successful from primary (${PRIMARY_HOST})."
else
    # Fails silently without crashing or overwriting local data
    rm -f "${DATA_DIR}/galleries.json.tmp"
    log "Notice: Primary unreachable (${PRIMARY_HOST}). Keeping existing local data intact."
    exit 0
fi
