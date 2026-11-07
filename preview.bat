@echo off
rem Double-click this file to preview the site at http://localhost:8080
rem Close this window (or press Ctrl+C) to stop the preview.
cd /d "%~dp0"
node tools\check.js
node tools\preview.js --open
pause
