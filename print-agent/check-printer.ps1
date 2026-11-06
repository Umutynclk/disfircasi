<#
.SYNOPSIS
    PALMX TXP 400 Windows Yazıcı Kontrol ve Tanı Aracı
.DESCRIPTION
    Bu script, Windows bilgisayara bağlı PALMX TXP 400 termal yazıcının durumunu,
    portunu ve sürücüsünü denetler; operatöre tanı bilgisi sunar.
#>

[CmdletBinding()]
param(
    [string]$PrinterName = "4BARCODE 4B-2054TG",
    [switch]$PrintTestPage
)

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "PALMX TXP 400 Windows Yazıcı Denetimi" -ForegroundColor Cyan
Write-Host "Aranan Yazıcı Adı: '$PrinterName'" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue

if ($printer) {
    Write-Host "✅ Yazıcı Windows üzerinde başarıyla bulundu!" -ForegroundColor Green
    Write-Host " - Adı        : $($printer.Name)" -ForegroundColor White
    Write-Host " - Sürücü     : $($printer.DriverName)" -ForegroundColor White
    Write-Host " - Port       : $($printer.PortName)" -ForegroundColor White
    Write-Host " - Durum      : $($printer.PrinterStatus)" -ForegroundColor White
    Write-Host " - Paylaşılan : $($printer.Shared)" -ForegroundColor White

    # Windows Test Sayfası
    if ($PrintTestPage) {
        Write-Host "`nWindows test sayfası yazıcıya gönderiliyor..." -ForegroundColor Yellow
        try {
            rundll32.exe printui.dll,PrintUIEntry /k /n "$PrinterName"
            Write-Host "✅ Test sayfası isteği gönderildi. Lütfen yazıcıyı kontrol edin." -ForegroundColor Green
        } catch {
            Write-Error "Test sayfası gönderilemedi: $_"
        }
    } else {
        Write-Host "`nİpucu: Windows test sayfası basmak için: .\check-printer.ps1 -PrintTestPage" -ForegroundColor Gray
    }
} else {
    Write-Warning "⚠️ '$PrinterName' adında bir yazıcı bulunamadı!"
    Write-Host "`nSistemde kurulu mevcut yazıcılar:" -ForegroundColor Yellow
    Get-Printer | Format-Table Name, DriverName, PortName, PrinterStatus -AutoSize

    Write-Host "Operatör Notu:" -ForegroundColor Cyan
    Write-Host "1. Yazıcınızın USB kablosunu ve açık olduğunu kontrol edin." -ForegroundColor White
    Write-Host "2. Windows Denetim Masası -> Aygıtlar ve Yazıcılar altındaki adı kontrol edin." -ForegroundColor White
    Write-Host "3. Yazıcı adı farklıysa (örn: 'PALMX 400' veya 'POS-80'), config.json içindeki printerName alanını güncelleyin." -ForegroundColor White
}
Write-Host "====================================================" -ForegroundColor Cyan
