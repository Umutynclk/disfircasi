<#
.SYNOPSIS
    KALIPORT PALMX TXP 400 (4BARCODE 4B-2054TG) Sessiz Test Baskısı Scripti
.DESCRIPTION
    Gerçek müşteri siparişi veya canlı HepsiJET barkodu KULLANMADAN sentetik bir
    "TEST - GERÇEK KARGO DEĞİLDİR" PDF'si üretir ve SumatraPDF.exe -silent ile
    doğrudan "4BARCODE 4B-2054TG" yazıcısına gönderip Windows Spooler kaydını doğrular.
#>

[CmdletBinding()]
param(
    [string]$AgentDir = "C:\KaliportPrintAgent",
    [string]$PrinterName = "4BARCODE 4B-2054TG"
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🧪 KALIPORT Sessiz Termal Yazıcı Testi (GUI Açmadan)" -ForegroundColor Cyan
Write-Host "Yazıcı: $PrinterName" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Yazıcı kontrolü
$printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
if (-not $printer) {
    Write-Error "❌ Yazıcı bulunamadı: '$PrinterName'. Kurulu yazıcılar:"
    Get-Printer | Select-Object Name, PrinterStatus, PortName | Format-Table -AutoSize
    exit 1
}
Write-Host "✅ Yazıcı bulundu: $($printer.Name) | Durum: $($printer.PrinterStatus) | Port: $($printer.PortName)" -ForegroundColor Green

# 2. SumatraPDF kontrolü
$sumatraExe = @(
    (Join-Path $AgentDir "SumatraPDF.exe"),
    (Join-Path $env:LOCALAPPDATA "SumatraPDF\SumatraPDF.exe"),
    "C:\Program Files\SumatraPDF\SumatraPDF.exe",
    "C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $sumatraExe) {
    Write-Error "❌ SumatraPDF.exe bulunamadı! Lütfen $AgentDir\SumatraPDF.exe konumuna yerleştirin."
    exit 1
}
Write-Host "✅ SumatraPDF bulundu: $sumatraExe" -ForegroundColor Green

# 3. Sentetik TEST PDF üret (Node üzerinden)
Push-Location $AgentDir
try {
    $env:DRY_RUN = "false"
    $env:PRINT_PRINTER_NAME = $PrinterName
    node dist\index.js --test-sample
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Write-Error "❌ Test baskısı hata koduyla sonlandı: $exitCode"
        exit $exitCode
    }
} finally {
    Pop-Location
}

# 4. Windows Spooler kontrolü
Start-Sleep -Seconds 1
Write-Host "`n📋 Windows Print Spooler Durumu ($PrinterName):" -ForegroundColor Cyan
Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue |
    Select-Object Id, DocumentName, JobStatus, SubmittedTime |
    Format-Table -AutoSize

Write-Host "✅ Sessiz test baskısı tamamlandı. Yazıcıdan çıkan etikette 'TEST - GERCEK KARGO DEGILDIR' ve tek sayfa olduğunu doğrulayın." -ForegroundColor Green
