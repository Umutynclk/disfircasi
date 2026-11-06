<#
.SYNOPSIS
    KALIPORT PALMX TXP 400 Print Agent Windows Servis Kurulum Scripti
.DESCRIPTION
    Bu script, Agent'ı Windows Servisi olarak kaydeder ve bilgisayar açıldığında
    otomatik başlamasını sağlar. NSSM (Non-Sucking Service Manager) tercih edilir;
    NSSM yoksa Windows Görev Zamanlayıcı (Task Scheduler) alternatifi kullanılır.
.PARAMETER ServiceManager
    Kullanılacak servis yöneticisi: 'NSSM' veya 'TaskScheduler'. Varsayılan: 'NSSM'.
#>

[CmdletBinding()]
param(
    [ValidateSet('NSSM', 'TaskScheduler')]
    [string]$ServiceManager = 'NSSM'
)

$ServiceName = "KaliportPrintAgent"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "KALIPORT Print Agent Windows Servis Kurulumu" -ForegroundColor Cyan
Write-Host "Dizin: $ScriptDir" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Yönetici İzni Kontrolü
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Bu script yönetici (Administrator) yetkileriyle çalıştırılmalıdır. Lütfen PowerShell'i 'Yönetici Olarak Çalıştır' seçeneğiyle açın."
    exit 1
}

# 2. Node.js Kontrolü
try {
    $nodeVersion = node -v
    Write-Host "✅ Node.js tespit edildi: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Error "Node.js sistemde bulunamadı. Lütfen https://nodejs.org adresinden Node.js LTS (v20+) kurun ve PATH'e ekleyin."
    exit 1
}

# 3. config.json Kontrolü
$configPath = Join-Path $ScriptDir "config.json"
if (-not (Test-Path $configPath)) {
    Write-Error "config.json bulunamadı ($configPath). Lütfen config.example.json dosyasını config.json olarak kopyalayıp Agent ID, Token ve Yazıcı adını ayarlayın."
    exit 1
}

try {
    $configContent = Get-Content $configPath -Raw | ConvertFrom-Json
    if ($configContent.agentToken -eq "pa_live_your_secret_token_here" -or [string]::IsNullOrWhiteSpace($configContent.agentToken)) {
        Write-Warning "⚠️ config.json dosyasındaki 'agentToken' alanı şablon değerinde kalmış veya boş! Lütfen admin panelinden aldığınız gerçek tokenı girin."
    }
    Write-Host "✅ config.json başarıyla doğrulandı (Agent ID: $($configContent.agentId), Yazıcı: $($configContent.printerName), DryRun: $($configContent.dryRun))" -ForegroundColor Green
} catch {
    Write-Error "config.json dosyası geçerli bir JSON formatında değil: $_"
    exit 1
}

# 4. Log Klasörü Oluştur
$logsDir = Join-Path $ScriptDir "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    Write-Host "✅ Log klasörü oluşturuldu: $logsDir" -ForegroundColor Green
}

# 5. Giriş Noktası Tespiti (dist/index.js veya index.ts)
$entryPoint = Join-Path $ScriptDir "dist\index.js"
$useTsx = $false

if (-not (Test-Path $entryPoint)) {
    $tsEntry = Join-Path $ScriptDir "index.ts"
    if (Test-Path $tsEntry) {
        $entryPoint = $tsEntry
        $useTsx = $true
        Write-Host "ℹ️ Derlenmiş dist/index.js bulunamadı; index.ts üzerinden tsx ile çalıştırılacak." -ForegroundColor Yellow
    } else {
        Write-Error "Agent giriş dosyası (dist/index.js veya index.ts) bulunamadı."
        exit 1
    }
}

# 6. Servis Kurulumu: NSSM veya Task Scheduler
if ($ServiceManager -eq 'NSSM') {
    # NSSM var mı kontrol et
    $nssmPath = Get-Command nssm -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if (-not $nssmPath) {
        $localNssm = Join-Path $ScriptDir "nssm.exe"
        if (Test-Path $localNssm) {
            $nssmPath = $localNssm
        }
    }

    if (-not $nssmPath) {
        Write-Warning "NSSM (nssm.exe) sistem PATH'inde veya script klasöründe bulunamadı."
        Write-Warning "Otomatik olarak Task Scheduler (Görev Zamanlayıcı) seçeneğine geçiliyor..."
        $ServiceManager = 'TaskScheduler'
    } else {
        Write-Host "NSSM ile servis kuruluyor ($nssmPath)..." -ForegroundColor Cyan
        
        # Varsa eski servisi durdur ve kaldır
        & $nssmPath stop $ServiceName 2>$null
        & $nssmPath remove $ServiceName confirm 2>$null

        $nodeExe = (Get-Command node).Source
        $stdoutLog = Join-Path $logsDir "agent_stdout.log"
        $stderrLog = Join-Path $logsDir "agent_stderr.log"

        if ($useTsx) {
            $npxExe = (Get-Command npx.cmd -ErrorAction SilentlyContinue).Source
            if (-not $npxExe) { $npxExe = "npx.cmd" }
            & $nssmPath install $ServiceName $npxExe "tsx index.ts"
        } else {
            & $nssmPath install $ServiceName $nodeExe "dist\index.js"
        }

        & $nssmPath set $ServiceName AppDirectory $ScriptDir
        & $nssmPath set $ServiceName AppStdout $stdoutLog
        & $nssmPath set $ServiceName AppStderr $stderrLog
        & $nssmPath set $ServiceName AppRotateFiles 1
        & $nssmPath set $ServiceName AppRotateOnline 1
        & $nssmPath set $ServiceName AppRotateBytes 5242880 # 5 MB rotasyon
        & $nssmPath set $ServiceName Start SERVICE_AUTO_START

        # Servisi başlat
        & $nssmPath start $ServiceName
        Write-Host "====================================================" -ForegroundColor Green
        Write-Host "✅ $ServiceName servisi NSSM ile başarıyla kuruldu ve başlatıldı!" -ForegroundColor Green
        Write-Host "Durum kontrolü: Get-Service $ServiceName" -ForegroundColor White
        Write-Host "Log dosyaları : $logsDir" -ForegroundColor White
        Write-Host "====================================================" -ForegroundColor Green
        exit 0
    }
}

if ($ServiceManager -eq 'TaskScheduler') {
    Write-Host "Windows Görev Zamanlayıcı (Task Scheduler) ile servis kuruluyor..." -ForegroundColor Cyan

    $taskName = "KaliportPrintAgentTask"
    $nodeExe = (Get-Command node).Source

    $actionArg = if ($useTsx) { "/c cd /d `"$ScriptDir`" && npx tsx index.ts >> `"$logsDir\agent_stdout.log`" 2>> `"$logsDir\agent_stderr.log`"" } else { "/c cd /d `"$ScriptDir`" && node dist\index.js >> `"$logsDir\agent_stdout.log`" 2>> `"$logsDir\agent_stderr.log`"" }
    $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $actionArg -WorkingDirectory $ScriptDir
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 365)

    # Eski görevi temizle
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "KALIPORT PALMX TXP 400 Print Agent Arka Plan Görevi" | Out-Null
    Start-ScheduledTask -TaskName $taskName

    Write-Host "====================================================" -ForegroundColor Green
    Write-Host "✅ $taskName Görev Zamanlayıcı'ya kaydedildi ve başlatıldı!" -ForegroundColor Green
    Write-Host "Durum kontrolü: Get-ScheduledTask -TaskName $taskName" -ForegroundColor White
    Write-Host "Log dosyaları : $logsDir" -ForegroundColor White
    Write-Host "====================================================" -ForegroundColor Green
}
