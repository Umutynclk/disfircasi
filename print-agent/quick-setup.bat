@echo off
chcp 65001 >nul
title KALIPORT PALMX TXP-400 Windows Print Agent Kurulumu
color 0B

echo ==============================================================================
echo       KALIPORT - PALMX TXP 400 TERMAL YAZICI PRINT AGENT KURULUMU
echo ==============================================================================
echo  Bu script, Windows bilgisayarınızda kaynak kod, Next.js veya Firebase olmadan
echo  yalnızca yazdırma servisini arka planda Windows Servisi olarak kuracaktır.
echo ==============================================================================
echo.

:: 1. Yönetici Yetkisi Kontrolü
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [BILGI] Yonetici izinleri talep ediliyor...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

:: 2. Windows Uyku Modunu Devre Dışı Bırak (Yazdırma sırasında bilgisayar uyumamalı)
echo [*] Windows uyku modu kapatiliyor (Yazicinin 7/24 hazir kalmasi icin)...
powercfg /change standby-timeout-ac 0 >nul 2>&1
echo [OK] Prizde iken uyku modu devre disi birakildi.
echo.

:: 3. Node.js Kontrolü
echo [*] Node.js calisma ortami kontrol ediliyor...
node -v >nul 2>&1
if %errorLevel% neq 0 (
    echo [UYARI] Sistemde Node.js kurulu degil veya PATH'te bulunamadi!
    echo Lutfen https://nodejs.org adresinden Node.js LTS surumunu kurun.
    echo Eger 'winget' mevcutsa otomatik kurmak icin bir tusa basin...
    pause
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    echo Lutfen Node.js kurulumu tamamlandiktan sonra bu scripti yeniden calistirin.
    pause
    exit /b
)
echo [OK] Node.js mevcut: 
node -v
echo.

:: 4. Yazıcı Adını Otomatik Algıla
echo [*] Bagli yazicilar taraniyor...
powershell -Command "Get-Printer | Select-Object Name, PortName | Format-Table -AutoSize"

:: 5. Konfigürasyon Dosyası (config.json)
cd /d "%~dp0"
if not exist "config.json" (
    echo.
    echo [*] config.json dosyasi olusturuluyor...
    copy /y "config.example.json" "config.json" >nul
    echo [BILGI] config.json olusturuldu.
    echo.
    set /p AGENT_TOKEN="Admin panelinden aldiginiz Print Agent Token'ini yapistirin: "
    if not "%AGENT_TOKEN%"=="" (
        powershell -Command "(Get-Content config.json) -replace 'pa_live_your_secret_token_here', '%AGENT_TOKEN%' | Set-Content config.json"
        echo [OK] Token basariyla kaydedildi.
    )
) else (
    echo [OK] config.json mevcut.
)
echo.

:: 6. Windows Servisini Kur ve Başlat
echo [*] Windows Servisi / Arka Plan Gorevi kuruluyor...
powershell -ExecutionPolicy Bypass -File "%~dp0install-service.ps1"
echo.

:: 7. Baglanti Testi
echo [*] Sunucu baglanti testi yapiliyor...
node dist/index.js --test-sample >nul 2>&1
if %errorLevel% equ 0 (
    echo [BASARILI] Numune etiket testi basariyla tamamlandi.
) else (
    echo [BILGI] Agent arka planda sunucuyu dinlemeye basladi.
)

echo.
echo ==============================================================================
echo  ✅ TEBRIKLER! KALIPORT PRINT AGENT BASARIYLA KURULDU VE BASLATILDI.
echo  Windows acildiginda otomatik olarak arka planda calisacaktir.
echo  Tarayici veya terminal acik tutmaniza gerek yoktur.
echo ==============================================================================
pause
