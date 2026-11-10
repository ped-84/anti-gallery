# ========================================================
# Anti-Gallery (آرت‌گشت) Multi-Target Deployment Script (PowerShell)
# Builds Docker image ONCE locally and streams it over SSH.
# Targets configured in deploy.config:
#   - primary (Germany VPS - artgasht.com)
#   - mirror  (Iran VPS    - artgasht.ir)
#   - all     (Both servers sequentially)
#
# Usage:
#   .\scripts\deploy.ps1 -Target primary
#   .\scripts\deploy.ps1 -Target mirror
#   .\scripts\deploy.ps1 -Target all
# ========================================================

param (
    [Parameter(Mandatory=$false)]
    [ValidateSet("primary", "mirror", "all")]
    [string]$Target = "all",

    [Parameter(Mandatory=$false)]
    [string]$ConfigFile = "deploy.config"
)

$ErrorActionPreference = "Stop"

Write-Host "`n🎨 [آرت‌گشت] آغاز فرآیند استقرار بر روی سرورهای پروداکشن (Target: $Target)..." -ForegroundColor Cyan

# 1. Check Configuration
if (-not (Test-Path $ConfigFile)) {
    if (Test-Path "deploy.config.example") {
        Write-Host "⚠️  فایل $ConfigFile یافت نشد. لطفاً ابتدا deploy.config.example را به $ConfigFile کپی کرده و اطلاعات سرورها را وارد نمایید." -ForegroundColor Yellow
    } else {
        Write-Error "فایل تنظیمات سرور $ConfigFile یافت نشد!"
    }
    exit 1
}

$configJson = Get-Content $ConfigFile -Raw | ConvertFrom-Json

# 2. Typecheck
Write-Host "🔍 [۱/۴] اعتبارسنجی بدون خطای TypeScript..." -ForegroundColor Yellow
npm.cmd exec tsc -- --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Error "خطای تایپ‌اسکریپت شناسایی شد! استقرار لغو گردید."
    exit 1
}

# 3. Vite Frontend Build
Write-Host "📦 [۲/۴] ساخت فایل‌های استاتیک با Vite..." -ForegroundColor Yellow
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "خطای بیلد فرانت‌اند!"
    exit 1
}

# 4. Single Docker Build on Laptop
Write-Host "🐳 [۳/۴] ساخت ایمیج مستقل داکر بر روی لپ‌تاپ (یک بار برای تمام مقاصد)..." -ForegroundColor Yellow
docker build -t artgasht:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Error "خطا در ساخت ایمیج داکر!"
    exit 1
}

# Determine target list
$targetsToDeploy = @()
if ($Target -eq "primary" -or $Target -eq "all") {
    if ($configJson.primary -and $configJson.primary.host -ne "YOUR_GERMANY_IP_OR_DOMAIN") {
        $targetsToDeploy += @{ key = "primary"; cfg = $configJson.primary }
    }
}
if ($Target -eq "mirror" -or $Target -eq "all") {
    if ($configJson.mirror -and $configJson.mirror.host -ne "YOUR_IRAN_IP_OR_DOMAIN") {
        $targetsToDeploy += @{ key = "mirror"; cfg = $configJson.mirror }
    }
}

if ($targetsToDeploy.Count -eq 0) {
    Write-Host "⚠️  هیچ سرور فعالی در $ConfigFile برای مقصد '$Target' تنظیم نشده است." -ForegroundColor Yellow
    Write-Host "فایل ایمیج را می‌توانید به صورت دستی ذخیره کنید:" -ForegroundColor White
    Write-Host "  docker save artgasht:latest | gzip > artgasht.tar.gz" -ForegroundColor Green
    exit 0
}

# 5. Stream and Deploy to Each Target
Write-Host "🚀 [۴/۴] استقرار روی سرورهای مقصد..." -ForegroundColor Yellow

foreach ($item in $targetsToDeploy) {
    $role = $item.key
    $server = $item.cfg
    $dest = "$($server.user)@$($server.host)"
    $port = if ($server.port) { $server.port } else { 22 }
    $remoteDir = if ($server.remoteDir) { $server.remoteDir } else { "/opt/artgasht" }
    $keyArg = if ($server.key -and (Test-Path $server.key)) { "-i $($server.key)" } else { "" }

    Write-Host "`n📡 انتقال به $($server.name) ($dest)..." -ForegroundColor Cyan

    # Prepare remote directories
    ssh -p $port $keyArg $dest "mkdir -p $remoteDir/data/uploads $remoteDir/scripts"

    # Stream Docker image directly into remote docker daemon
    Write-Host "  -> استریم ایمیج داکر روی SSH..." -ForegroundColor DarkGray
    docker save artgasht:latest | gzip | ssh -p $port $keyArg $dest "gzip -d | docker load"

    # Copy Compose, Caddyfile, and operational scripts
    Write-Host "  -> کپی فایل‌های پیکربندی و اسکریپت‌ها..." -ForegroundColor DarkGray
    scp -P $port $keyArg docker-compose.yml "$dest`:$remoteDir/docker-compose.yml"
    scp -P $port $keyArg Caddyfile "$dest`:$remoteDir/Caddyfile"
    scp -P $port $keyArg scripts/sync-pull.sh "$dest`:$remoteDir/scripts/sync-pull.sh"
    scp -P $port $keyArg scripts/mirror-mode.sh "$dest`:$remoteDir/scripts/mirror-mode.sh"
    scp -P $port $keyArg scripts/merge-galleries.cjs "$dest`:$remoteDir/scripts/merge-galleries.cjs"
    scp -P $port $keyArg scripts/test-reachability.sh "$dest`:$remoteDir/scripts/test-reachability.sh"
    scp -P $port $keyArg scripts/backup.sh "$dest`:$remoteDir/scripts/backup.sh"

    # Ensure remote permissions and setup env role
    ssh -p $port $keyArg $dest "chmod +x $remoteDir/scripts/*.sh $remoteDir/scripts/*.cjs 2>/dev/null || true"

    # Restart Container
    Write-Host "  -> راه‌اندازی کانتینر در سرور..." -ForegroundColor DarkGray
    ssh -p $port $keyArg $dest "cd $remoteDir && docker compose up -d --force-recreate"

    Start-Sleep -Seconds 3

    # Check Health
    Write-Host "  🩺 تست سلامت سرویس:" -ForegroundColor Yellow
    ssh -p $port $keyArg $dest "curl -s http://127.0.0.1:3000/health || wget -qO- http://127.0.0.1:3000/health || true"
}

Write-Host "`n✅ تمام مراحل استقرار با موفقیت پایان یافت!" -ForegroundColor Green
