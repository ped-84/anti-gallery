#!/usr/bin/env bash
# ========================================================
# Anti-Gallery (آرت‌گشت) Multi-Target Deployment Script (Bash)
# Robust file-based transfer using 'docker save -o' + scp + 'docker load -i'
#
# Usage:
#   ./scripts/deploy.sh [primary|mirror|all]
# ========================================================

set -euo pipefail

TARGET="${1:-primary}"
CONFIG_FILE="${2:-deploy.config}"
TAR_FILE="artgasht_temp.tar"

echo -e "\n\033[1;36m🎨 [آرت‌گشت] آغاز فرآیند استقرار پروداکشن (Target: ${TARGET})...\033[0m"

if [ ! -f "$CONFIG_FILE" ]; then
    if [ -f "deploy.config.example" ]; then
        echo -e "\033[1;33m⚠️  فایل ${CONFIG_FILE} یافت نشد. کپی از deploy.config.example...\033[0m"
        cp deploy.config.example "$CONFIG_FILE"
    else
        echo -e "\033[1;31m❌ فایل پیکربندی ${CONFIG_FILE} یافت نشد!\033[0m"
        exit 1
    fi
fi

# 1. Typecheck
echo -e "\033[1;33m🔍 [۱/۵] اعتبارسنجی تایپ‌اسکریپت...\033[0m"
npm.cmd exec tsc -- --noEmit || npx tsc --noEmit

# 2. Vite Build
echo -e "\033[1;33m📦 [۲/۵] بیلد دارایی‌های فرانت‌اند با Vite...\033[0m"
npm.cmd run build || npm run build

# 3. Docker Build Once on Laptop
echo -e "\033[1;33m🐳 [۳/۵] ساخت ایمیج مستقل داکر روی سیستم محلی...\033[0m"
docker build -t artgasht:latest .

# 4. Save Docker Image to Local Disk
echo -e "\033[1;33m💾 [۴/۵] خروجی فایل ایمیج داکر در دیسک محلی (${TAR_FILE})...\033[0m"
docker save -o "$TAR_FILE" artgasht:latest

cleanup() {
    rm -f "$TAR_FILE"
}
trap cleanup EXIT

deploy_to_server() {
    local target_key="$1"
    local cfg_host cfg_user cfg_port cfg_dir cfg_key
    
    cfg_host=$(node -e "const c=require('./$CONFIG_FILE'); console.log(c['$target_key']?.host||'')")
    cfg_user=$(node -e "const c=require('./$CONFIG_FILE'); console.log(c['$target_key']?.user||'deploy')")
    cfg_port=$(node -e "const c=require('./$CONFIG_FILE'); console.log(c['$target_key']?.port||22)")
    cfg_dir=$(node -e "const c=require('./$CONFIG_FILE'); console.log(c['$target_key']?.remoteDir||'/opt/artgasht')")
    cfg_key=$(node -e "const c=require('./$CONFIG_FILE'); console.log(c['$target_key']?.key||'')")

    if [ -z "$cfg_host" ]; then
        echo -e "\033[1;33m⚠️  آدرس سرور برای $target_key تنظیم نشده است. رد شد.\033[0m"
        return
    fi

    local dest="${cfg_user}@${cfg_host}"
    local key_arg=""
    if [ -n "$cfg_key" ] && [ -f "$cfg_key" ]; then
        key_arg="-i $cfg_key"
    fi

    echo -e "\n\033[1;36m📡 انتقال به سرور ${target_key} (${dest})...\033[0m"

    ssh -p "$cfg_port" $key_arg "$dest" "mkdir -p ${cfg_dir}/data/uploads ${cfg_dir}/scripts"

    echo "  -> آپلود فایل ایمیج داکر (SCP)..."
    scp -P "$cfg_port" $key_arg "$TAR_FILE" "${dest}:${cfg_dir}/${TAR_FILE}"

    echo "  -> بارگذاری ایمیج درون داکر سرور..."
    ssh -p "$cfg_port" $key_arg "$dest" "docker load -i ${cfg_dir}/${TAR_FILE} && rm -f ${cfg_dir}/${TAR_FILE}"

    echo "  -> همگام‌سازی فایل‌های پیکربندی..."
    scp -P "$cfg_port" $key_arg docker-compose.yml "${dest}:${cfg_dir}/docker-compose.yml"
    scp -P "$cfg_port" $key_arg Caddyfile "${dest}:${cfg_dir}/Caddyfile"
    scp -r -P "$cfg_port" $key_arg scripts/* "${dest}:${cfg_dir}/scripts/"

    ssh -p "$cfg_port" $key_arg "$dest" "chmod +x ${cfg_dir}/scripts/*.sh ${cfg_dir}/scripts/*.cjs 2>/dev/null || true"
    ssh -p "$cfg_port" $key_arg "$dest" "if [ ! -f ${cfg_dir}/.env ]; then cp ${cfg_dir}/.env.example ${cfg_dir}/.env; fi"
    ssh -p "$cfg_port" $key_arg "$dest" "sudo cp ${cfg_dir}/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy 2>/dev/null || true"

    echo "  -> راه‌اندازی کانتینر در سرور..."
    ssh -p "$cfg_port" $key_arg "$dest" "cd ${cfg_dir} && docker compose up -d --force-recreate"

    sleep 3
    echo -e "  \033[1;33m🩺 تست سلامت (/health):\033[0m"
    ssh -p "$cfg_port" $key_arg "$dest" "curl -fsS http://127.0.0.1:3000/health || true"
}

# 5. Deploy targets
echo -e "\033[1;33m🚀 [۵/۵] ارسال و بارگذاری بر روی سرورهای مقصد...\033[0m"
if [ "$TARGET" = "primary" ] || [ "$TARGET" = "all" ]; then
    deploy_to_server "primary"
fi

if [ "$TARGET" = "mirror" ] || [ "$TARGET" = "all" ]; then
    deploy_to_server "mirror"
fi

echo -e "\n\033[1;32m✅ استقرار با موفقیت پایان یافت!\033[0m\n"
