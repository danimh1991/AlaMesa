@echo off
cd /d "%~dp0"
set "PATH=%~dp0.tools\node;%~dp0.tools\git\cmd;%PATH%"
echo AlaMesa - Node, npm y Git disponibles en esta terminal.
cmd /k
