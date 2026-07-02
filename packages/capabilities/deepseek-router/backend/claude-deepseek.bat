@echo off
REM Launch Claude Code routed through DeepSeek's Anthropic-compatible endpoint.
REM Server-side mapping: opus -> deepseek-v4-pro, sonnet/haiku -> deepseek-v4-flash.
REM
REM Usage:
REM   claude-deepseek                       (tier=flash, default)
REM   claude-deepseek --tier pro [args...]
REM   claude-deepseek --tier flash [args...]
REM   claude-deepseek --check               (ping endpoint, exit)

setlocal EnableExtensions EnableDelayedExpansion

set "KEY_FILE=%USERPROFILE%\.claude\secrets\deepseek-anthropic.key"
set "BASE_URL=https://api.deepseek.com/anthropic"

if not exist "%KEY_FILE%" (
  echo claude-deepseek: missing key at %KEY_FILE% 1>&2
  exit /b 1
)
set /p DEEPSEEK_KEY=<"%KEY_FILE%"
if "%DEEPSEEK_KEY%"=="" (
  echo claude-deepseek: key file is empty 1>&2
  exit /b 1
)

set "TIER=flash"
set "DO_CHECK=0"
set "FWD="
:parseloop
if "%~1"=="" goto parsed
if /I "%~1"=="--tier" (
  set "TIER=%~2"
  shift & shift
  goto parseloop
)
if /I "%~1"=="--check" (
  set "DO_CHECK=1"
  shift
  goto parseloop
)
set "FWD=!FWD! %1"
shift
goto parseloop
:parsed

if /I "%TIER%"=="flash" (
  set "MODEL=claude-sonnet-4-6"
  set "DS_MODEL=deepseek-v4-flash"
) else if /I "%TIER%"=="pro" (
  set "MODEL=claude-opus-4-7"
  set "DS_MODEL=deepseek-v4-pro"
) else (
  echo claude-deepseek: --tier must be flash^|pro ^(got '%TIER%'^) 1>&2
  exit /b 2
)

if "%DO_CHECK%"=="1" (
  curl -sS -o "%TEMP%\ds_check.json" -w "%%{http_code}" "%BASE_URL%/v1/messages" -H "content-type: application/json" -H "x-api-key: %DEEPSEEK_KEY%" -H "anthropic-version: 2023-06-01" -d "{\"model\":\"%MODEL%\",\"max_tokens\":20,\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}]}" > "%TEMP%\ds_http.txt"
  set /p HTTP=<"%TEMP%\ds_http.txt"
  if "!HTTP!"=="200" (
    echo claude-deepseek: OK ^(!HTTP!^) tier=%TIER% request_model=%MODEL% 1>&2
    exit /b 0
  )
  echo claude-deepseek: FAIL ^(!HTTP!^) tier=%TIER% 1>&2
  type "%TEMP%\ds_check.json" 1>&2
  exit /b 1
)

set "ANTHROPIC_BASE_URL=%BASE_URL%"
set "ANTHROPIC_AUTH_TOKEN=%DEEPSEEK_KEY%"
set "ANTHROPIC_API_KEY=%DEEPSEEK_KEY%"
set "ANTHROPIC_MODEL=%MODEL%"
set "ANTHROPIC_SMALL_FAST_MODEL="

echo claude-deepseek: tier=%TIER% model=%MODEL% -^> %DS_MODEL% base=%BASE_URL% 1>&2
claude %FWD%
endlocal & exit /b %ERRORLEVEL%
