@echo off
cd /d "%~dp0"
set "PATH=%~dp0.tools\node;%~dp0.tools\git\cmd;%PATH%"
call npm run dev -- --hostname 127.0.0.1
pause
