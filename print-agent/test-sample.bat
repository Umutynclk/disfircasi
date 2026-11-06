@echo off
chcp 65001 >nul
title KALIPORT Print Agent Numune Baski Testi
cd /d "%~dp0"
echo [*] Kontrollu Numune Etiket Testi Baslatiliyor...
node dist/index.js --test-sample
pause
