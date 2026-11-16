@echo off
REM Lance le Bridge SHANGO (MQTT -> API AWS). Fermer cette fenetre arrete le bridge.
title SHANGO Bridge
cd /d "%~dp0"
:boucle
python shango_bridge.py
echo.
echo Le bridge s est arrete (code %ERRORLEVEL%). Redemarrage dans 10 s... (Ctrl+C pour quitter)
timeout /t 10 >nul
goto boucle
