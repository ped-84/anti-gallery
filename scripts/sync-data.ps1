# ========================================================
# Anti-Gallery (آرت‌گشت) Data Synchronization Script (PowerShell)
# Syncs galleries JSON database and uploaded poster images
# between Iran VPS, Germany VPS, and local laptop.
#
# Usage:
#   .\scripts\sync-data.ps1 -Action Pull -RemoteHost 185.x.x.x -RemoteUser root
#   .\scripts\sync-data.ps1 -Action Push -RemoteHost 185.y.y.y -RemoteUser root
# ========================================================

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("Pull", "Push")]
    [string]$Action,

    [Parameter(Mandatory=$true)]
    [string]$RemoteHost,

    [Parameter(Mandatory=$false)]
    [string]$RemoteUser = "root",

    [Parameter(Mandatory=$false)]
    [int]$RemotePort = 22,

    [Parameter(Mandatory=$false)]
    [string]$RemoteDir = "/opt/artgasht",

    [Parameter(Mandatory=$false)]
    [string]$LocalDataDir = "./data"
)

$ErrorActionPreference = "Stop"
$SSH_DEST = "${RemoteUser}@${RemoteHost}"

if (-not (Test-Path $LocalDataDir)) {
    New-Item -ItemType Directory -Path $LocalDataDir -Force | Out-Null
}
if (-not (Test-Path "${LocalDataDir}/uploads")) {
    New-Item -ItemType Directory -Path "${LocalDataDir}/uploads" -Force | Out-Null
}

if ($Action -eq "Pull") {
    Write-Host "`n📥 دانلود داده‌ها و تصاویر از سرور ${RemoteHost} به سیستم محلی..." -ForegroundColor Cyan

    # Backup local data if files exist
    if (Test-Path "${LocalDataDir}/galleries.json") {
        $backupName = "${LocalDataDir}/galleries_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
        Copy-Item "${LocalDataDir}/galleries.json" $backupName
        Write-Host "💾 نسخه پشتیبان محلی ذخیره شد: $backupName" -ForegroundColor DarkGray
    }

    # Pull galleries.json
    scp -P $RemotePort "${SSH_DEST}:${RemoteDir}/data/galleries.json" "${LocalDataDir}/galleries.json"
    
    # Pull exhibitions if present
    try {
        scp -P $RemotePort "${SSH_DEST}:${RemoteDir}/data/exhibitions_fa.json" "${LocalDataDir}/exhibitions_fa.json" 2>$null
    } catch {}

    # Pull uploaded images
    scp -r -P $RemotePort "${SSH_DEST}:${RemoteDir}/data/uploads/*" "${LocalDataDir}/uploads/"

    Write-Host "✅ داده‌ها و تصاویر با موفقیت از سرور دانلود شدند." -ForegroundColor Green
}
elseif ($Action -eq "Push") {
    Write-Host "`n📤 ارسال داده‌ها و تصاویر از سیستم محلی به سرور ${RemoteHost}..." -ForegroundColor Cyan

    # Create remote folders if not existing
    ssh -p $RemotePort $SSH_DEST "mkdir -p ${RemoteDir}/data/uploads"

    # Push galleries.json
    if (Test-Path "${LocalDataDir}/galleries.json") {
        scp -P $RemotePort "${LocalDataDir}/galleries.json" "${SSH_DEST}:${RemoteDir}/data/galleries.json"
    }

    if (Test-Path "${LocalDataDir}/exhibitions_fa.json") {
        scp -P $RemotePort "${LocalDataDir}/exhibitions_fa.json" "${SSH_DEST}:${RemoteDir}/data/exhibitions_fa.json"
    }

    # Push uploads
    if (Test-Path "${LocalDataDir}/uploads") {
        scp -r -P $RemotePort "${LocalDataDir}/uploads/*" "${SSH_DEST}:${RemoteDir}/data/uploads/"
    }

    Write-Host "✅ داده‌ها و تصاویر با موفقیت به سرور ارسال شدند." -ForegroundColor Green
}
