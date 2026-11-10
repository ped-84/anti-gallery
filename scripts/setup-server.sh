#!/usr/bin/env bash
# ========================================================
# Anti-Gallery (آرت‌گشت) One-Time Server Bootstrap Script
# Target OS: Ubuntu 24.04 LTS (Frankfurt VPS / Tehran VPS)
# Run as: "deploy" user with sudo privileges:
#   sudo bash scripts/setup-server.sh
# ========================================================

set -euo pipefail

ACTUAL_USER="${SUDO_USER:-$(whoami)}"
APP_DIR="/opt/artgasht"
DATA_DIR="${APP_DIR}/data"
UPLOADS_DIR="${DATA_DIR}/uploads"
BACKUP_DIR="${DATA_DIR}/backups"
SCRIPTS_DIR="${APP_DIR}/scripts"

echo -e "\n\033[1;36m========================================================\033[0m"
echo -e "\033[1;36m🚀 [آرت‌گشت] آغاز آماده‌سازی سرور اوبونتو ۲۴.۰۴ (User: ${ACTUAL_USER})\033[0m"
echo -e "\033[1;36m========================================================\033[0m\n"

# Verify root/sudo
if [ "$(id -u)" -ne 0 ]; then
    echo -e "\033[1;31m❌ این اسکریپت نیاز به دسترسی sudo دارد. لطفاً با sudo اجرا کنید:\033[0m"
    echo "  sudo bash $0"
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive

# 1. Update APT and install base utilities
echo -e "\033[1;33m[۱/۶] به‌روزرسانی مخازن و نصب پیش‌نیازهای سیستمی...\033[0m"
apt-get update -qq
apt-get install -y -qq apt-transport-https ca-certificates curl gnupg rsync tar gzip ufw

# 2. Install Docker CE + Docker Compose Plugin (Idempotent)
echo -e "\033[1;33m[۲/۶] بررسی و نصب Docker CE و افزونه Compose...\033[0m"
if ! command -v docker &> /dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    if [ ! -f /etc/apt/keyrings/docker.asc ]; then
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc
    fi

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    echo -e "\033[1;32m  -> داکر با موفقیت نصب شد.\033[0m"
else
    echo -e "\033[1;32m  -> داکر قبلاً نصب شده است. ($(docker --version))\033[0m"
fi

# Add deploy user to docker group
if id "$ACTUAL_USER" &>/dev/null; then
    usermod -aG docker "$ACTUAL_USER"
    echo -e "\033[1;32m  -> کاربر ${ACTUAL_USER} به گروه docker اضافه شد.\033[0m"
fi

# 3. Install Caddy Web Server (Idempotent)
echo -e "\033[1;33m[۳/۶] بررسی و نصب وب‌سرور Caddy...\033[0m"
if ! command -v caddy &> /dev/null; then
    curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
    curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq caddy
    systemctl enable --now caddy
    echo -e "\033[1;32m  -> سرور Caddy با موفقیت نصب شد.\033[0m"
else
    echo -e "\033[1;32m  -> سرور Caddy قبلاً نصب شده است. ($(caddy version))\033[0m"
fi

# 4. Install Node.js LTS (Idempotent, needed for merge scripts and maintenance)
echo -e "\033[1;33m[۴/۶] بررسی و نصب Node.js...\033[0m"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs
    echo -e "\033[1;32m  -> پکیج Node.js با موفقیت نصب شد. ($(node --version))\033[0m"
else
    echo -e "\033[1;32m  -> پکیج Node.js قبلاً نصب شده است. ($(node --version))\033[0m"
fi

# 5. Create Directory Structure and Set Ownership (deploy:deploy 1000:1000)
echo -e "\033[1;33m[۵/۶] ساخت ساختار پوشه‌ها در ${APP_DIR}...\033[0m"
mkdir -p "$DATA_DIR" "$UPLOADS_DIR" "$BACKUP_DIR" "$SCRIPTS_DIR"

# Copy operational scripts if running from project directory
SCRIPT_SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$SCRIPT_SRC_DIR" ] && [ "$SCRIPT_SRC_DIR" != "$SCRIPTS_DIR" ]; then
    cp -r "$SCRIPT_SRC_DIR/"* "$SCRIPTS_DIR/" 2>/dev/null || true
fi

# Copy Caddyfile if present in parent directory
if [ -f "${SCRIPT_SRC_DIR}/../Caddyfile" ]; then
    cp "${SCRIPT_SRC_DIR}/../Caddyfile" /etc/caddy/Caddyfile
    cp "${SCRIPT_SRC_DIR}/../Caddyfile" "${APP_DIR}/Caddyfile"
    systemctl reload caddy 2>/dev/null || true
fi

# Grant complete non-root ownership to deploy user
chown -R "${ACTUAL_USER}:${ACTUAL_USER}" "$APP_DIR"
chmod 755 "$APP_DIR"
chmod 775 "$DATA_DIR" "$UPLOADS_DIR"
chmod +x "$SCRIPTS_DIR"/*.sh "$SCRIPTS_DIR"/*.cjs 2>/dev/null || true

# 6. Setup Systemd Timers (Backup on both, Sync only on Mirror)
echo -e "\033[1;33m[۶/۶] پیکربندی تایمرهای خودکار systemd...\033[0m"

# Install backup timer on ALL servers
if [ -f "${SCRIPTS_DIR}/artgasht-backup.service" ] && [ -f "${SCRIPTS_DIR}/artgasht-backup.timer" ]; then
    cp "${SCRIPTS_DIR}/artgasht-backup.service" /etc/systemd/system/
    cp "${SCRIPTS_DIR}/artgasht-backup.timer" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable --now artgasht-backup.timer
    echo -e "\033[1;32m  -> تایمر پشتیبان‌گیری شبانه (artgasht-backup.timer) فعال شد.\033[0m"
fi

# Read SERVER_ROLE from .env if it exists
SERVER_ROLE="primary"
if [ -f "${APP_DIR}/.env" ]; then
    ROLE_FROM_ENV=$(grep "^SERVER_ROLE=" "${APP_DIR}/.env" | cut -d'=' -f2 | tr -d ' "\r' || true)
    if [ -n "$ROLE_FROM_ENV" ]; then
        SERVER_ROLE="$ROLE_FROM_ENV"
    fi
fi

if [ "$SERVER_ROLE" = "mirror" ]; then
    if [ -f "${SCRIPTS_DIR}/artgasht-sync.service" ] && [ -f "${SCRIPTS_DIR}/artgasht-sync.timer" ]; then
        cp "${SCRIPTS_DIR}/artgasht-sync.service" /etc/systemd/system/
        cp "${SCRIPTS_DIR}/artgasht-sync.timer" /etc/systemd/system/
        systemctl daemon-reload
        systemctl enable --now artgasht-sync.timer
        echo -e "\033[1;32m  -> تایمر همگام‌سازی آینه (artgasht-sync.timer) فعال شد.\033[0m"
    fi
else
    # Primary: Ensure sync timer is disabled
    systemctl stop artgasht-sync.timer 2>/dev/null || true
    systemctl disable artgasht-sync.timer 2>/dev/null || true
    echo -e "\033[1;34m  -> سرور با نقش PRIMARY پیکربندی شد (تایمر همگام‌سازی غیرفعال ماند).\033[0m"
fi

# Ensure UFW allows essential ports
if ufw status | grep -q "Status: active"; then
    ufw allow 22/tcp >/dev/null 2>&1 || true
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    echo -e "\033[1;32m  -> پورت‌های فایروال UFW (22, 80, 443) تایید شدند.\033[0m"
fi

echo -e "\n\033[1;32m========================================================\033[0m"
echo -e "\033[1;32m✅ راه‌اندازی سرور با موفقیت پایان یافت!\033[0m"
echo -e "  - مسیر برنامه: ${APP_DIR}"
echo -e "  - کاربر مالک: ${ACTUAL_USER}:${ACTUAL_USER} (UID: 1000)"
echo -e "  - وضعیت داکر: $(docker --version 2>/dev/null || echo 'نیاز به رفرش سشن')"
echo -e "  - وضعیت Caddy: فعال و در حال اجرا"
echo -e "  - اکنون سرور کاملاً آماده دریافت دستور دیپلوی از لپ‌تاپ است:"
echo -e "    .\scripts\deploy.ps1 -Target primary"
echo -e "\033[1;32m========================================================\033[0m\n"
