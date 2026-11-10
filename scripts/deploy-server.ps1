# ========================================================
# Anti-Gallery (آرت‌گشت) Production Deployment Script (PowerShell)
# Builds artifact on laptop and transfers self-contained Docker image over SSH.
# Ensures ZERO internet dependency on the remote server (ideal for Iran shutdowns).
#
# Usage:
#   .\scripts\deploy-server.ps1 -ServerUser root -ServerHost 185.x.x.x -RemoteDir /opt/artgasht
# ========================================================

param (
    [Parameter(Mandatory=$false)]
    [string]$ServerHost = "",

    [Parameter(Mandatory=$false)]
    [string]$ServerUser = "root",

    [Parameter(Mandatory=$false)]
    [int]$ServerPort = 22,

    [Parameter(Mandatory=$false)]
    [string]$RemoteDir = "/opt/artgasht",

    [Parameter(Mandatory=$false)]
    [string]$Target = "iran" # "iran" or "germany"
)

$ErrorActionPreference = "Stop"

Write-Host "`n🎨 [آرت‌گشت] آغاز فرآیند آماده‌سازی و استقرار بر روی سرور پروداکشن..." -ForegroundColor Cyan

# 1. Typecheck
Write-Host "🔍 [۱/۶] بررسی بدون خطای تایپ‌های TypeScript..." -ForegroundColor Yellow
npm.cmd exec tsc -- --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Error "خطای تایپ‌اسکریپت شناسایی شد! استقرار متوقف گردید."
    exit 1
}

# 2. Local Vite Frontend Build
Write-Host "📦 [۲/۶] بیلد نسخه استاتیک فرانت‌اند با Vite..." -ForegroundColor Yellow
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "خطای بیلد فرانت‌اند شناسایی شد!"
    exit 1
}

# 3. Build Docker image locally on laptop
Write-Host "🐳 [۳/۶] ساخت ایمیج داکر به صورت Self-Contained بر روی لپ‌تاپ..." -ForegroundColor Yellow
docker build -t artgasht:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Error "خطا در ساخت ایمیج داکر!"
    exit 1
}

# 4. Check if ServerHost was provided
if ([string]::IsNullOrWhiteSpace($ServerHost)) {
    Write-Host "`n⚠️  آدرس سرور (-ServerHost) مشخص نشده است." -ForegroundColor Yellow
    Write-Host "ایمیج با موفقیت بر روی لپ‌تاپ ساخته شد. برای خروجی فایل دستی آفلاین اجرا کنید:" -ForegroundColor White
    Write-Host "  docker save artgasht:latest | gzip > artgasht.tar.gz" -ForegroundColor Green
    Write-Host "`nیا برای استقرار مستقیم روی سرور:" -ForegroundColor White
    Write-Host "  .\scripts\deploy-server.ps1 -ServerHost <IP_OR_DOMAIN> -ServerUser root" -ForegroundColor Green
    exit 0
}

$SSH_DEST = "${ServerUser}@${ServerHost}"
Write-Host "🚀 [۴/۶] اتصال به سرور ${SSH_DEST} و آماده‌سازی مسیر ${RemoteDir}..." -ForegroundColor Yellow

ssh -p $ServerPort $SSH_DEST "mkdir -p ${RemoteDir}/data/uploads"

# 5. Stream Docker Image directly to remote server (Never downloads from Docker Hub on server)
Write-Host "📡 [۵/۶] انتقال مستقیم کانتینر داکر از طریق SSH به سرور (Streaming docker save -> docker load)..." -ForegroundColor Yellow
docker save artgasht:latest | gzip | ssh -p $ServerPort $SSH_DEST "gzip -d | docker load"

# Transfer docker-compose.yml and .env template if not present
Write-Host "📄 کپی فایل‌های پیکربندی و Caddyfile به سرور..." -ForegroundColor Yellow
scp -P $ServerPort docker-compose.yml "${SSH_DEST}:${RemoteDir}/docker-compose.yml"
scp -P $ServerPort Caddyfile "${SSH_DEST}:${RemoteDir}/Caddyfile"

# Check if .env exists on remote; if not, copy .env.example
ssh -p $ServerPort $SSH_DEST "if [ ! -f ${RemoteDir}/.env ]; then cp ${RemoteDir}/.env.example ${RemoteDir}/.env 2>/dev/null || true; fi"

# 6. Restart Container on Server & Verify /health
Write-Host "🔄 [۶/۶] راه‌اندازی کانتینر پروداکشن در سرور..." -ForegroundColor Yellow
ssh -p $ServerPort $SSH_DEST "cd ${RemoteDir} && docker compose up -d --force-recreate"

Start-Sleep -Seconds 3

Write-Host "🩺 تست سلامت سرویس (/health)..." -ForegroundColor Yellow
ssh -p $ServerPort $SSH_DEST "curl -s http://127.0.0.1:3000/health || wget -qO- http://127.0.0.1:3000/health"

Write-Host "`n✅ استقرار با موفقیت انجام شد! آرت‌گشت بر روی سرور فعال است." -ForegroundColor Green
