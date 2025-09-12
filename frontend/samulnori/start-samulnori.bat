@echo off
echo Starting SAMULNORI Application...

REM 백그라운드에서 백엔드 시작
start "SAMULNORI Backend" cmd /c "start-backend.bat"

REM 잠시 대기 (백엔드 시작 시간)
timeout /t 5 /nobreak > nul

REM Electron 앱 실행
echo Starting Electron App...
start "" "release\win-unpacked\SamulnoriApp.exe"

echo SAMULNORI is starting...
echo Backend: http://localhost:8000
echo Frontend: Electron App

pause 