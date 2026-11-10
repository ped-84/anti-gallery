#!/usr/bin/env bash
# ========================================================
# Anti-Gallery (آرت‌گشت) Network Reachability Tester
# Tests connectivity to Iranian infrastructure from current server:
#   1. galleryinfo.ir  (Upstream Exhibition Catalog)
#   2. api.neshan.org  (Neshan Vector Tiles API)
#   3. static.neshan.org (Neshan Web SDK CDN)
#
# Usage:
#   ./scripts/test-reachability.sh
# ========================================================

set -u

echo -e "\n\033[1;36m🌐 [آرت‌گشت] تست دسترس‌پذیری زیرساخت‌های کلیدی از سرور فعلی...\033[0m\n"

test_url() {
    local label="$1"
    local url="$2"
    local timeout="${3:-5}"

    printf "%-32s " "$label..."
    
    # Run curl and grab HTTP code + total response time
    output=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" --max-time "$timeout" "$url" 2>/dev/null || echo "000 0")
    http_code=$(echo "$output" | awk '{print $1}')
    resp_time=$(echo "$output" | awk '{print $2}')

    if [[ "$http_code" =~ ^(200|301|302|403|404)$ ]]; then
        # 403 on root is normal for tile servers when no key/route is provided in query
        echo -e "\033[1;32m[OK]\033[0m (HTTP $http_code | ${resp_time}s)"
    else
        echo -e "\033[1;31m[FAIL]\033[0m (Connection error / Timeout >${timeout}s)"
    fi
}

test_url "۱. کاتالوگ رویدادها (galleryinfo.ir)" "https://galleryinfo.ir/Event/fa" 8
test_url "۲. وب‌سرویس نقشه نشان (api.neshan.org)" "https://api.neshan.org" 5
test_url "۳. سی‌دی‌ان نشان (static.neshan.org)" "https://static.neshan.org/sdk/mapboxgl/v1.13.2/neshan-sdk/v1.1.3/index.js" 5

echo -e "\n\033[1;33mنکته:\033[0m در صورت قطع اینترنت بین‌الملل، هر سه سرویس فوق روی سرور ایران (artgasht.ir) باید وضعیت [OK] داشته باشند.\n"
