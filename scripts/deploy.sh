#!/usr/bin/env bash
# ========================================================
# Anti-Gallery (آرت‌گشت) Multi-Target Deployment Script (Bash)
# Builds Docker image ONCE locally and streams it over SSH.
# Targets configured in deploy.config:
#   - primary (Germany VPS - artgasht.com)
#   - mirror  (Iran VPS    - artgasht.ir)
#   - all     (Both servers sequentially)
#
# Usage:
#   ./scripts/deploy.sh [primary|mirror|all]
# ========================================================

set -euo pipefail

TARGET="${1:-all}"
CONFIG_FILE="${2:-deploy.config}"

echo -e "\n\033[1;36m🎨 [آرت‌گشت] آغاز فرآیند استقرار پروداکشن (Target: ${TARGET})...\033[0m"

if [ ! -f "$CONFIG_FILE" ]; then
    if [ -f "deploy.config.example" ]; then
        echo -e "\033[1;33m⚠️  فایل ${CONFIG_FILE} یافت نشد. لطفاً ابتدا deploy.config.example را کپی نمایید:\033[0m"
        echo "  cp deploy.config.example deploy.config"
    fi
    exit 1
fi

# 1. Typecheck
echo -e "\033[1;33m🔍 [۱/۴] اعتبارسنجی تایپ‌اسکریپت...\033[0m"
npm.cmd exec tsc -- --noEmit || npx tsc --noEmit

# 2. Vite Build
echo -e "\033[1;33m📦 [۲/۴] بیلد فرانت‌اند...\033[0m"
npm.cmd run build || npm run build

# 3. Docker Build Once on Laptop
echo -e "\033[1;33m🐳 [۳/۴] ساخت ایمیج داکر روی سیستم محلی...\033[0m"
docker build -t artgasht:latest .

deploy_to_server() {
    local target_key="$1"
    local cfg_host cfg_user cfg_port cfg_dir cfg_key
    
    cfg_host=$(node -e "const c=require('./$CONFIG_FILE'); console.log(c['$target_key']?.host||'')")
    cfg_user=$(node -e "const c=require('./$CONFIG_FILE'); console.log(c['$target_key']?.user||'root')")
    cfg_port=$(node -e "const c=require('./$CONFIG_FILE'); console.log(c['$target_key']?.port||22)")
    cfg_dir=$(node -e "const c=require('./$CONFIG_FILE'); console.log(c['$target_key']?.remoteDir||'/opt/artgasht')")
    cfg_key=$(node -e "const c=require('./$CONFIG_FILE'); console.log(c['$target_key']?.key||'')")

    if [ -z "$cfg_host" ] || [[ "$cfg_host" == *"YOUR_"* ]]; then
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

    echo "  -> استریم ایمیج داکر..."
    docker save artgasht:latest | gzip | ssh -p "$cfg_port" $key_arg "$dest" "gzip -d | docker load"

    echo "  -> کپی فایل‌های پیکربندی..."
    scp -P "$cfg_port" $key_arg docker-compose.yml "${dest}:${cfg_dir}/docker-compose.yml"
    scp -P "$cfg_port" $key_arg Caddyfile "${dest}:${cfg_dir}/Caddyfile"
    scp -P "$cfg_port" $key_arg scripts/sync-pull.sh "${dest}:${cfg_dir}/scripts/sync-pull.sh"
    scp -P "$cfg_port" $key_arg scripts/mirror-mode.sh "${dest}:${cfg_dir}/scripts/mirror-mode.sh"
    scp -P "$cfg_port" $key_arg scripts/merge-galleries.cjs "${dest}:${cfg_dir}/scripts/merge-galleries.cjs"
    scp -P "$cfg_port" $key_arg scripts/test-reachability.sh "${dest}:${cfg_dir}/scripts/test-reachability.sh"
    scp -P "$cfg_port" $key_arg scripts/backup.sh "${dest}:${cfg_dir}/scripts/backup.sh"

    ssh -p "$cfg_port" $key_arg "$dest" "chmod +x ${cfg_dir}/scripts/*.sh ${cfg_dir}/scripts/*.cjs 2>/dev/null || true"

    echo "  -> راه‌اندازی مجدد کانتینر در سرور..."
    ssh -p "$cfg_port" $key_arg "$dest" "cd ${cfg_dir} && docker compose up -d --force-recreate"

    sleep 3
    echo -e "  \033[1;33m🩺 تست سلامت (/health):\033[0m"
    ssh -p "$cfg_port" $key_arg "$dest" "curl -s http://127.0.0.1:3000/health || true"
}

# 4. Deploy targets
if [ "$TARGET" = "primary" ] || [ "$TARGET" = "all" ]; then
    deploy_to_server "primary"
fi

if [ "$TARGET" = "mirror" ] || [ "$TARGET" = "all" ]; then
    deploy_to_server "mirror"
fi

echo -e "\n\033[1;32m✅ استقرار پایان یافت!\033[0m\n"
