#!/usr/bin/env bash
# ========================================================
# Anti-Gallery (آرت‌گشت) Data Synchronization Script (Bash)
# Syncs galleries JSON database and uploaded poster images
# between Iran VPS, Germany VPS, and local laptop.
#
# Usage:
#   ./scripts/sync-data.sh pull user@server_ip /opt/artgasht
#   ./scripts/sync-data.sh push user@server_ip /opt/artgasht
# ========================================================

set -euo pipefail

ACTION="${1:-}"
REMOTE_DEST="${2:-}"
REMOTE_DIR="${3:-/opt/artgasht}"
LOCAL_DATA_DIR="${4:-./data}"

if [ -z "$ACTION" ] || [ -z "$REMOTE_DEST" ]; then
    echo "راهنمای استفاده:"
    echo "  $0 pull user@host /opt/artgasht"
    echo "  $0 push user@host /opt/artgasht"
    exit 1
fi

mkdir -p "${LOCAL_DATA_DIR}/uploads"

if [ "$ACTION" = "pull" ]; then
    echo -e "\033[1;36m📥 دانلود داده‌ها و تصاویر از سرور ${REMOTE_DEST}...\033[0m"
    scp "${REMOTE_DEST}:${REMOTE_DIR}/data/galleries.json" "${LOCAL_DATA_DIR}/galleries.json"
    scp "${REMOTE_DEST}:${REMOTE_DIR}/data/exhibitions_fa.json" "${LOCAL_DATA_DIR}/exhibitions_fa.json" 2>/dev/null || true
    rsync -avz -e ssh "${REMOTE_DEST}:${REMOTE_DIR}/data/uploads/" "${LOCAL_DATA_DIR}/uploads/" || scp -r "${REMOTE_DEST}:${REMOTE_DIR}/data/uploads/*" "${LOCAL_DATA_DIR}/uploads/"
    echo -e "\033[1;32m✅ دانلود داده‌ها با موفقیت پایان یافت.\033[0m"

elif [ "$ACTION" = "push" ]; then
    echo -e "\033[1;36m📤 ارسال داده‌ها و تصاویر به سرور ${REMOTE_DEST}...\033[0m"
    ssh "$REMOTE_DEST" "mkdir -p ${REMOTE_DIR}/data/uploads"
    if [ -f "${LOCAL_DATA_DIR}/galleries.json" ]; then
        scp "${LOCAL_DATA_DIR}/galleries.json" "${REMOTE_DEST}:${REMOTE_DIR}/data/galleries.json"
    fi
    if [ -f "${LOCAL_DATA_DIR}/exhibitions_fa.json" ]; then
        scp "${LOCAL_DATA_DIR}/exhibitions_fa.json" "${REMOTE_DEST}:${REMOTE_DIR}/data/exhibitions_fa.json"
    fi
    if [ -d "${LOCAL_DATA_DIR}/uploads" ]; then
        rsync -avz -e ssh "${LOCAL_DATA_DIR}/uploads/" "${REMOTE_DEST}:${REMOTE_DIR}/data/uploads/" || scp -r "${LOCAL_DATA_DIR}/uploads/"* "${REMOTE_DEST}:${REMOTE_DIR}/data/uploads/"
    fi
    echo -e "\033[1;32m✅ ارسال داده‌ها با موفقیت پایان یافت.\033[0m"
fi
