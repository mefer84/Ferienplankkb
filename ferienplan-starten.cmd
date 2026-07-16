@echo off
set "APP_DIR=%~dp0"
set "APP_URL=http://127.0.0.1:3000/?v=7"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url = 'http://127.0.0.1:3000/api/public';" ^
  "$appDir = '%APP_DIR%';" ^
  "try { Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2 | Out-Null }" ^
  "catch { Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'server.js' -WorkingDirectory $appDir -WindowStyle Hidden; Start-Sleep -Seconds 2 }"

start "" "%APP_URL%"
