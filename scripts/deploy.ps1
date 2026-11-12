# ========================================================
# Anti-Gallery (آرت‌گشت) Multi-Target Deployment Script (PowerShell)
# Robust file-based transfer using 'docker save -o' + scp + 'docker load -i'
# (Prevents PowerShell 5.1 binary pipeline corruption)
#
# Usage:
#   .\scripts\deploy.ps1 -Target primary
#   .\scripts\deploy.ps1 -Target mirror
#   .\scripts\deploy.ps1 -Target all
# ========================================================

param (
    [Parameter(Mandatory=$false)]
    [ValidateSet("primary", "mirror", "all")]
    [string]$Target = "primary",

    [Parameter(Mandatory=$false)]
    [string]$ConfigFile = "deploy.config"
)

$ErrorActionPreference = "Stop"

Write-Host "`n🎨 [آرت‌گشت] آغاز فرآیند استقرار پروداکشن (Target: $Target)..." -ForegroundColor Cyan

# 1. Read deploy.config
if (-not (Test-Path $ConfigFile)) {
    if (Test-Path "deploy.config.example") {
        Write-Host "⚠️  فایل $ConfigFile یافت نشد. در حال ساخت $ConfigFile بر اساس deploy.config.example..." -ForegroundColor Yellow
        Copy-Item "deploy.config.example" $ConfigFile
    } else {
        Write-Error "فایل پیکربندی سرورها ($ConfigFile) یافت نشد!"
        exit 1
    }
}

$configJson = Get-Content $ConfigFile -Raw | ConvertFrom-Json

# 2. Typecheck
Write-Host "🔍 [۱/۵] اعتبارسنجی بدون خطای TypeScript..." -ForegroundColor Yellow
npm.cmd exec tsc -- --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Error "خطای تایپ‌اسکریپت شناسایی شد! استقرار لغو گردید."
    exit 1
}

# 3. Vite Build
Write-Host "📦 [۲/۵] بیلد دارایی‌های فرانت‌اند با Vite..." -ForegroundColor Yellow
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "خطای بیلد فرانت‌اند!"
    exit 1
}

# 4. Build Docker image locally ONCE
Write-Host "🐳 [۳/۵] ساخت ایمیج مستقل داکر روی لپ‌تاپ..." -ForegroundColor Yellow
docker build -t artgasht:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Error "خطا در ساخت ایمیج داکر!"
    exit 1
}

# 5. Export Docker image to file on disk (Robust: Avoids PS 5.1 SSH pipe byte-loss)
$tarFile = "$pwd\artgasht_temp.tar"
Write-Host "💾 [۴/۵] خروجی فایل ایمیج داکر در دیسک محلی ($tarFile)..." -ForegroundColor Yellow
docker save -o "$tarFile" artgasht:latest
if ($LASTEXITCODE -ne 0) {
    Write-Error "خطا در ذخیره فایل ایمیج داکر!"
    exit 1
}

# Collect target servers
$targetsToDeploy = @()
if ($Target -eq "primary" -or $Target -eq "all") {
    if ($configJson.primary -and $configJson.primary.host) {
        $targetsToDeploy += @{ key = "primary"; cfg = $configJson.primary }
    }
}
if ($Target -eq "mirror" -or $Target -eq "all") {
    if ($configJson.mirror -and $configJson.mirror.host) {
        $targetsToDeploy += @{ key = "mirror"; cfg = $configJson.mirror }
    }
}

try {
    # 6. Deploy to each target
    Write-Host "🚀 [۵/۵] ارسال و بارگذاری بر روی سرورهای مقصد..." -ForegroundColor Yellow

    foreach ($item in $targetsToDeploy) {
        $role = $item.key
        $server = $item.cfg
        $user = if ($server.user) { $server.user } else { "deploy" }
        $hostName = $server.host
        $dest = "${user}@${hostName}"
        $port = if ($server.port) { $server.port } else { 22 }
        $remoteDir = if ($server.remoteDir) { $server.remoteDir } else { "/opt/artgasht" }
        $keyArg = if ($server.key -and (Test-Path $server.key)) { "-i $($server.key)" } else { "" }

        Write-Host "`n📡 انتقال به سرور $($server.name) ($dest)..." -ForegroundColor Cyan

        # Ensure remote directory structure with correct permissions
        ssh -p $port $keyArg $dest "mkdir -p $remoteDir/data/uploads $remoteDir/scripts"

        # Transfer Docker tar via SCP
        Write-Host "  -> آپلود فایل ایمیج داکر (SCP)..." -ForegroundColor DarkGray
        scp -P $port $keyArg "$tarFile" "$dest`:$remoteDir/artgasht_temp.tar"

        # Load Docker image on remote and immediately remove tar to save disk space
        Write-Host "  -> بارگذاری ایمیج درون داکر سرور (docker load)..." -ForegroundColor DarkGray
        ssh -p $port $keyArg $dest "docker load -i $remoteDir/artgasht_temp.tar && rm -f $remoteDir/artgasht_temp.tar"

        # Transfer Compose, Caddyfile, and operational scripts
        Write-Host "  -> همگام‌سازی فایل‌های پیکربندی و اسکریپت‌ها..." -ForegroundColor DarkGray
        scp -P $port $keyArg docker-compose.yml "$dest`:$remoteDir/docker-compose.yml"
        scp -P $port $keyArg Caddyfile "$dest`:$remoteDir/Caddyfile"
        scp -r -P $port $keyArg scripts/* "$dest`:$remoteDir/scripts/"

        # Ensure scripts are executable
        ssh -p $port $keyArg $dest "chmod +x $remoteDir/scripts/*.sh $remoteDir/scripts/*.cjs 2>/dev/null || true"

        # Ensure .env exists on remote (copy .env.example if missing)
        ssh -p $port $keyArg $dest "if [ ! -f $remoteDir/.env ]; then cp $remoteDir/.env.example $remoteDir/.env; fi"

        # Reload Caddy if Caddyfile changed
        ssh -p $port $keyArg $dest "sudo cp $remoteDir/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy 2>/dev/null || true"

        # On primary server, ensure live scraper timer is active
        if ($server.role -eq 'primary') {
            ssh -p $port $keyArg $dest "sudo cp $remoteDir/scripts/artgasht-scraper.* /etc/systemd/system/ 2>/dev/null && sudo systemctl daemon-reload && sudo systemctl enable --now artgasht-scraper.timer 2>/dev/null || true"
        }

        # Restart Container (Runs as deploy user 1000:1000)
        Write-Host "  -> راه‌اندازی کانتینر پروداکشن (docker compose up)..." -ForegroundColor DarkGray
        ssh -p $port $keyArg $dest "cd $remoteDir && docker compose up -d --force-recreate"

        Start-Sleep -Seconds 3

        # Test Health
        Write-Host "  🩺 تست سلامت سرویس (/health):" -ForegroundColor Yellow
        $healthOutput = ssh -p $port $keyArg $dest "curl -fsS http://127.0.0.1:3000/health || wget -qO- http://127.0.0.1:3000/health || true"
        Write-Host "  $healthOutput" -ForegroundColor Green
    }
}
finally {
    # Cleanup local temporary tar
    if (Test-Path "$tarFile") {
        Write-Host "`n🧹 پاکسازی فایل موقت $tarFile روی لپ‌تاپ..." -ForegroundColor DarkGray
        Remove-Item -Force "$tarFile"
    }
}

Write-Host "`n✅ فرآیند استقرار با موفقیت پایان یافت!" -ForegroundColor Green
