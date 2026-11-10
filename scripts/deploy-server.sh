#!/usr/bin/env bash
# ========================================================
# Anti-Gallery (آرت‌گشت) Production Deployment Script (Bash)
# Builds artifact on laptop and transfers self-contained Docker image over SSH.
# Ensures ZERO internet dependency on the remote server (ideal for Iran shutdowns).
#
# Usage:
#   ./scripts/deploy-server.sh [server_user@server_ip] [remote_dir] [ssh_port]
# ========================================================

set -euo pipefail

SERVER_DEST="${1:-}"
REMOTE_DIR="${2:-/opt/artgasht}"
SSH_PORT="${3:-22}"

echo -e "\n\033[1;36m🎨 [آرت‌گشت] آغاز فرآیند آماده‌سازی و استقرار بر روی سرور پروداکشن...\033[0m"

# 1. Typecheck
echo -e "\033[1;33m🔍 [۱/۶] بررسی بدون خطای تایپ‌های TypeScript...\033[0m"
npm.cmd exec tsc -- --noEmit || npx tsc --noEmit

# 2. Local Vite Frontend Build
echo -e "\033[1;33m📦 [۲/۶] بیلد نسخه استاتیک فرانت‌اند با Vite...\033[0m"
npm.cmd run build || npm run build

# 3. Build Docker image locally on laptop
echo -e "\033[1;33m🐳 [۳/۶] ساخت ایمیج داکر به صورت Self-Contained بر روی لپ‌تاپ...\033[0m"
docker build -t artgasht:latest .

if [ -z "$SERVER_DEST" ]; then
    echo -e "\n\033[1;33m⚠️  آدرس سرور مشخص نشده است. برای ذخیره آرشیو آفلاین داکر:\033[0m"
    echo -e "  \033[1;32mdocker save artgasht:latest | gzip > artgasht.tar.gz\033[0m"
    echo -e "\nیا برای استقرار مستقیم:"
    echo -e "  \033[1;32m./scripts/deploy-server.sh root@<SERVER_IP>\033[0m"
    exit 0
fi

echo -e "\033[1;33m🚀 [۴/۶] اتصال به سرور ${SERVER_DEST} و آماده‌سازی پوشه‌ها...\033[0m"
ssh -p "$SSH_PORT" "$SERVER_DEST" "mkdir -p ${REMOTE_DIR}/data/uploads"

echo -e "\033[1;33m📡 [۵/۶] انتقال کانتینر داکر از طریق SSH به سرور (Streaming docker save -> docker load)...\033[0m"
docker save artgasht:latest | gzip | ssh -p "$SSH_PORT" "$SERVER_DEST" "gzip -d | docker load"

echo -e "\033[1;33m📄 کپی فایل‌های docker-compose.yml و Caddyfile...\033[0m"
scp -P "$SSH_PORT" docker-compose.yml "${SERVER_DEST}:${REMOTE_DIR}/docker-compose.yml"
scp -P "$SSH_PORT" Caddyfile "${SERVER_DEST}:${REMOTE_DIR}/Caddyfile"
scp -P "$SSH_PORT" .env.example "${SERVER_DEST}:${REMOTE_DIR}/.env.example"

echo -e "\033[1;33m🔄 [۶/۶] راه‌اندازی مجدد سرویس و تست سلامت...\033[0m"
ssh -p "$SSH_PORT" "$SERVER_DEST" "cd ${REMOTE_DIR} && docker compose up -d --force-recreate"

sleep 3
echo -e "\033[1;33m🩺 وضعیت سلامت (/health):\033[0m"
ssh -p "$SSH_PORT" "$SERVER_DEST" "curl -s http://127.0.0.1:3000/health || true"

echo -e "\n\033[1;32m✅ استقرار با موفقیت پایان یافت!\033[0m\n"
