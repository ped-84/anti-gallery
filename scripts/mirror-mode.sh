#!/usr/bin/env bash
# ========================================================
# Anti-Gallery (آرت‌گشت) Mirror Mode Controller
# Controls operational mode of Iran VPS:
#   standalone  - Unlocks local admin panel, stops automated sync timer.
#   mirror      - Restores read-only replica mode, restarts sync timer.
#   merge-back  - Reconciles and merges edits made during shutdown back to primary.
#
# Usage:
#   sudo ./scripts/mirror-mode.sh standalone
#   sudo ./scripts/mirror-mode.sh mirror
#   sudo ./scripts/mirror-mode.sh merge-back
# ========================================================

set -euo pipefail

MODE="${1:-}"
APP_DIR="${APP_DIR:-/opt/artgasht}"
DATA_DIR="${DATA_DIR:-${APP_DIR}/data}"
STANDALONE_FILE="${DATA_DIR}/STANDALONE"
ENV_FILE="${APP_DIR}/.env"

if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE" 2>/dev/null || true
fi

PRIMARY_HOST="${PRIMARY_HOST:-86.54.42.206}"
PRIMARY_USER="${PRIMARY_USER:-deploy}"
PRIMARY_PORT="${PRIMARY_PORT:-22}"
PRIMARY_KEY="${PRIMARY_KEY:-/home/deploy/.ssh/id_rsa}"
PRIMARY_DATA_DIR="${PRIMARY_DATA_DIR:-/opt/artgasht/data}"
SSH_CMD="ssh -p ${PRIMARY_PORT} -i ${PRIMARY_KEY} -o ConnectTimeout=15"

case "$MODE" in
    standalone)
        echo -e "\n\033[1;33m⚠️  [آرت‌گشت] فعال‌سازی حالت اضطراری مستقل (STANDALONE Mode)...\033[0m"
        touch "$STANDALONE_FILE"
        systemctl stop artgasht-sync.timer 2>/dev/null || true
        echo -e "\033[1;32m✅ پرچم STANDALONE ایجاد شد.\033[0m"
        echo -e "  - پنل مدیریت در این سرور هم‌اکنون فعال و در دسترس است (https://artgasht.ir/#admin)."
        echo -e "  - تایمر همگام‌سازی موقتاً متوقف شد تا اطلاعات محلی رونویسی نشوند."
        echo -e "  - پس از اتصال مجدد اینترنت، جهت همگام‌سازی دوطرفه دستور زیر را اجرا کنید:"
        echo -e "    \033[1;36msudo ./scripts/mirror-mode.sh merge-back\033[0m\n"
        ;;

    mirror)
        echo -e "\n\033[1;34m🔄 [آرت‌گشت] بازگشت به حالت آینه (Read-Only Mirror Mode)...\033[0m"
        rm -f "$STANDALONE_FILE"
        systemctl start artgasht-sync.timer 2>/dev/null || true
        echo -e "\033[1;32m✅ پرچم STANDALONE حذف شد.\033[0m"
        echo -e "  - پنل مدیریت مجدداً غیرفعال و سرور به حالت فقط-خواندنی برگشت."
        echo -e "  - تایمر همگام‌سازی با سرور اصلی آلمان فعال گردید.\n"
        ;;

    merge-back)
        echo -e "\n\033[1;36m🔄 [آرت‌گشت] آغاز فرآیند ادغام دوطرفه اطلاعات (Merge-Back to Primary)...\033[0m"
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)

        # 1. Timestamped backup of local side
        echo "💾 [۱/۶] ایجاد نسخه پشتیبان از داده‌های محلی سرور ایران..."
        mkdir -p "${DATA_DIR}/backups"
        tar -czf "${DATA_DIR}/backups/backup_local_${TIMESTAMP}.tar.gz" -C "$DATA_DIR" galleries.json uploads/

        # 2. Timestamped backup on remote primary
        echo "💾 [۲/۶] ایجاد نسخه پشتیبان روی سرور اصلی آلمان..."
        $SSH_CMD "${PRIMARY_USER}@${PRIMARY_HOST}" "mkdir -p ${PRIMARY_DATA_DIR}/backups && tar -czf ${PRIMARY_DATA_DIR}/backups/backup_primary_${TIMESTAMP}.tar.gz -C ${PRIMARY_DATA_DIR} galleries.json uploads/"

        # 3. Pull primary galleries.json
        echo "📥 [۳/۶] دانلود galleries.json از سرور اصلی آلمان..."
        scp -P "${PRIMARY_PORT}" -i "${PRIMARY_KEY}" "${PRIMARY_USER}@${PRIMARY_HOST}:${PRIMARY_DATA_DIR}/galleries.json" "${DATA_DIR}/galleries_primary.json"

        # 4. Execute merger script (ID-based, newest updatedAt wins)
        echo "🔀 [۴/۶] ادغام هوشمند گالری‌ها بر اساس شناسه و تاریخ آخرین ویرایش (updatedAt)..."
        node "${APP_DIR}/scripts/merge-galleries.cjs" "${DATA_DIR}/galleries_primary.json" "${DATA_DIR}/galleries.json" "${DATA_DIR}/galleries_merged.json"

        # 5. Sync uploaded images bidirectionally
        echo "🖼️ [۵/۶] همگام‌سازی دوطرفه پوسترهای جدید آپلود شده..."
        rsync -avz -e "$SSH_CMD" "${DATA_DIR}/uploads/" "${PRIMARY_USER}@${PRIMARY_HOST}:${PRIMARY_DATA_DIR}/uploads/"
        rsync -avz -e "$SSH_CMD" "${PRIMARY_USER}@${PRIMARY_HOST}:${PRIMARY_DATA_DIR}/uploads/" "${DATA_DIR}/uploads/"

        # 6. Apply merged data to both sides
        echo "📤 [۶/۶] استقرار فایل ادغام شده بر روی هر دو سرور..."
        scp -P "${PRIMARY_PORT}" -i "${PRIMARY_KEY}" "${DATA_DIR}/galleries_merged.json" "${PRIMARY_USER}@${PRIMARY_HOST}:${PRIMARY_DATA_DIR}/galleries.json"
        mv "${DATA_DIR}/galleries_merged.json" "${DATA_DIR}/galleries.json"
        rm -f "${DATA_DIR}/galleries_primary.json"

        # 7. Restore Mirror mode
        rm -f "$STANDALONE_FILE"
        systemctl start artgasht-sync.timer 2>/dev/null || true

        echo -e "\n\033[1;32m🎉 ادغام اطلاعات با موفقیت کامل انجام شد!\033[0m"
        echo -e "  - هر دو سرور ایران و آلمان بر روی نسخه یکپارچه به‌روزرسانی شدند."
        echo -e "  - سرور ایران به حالت آینه استاندارد بازگشت و تایمر همگام‌سازی فعال شد.\n"
        ;;

    *)
        echo "راهنمای استفاده:"
        echo "  $0 standalone   # ورود به حالت مستقل اضطراری (فعال‌سازی ادیتور روی ایران)"
        echo "  $0 mirror       # بازگشت به حالت آینه فقط-خواندنی"
        echo "  $0 merge-back   # ادغام تغییرات اعمال شده روی ایران با سرور اصلی آلمان"
        exit 1
        ;;
esac
