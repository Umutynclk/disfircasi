<#
.SYNOPSIS
    KALIPORT PALMX TXP 400 Print Agent v2.0.0 Güvenli Güncelleme & Rollback Scripti
.DESCRIPTION
    - Mevcut C:\KaliportPrintAgent\config.json ve logs\ klasörünü KORUR ve yedekler.
    - KaliportPrintAgentTask görevini durdurur.
    - Yeni derlenmiş dist/ dosyalarını aktarır.
    - SumatraPDF.exe bağımlılığını ve "4BARCODE 4B-2054TG" yazıcısını doğrular.
    - Scheduled Task'ı yeniden başlatır.
    - Herhangi bir hata durumunda otomatik ROLLBACK yapar.
.PARAMETER SourceDir
    Yeni print-agent dosyalarının bulunduğu klasör (varsayılan: bu scriptin bulunduğu klasör).
.PARAMETER TargetDir
    Windows'ta kurulu hedef agent klasörü (varsayılan: C:\KaliportPrintAgent).
.PARAMETER TaskName
    Windows Task Scheduler görev adı (varsayılan: KaliportPrintAgentTask).
.PARAMETER Rollback
    Son yedeğe geri dönmek için -Rollback parametresini kullanın.
#>

[CmdletBinding()]
param(
    [string]$SourceDir = $PSScriptRoot,
    [string]$TargetDir = "C:\KaliportPrintAgent",
    [string]$TaskName = "KaliportPrintAgentTask",
    [switch]$Rollback
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "KALIPORT Print Agent v2.0.0 Güncelleme Aracı" -ForegroundColor Cyan
Write-Host "Hedef Klasör : $TargetDir" -ForegroundColor Cyan
Write-Host "Görev Adı    : $TaskName" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Yönetici kontrolü
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Bu script Yönetici (Administrator) yetkisiyle çalıştırılmalıdır."
    exit 1
}

$backupRoot = Join-Path $TargetDir "backups"

# ROLLBACK MODU
if ($Rollback) {
    $latestBackup = Get-ChildItem -Path $backupRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $latestBackup) {
        Write-Error "Geri dönülecek yedek klasörü bulunamadı: $backupRoot"
        exit 1
    }
    Write-Host "🔄 Rollback başlatılıyor: $($latestBackup.FullName)" -ForegroundColor Yellow
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    if (Test-Path (Join-Path $latestBackup.FullName "dist")) {
        Remove-Item -Path (Join-Path $TargetDir "dist") -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item -Path (Join-Path $latestBackup.FullName "dist") -Destination (Join-Path $TargetDir "dist") -Recurse -Force
    }
    if (Test-Path (Join-Path $latestBackup.FullName "config.json")) {
        Copy-Item -Path (Join-Path $latestBackup.FullName "config.json") -Destination (Join-Path $TargetDir "config.json") -Force
    }
    Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Write-Host "✅ Rollback tamamlandı ve $TaskName yeniden başlatıldı." -ForegroundColor Green
    exit 0
}

# 1. Hedef ve config.json doğrulaması
$configPath = Join-Path $TargetDir "config.json"
if (-not (Test-Path $configPath)) {
    Write-Error "Mevcut config.json bulunamadı: $configPath. Güncelleme iptal edildi."
    exit 1
}

$configJson = Get-Content $configPath -Raw | ConvertFrom-Json
$printerName = if ($configJson.printerName) { $configJson.printerName } else { "4BARCODE 4B-2054TG" }
Write-Host "✅ Mevcut config.json korundu (AgentId=$($configJson.agentId), Printer=$printerName, DryRun=$($configJson.dryRun))" -ForegroundColor Green

# 2. SumatraPDF.exe kontrolü
$sumatraCandidates = @(
    (Join-Path $TargetDir "SumatraPDF.exe"),
    (Join-Path $env:LOCALAPPDATA "SumatraPDF\SumatraPDF.exe"),
    "C:\Program Files\SumatraPDF\SumatraPDF.exe",
    "C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe"
)
$sumatraFound = $sumatraCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $sumatraFound) {
    $cmd = Get-Command SumatraPDF.exe -ErrorAction SilentlyContinue
    if ($cmd) { $sumatraFound = $cmd.Source }
}
if ($sumatraFound) {
    Write-Host "✅ SumatraPDF tespit edildi: $sumatraFound" -ForegroundColor Green
} else {
    Write-Warning "⚠️ SumatraPDF.exe bulunamadı! Lütfen https://www.sumatrapdfreader.org/download-free-pdf-viewer adresinden 64-bit Portable SumatraPDF.exe indirip $TargetDir\SumatraPDF.exe konumuna kopyalayın."
}

# 3. Yazıcı kontrolü
$printerObj = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
if ($printerObj) {
    Write-Host "✅ Windows yazıcısı doğrulandı: $($printerObj.Name) (Durum: $($printerObj.PrinterStatus), Port: $($printerObj.PortName))" -ForegroundColor Green
} else {
    Write-Warning "⚠️ '$printerName' adlı yazıcı bu kullanıcı oturumunda görünmüyor! Task Scheduler hesabının yazıcıya erişimini kontrol edin."
}

# 4. Yedekleme
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $backupRoot "backup_$timestamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item -Path $configPath -Destination (Join-Path $backupDir "config.json") -Force
if (Test-Path (Join-Path $TargetDir "dist")) {
    Copy-Item -Path (Join-Path $TargetDir "dist") -Destination (Join-Path $backupDir "dist") -Recurse -Force
}
if (Test-Path (Join-Path $TargetDir "package.json")) {
    Copy-Item -Path (Join-Path $TargetDir "package.json") -Destination (Join-Path $backupDir "package.json") -Force
}
Write-Host "✅ Yedek oluşturuldu: $backupDir" -ForegroundColor Green

# 5. Görevi durdur & Yeni dosyaları aktar
try {
    Write-Host "⏹️ $TaskName durduruluyor..." -ForegroundColor Yellow
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    # Eski node agent süreçlerini güvenle sonlandır (sadece bu klasörde çalışanlar)
    Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*KaliportPrintAgent*" -or $_.CommandLine -like "*dist\index.js*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

    $sourceDist = Join-Path $SourceDir "dist"
    if (-not (Test-Path $sourceDist)) {
        throw "Kaynak dist klasörü bulunamadı: $sourceDist. Önce 'npm run build' çalıştırın."
    }

    Remove-Item -Path (Join-Path $TargetDir "dist") -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -Path $sourceDist -Destination (Join-Path $TargetDir "dist") -Recurse -Force
    Copy-Item -Path (Join-Path $SourceDir "package.json") -Destination (Join-Path $TargetDir "package.json") -Force
    if (Test-Path (Join-Path $SourceDir "test-silent-print.ps1")) {
        Copy-Item -Path (Join-Path $SourceDir "test-silent-print.ps1") -Destination (Join-Path $TargetDir "test-silent-print.ps1") -Force
    }

    # config.json ve logs klasörü KESİNLİKLE ezilmez!
    Write-Host "▶️ $TaskName yeniden başlatılıyor..." -ForegroundColor Cyan
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 2

    $taskState = (Get-ScheduledTask -TaskName $TaskName).State
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "✅ Print Agent v2.0.0 güncellemesi tamamlandı!" -ForegroundColor Green
    Write-Host "Görev Durumu : $taskState" -ForegroundColor White
    Write-Host "Yedek Konumu : $backupDir" -ForegroundColor White
    Write-Host "Rollback     : .\update-agent.ps1 -Rollback" -ForegroundColor White
    Write-Host "============================================================" -ForegroundColor Green
} catch {
    Write-Error "❌ Güncelleme hatası: $_ — Otomatik rollback uygulanıyor..."
    if (Test-Path (Join-Path $backupDir "dist")) {
        Remove-Item -Path (Join-Path $TargetDir "dist") -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item -Path (Join-Path $backupDir "dist") -Destination (Join-Path $TargetDir "dist") -Recurse -Force
    }
    Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    exit 1
}
