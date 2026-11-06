<#
.SYNOPSIS
    KALIPORT PALMX TXP 400 Print Agent Windows Servis Kaldırma Scripti
.DESCRIPTION
    Kurulmuş olan Windows Servisini (NSSM) veya Görev Zamanlayıcı (Task Scheduler)
    görevini durdurur ve sistemden güvenle kaldırır.
#>

[CmdletBinding()]
param(
    [switch]$CleanLogs
)

$ServiceName = "KaliportPrintAgent"
$TaskName = "KaliportPrintAgentTask"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "====================================================" -ForegroundColor Yellow
Write-Host "KALIPORT Print Agent Windows Servis Kaldırma" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Yellow

# 1. Yönetici İzni Kontrolü
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Bu script yönetici (Administrator) yetkileriyle çalıştırılmalıdır."
    exit 1
}

# 2. NSSM Servisini Kaldır
$nssmPath = Get-Command nssm -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $nssmPath) {
    $localNssm = Join-Path $ScriptDir "nssm.exe"
    if (Test-Path $localNssm) { $nssmPath = $localNssm }
}

if ($nssmPath) {
    try {
        & $nssmPath stop $ServiceName 2>$null
        & $nssmPath remove $ServiceName confirm 2>$null
        Write-Host "✅ NSSM servisi ($ServiceName) durduruldu ve kaldırıldı." -ForegroundColor Green
    } catch {
        Write-Warning "NSSM servisi kaldırılırken bir uyarı oluştu: $_"
    }
} else {
    # Standart Windows Service kontrolü
    $winService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($winService) {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        sc.exe delete $ServiceName | Out-Null
        Write-Host "✅ Windows servisi ($ServiceName) silindi." -ForegroundColor Green
    }
}

# 3. Görev Zamanlayıcı Görevini Kaldır
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "✅ Görev Zamanlayıcı görevi ($TaskName) kaldırıldı." -ForegroundColor Green
}

# 4. Opsiyonel: Logları Temizle
if ($CleanLogs) {
    $logsDir = Join-Path $ScriptDir "logs"
    if (Test-Path $logsDir) {
        Remove-Item -Path $logsDir -Recurse -Force
        Write-Host "ℹ️ Log klasörü temizlendi ($logsDir)." -ForegroundColor Gray
    }
}

Write-Host "====================================================" -ForegroundColor Green
Write-Host "✅ KALIPORT Print Agent servisi başarıyla kaldırıldı." -ForegroundColor Green
Write-Host "Not: config.json ve simüle edilmiş dosyalarınız korunmuştur." -ForegroundColor White
Write-Host "====================================================" -ForegroundColor Green
