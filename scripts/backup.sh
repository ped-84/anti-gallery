#!/usr/bin/env bash
# ========================================================
# Anti-Gallery (آرت‌گشت) Automated Nightly Backup Script
# Creates a compressed archive of data/ and maintains 7-day retention.
# ========================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/artgasht}"
DATA_DIR="${DATA_DIR:-${APP_DIR}/data}"
BACKUP_DIR="${DATA_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/artgasht_backup_${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting nightly backup..."

if [ -f "${DATA_DIR}/galleries.json" ]; then
    tar -czf "$BACKUP_FILE" -C "$DATA_DIR" galleries.json uploads/ 2>/dev/null || tar -czf "$BACKUP_FILE" -C "$DATA_DIR" galleries.json
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup saved: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Warning: galleries.json not found in $DATA_DIR"
fi

# 7-day rotation: remove archives older than 7 days
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Pruning backups older than 7 days..."
find "$BACKUP_DIR" -type f -name "artgasht_backup_*.tar.gz" -mtime +7 -exec rm -f {} \;

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup and rotation completed."
