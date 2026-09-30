@echo off
setlocal
cd /d "%~dp0"
rem Reuse a healthy Ocean 3D server when the launcher is opened again.
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4173/' -TimeoutSec 2; if ($r.StatusCode -eq 200 -and $r.Content -match '<title>Ocean 3D') { Start-Process 'http://127.0.0.1:4173/'; exit 0 } } catch {}; exit 1"
if not errorlevel 1 exit /b 0

where node >nul 2>&1
if errorlevel 1 (
  echo Ocean 3D needs Node.js 22 or newer. Install Node.js, then try again.
  pause
  exit /b 1
)
if not exist node_modules\vite (
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection.
    pause
    exit /b 1
  )
)

call npm run dev -- --open
pause

