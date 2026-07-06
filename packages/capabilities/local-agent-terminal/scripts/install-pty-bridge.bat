@echo off
REM install-pty-bridge.bat — register the PTY bridge daemon to run at logon.
REM Run once from an elevated prompt. Adjust paths to your checkout.

set REPO=%~dp0..\..\..\..
set NODE_EXE=node
set DAEMON=%REPO%\packages\capabilities\local-agent-terminal\dist\backend\pty-bridge-daemon.js

REM Configure these (or set them as machine env vars):
setx MMD_CLOUD_WS_BASE "wss://your-worker.workers.dev"
setx MMD_DAEMON_STATUS_PORT "5181"

REM Create a logon scheduled task that survives backend restarts.
schtasks /Create /F /SC ONLOGON /RL HIGHEST /TN "MultimarcDownPtyBridge" ^
  /TR "\"%NODE_EXE%\" \"%DAEMON%\""

echo.
echo Installed scheduled task "MultimarcDownPtyBridge".
echo Put your agent secret in: %REPO%\packages\capabilities\local-agent-terminal\backend\data\agent-secret.txt
echo Start now with:  schtasks /Run /TN "MultimarcDownPtyBridge"
