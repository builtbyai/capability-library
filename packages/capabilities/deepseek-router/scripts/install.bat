@echo off
REM Install deepseek-router CLIs into %USERPROFILE%\.claude\tools\
setlocal EnableExtensions

set "HERE=%~dp0"
set "ROOT=%HERE%.."
set "DEST=%USERPROFILE%\.claude\tools"
set "SECRETS=%USERPROFILE%\.claude\secrets"
set "KEY_FILE=%SECRETS%\deepseek-anthropic.key"

if not exist "%DEST%"    mkdir "%DEST%"
if not exist "%SECRETS%" mkdir "%SECRETS%"

copy /Y "%ROOT%\backend\claude-deepseek"     "%DEST%\claude-deepseek"     1>nul
copy /Y "%ROOT%\backend\claude-deepseek.bat" "%DEST%\claude-deepseek.bat" 1>nul
copy /Y "%ROOT%\backend\ds-cost"             "%DEST%\ds-cost"             1>nul
copy /Y "%ROOT%\backend\ds-cost.bat"         "%DEST%\ds-cost.bat"         1>nul

if not exist "%KEY_FILE%" (
  echo.
  echo NEXT STEP: drop your DeepSeek API key into:
  echo   %KEY_FILE%
  echo Then run: "%DEST%\claude-deepseek.bat" --check
  exit /b 0
)

echo.
echo Running health check...
call "%DEST%\claude-deepseek.bat" --check
endlocal
