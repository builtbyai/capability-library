#!/usr/bin/env bash
# Install deepseek-router CLIs into ~/.claude/tools/
# Idempotent: overwrites in place, preserves chmod, doesn't touch the key file.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
DEST="${HOME}/.claude/tools"
SECRETS="${HOME}/.claude/secrets"
KEY_FILE="${SECRETS}/deepseek-anthropic.key"

mkdir -p "$DEST" "$SECRETS"

for f in claude-deepseek claude-deepseek.bat ds-cost ds-cost.bat; do
  cp -v "$ROOT/backend/$f" "$DEST/$f"
done
chmod +x "$DEST/claude-deepseek" "$DEST/ds-cost" 2>/dev/null || true

if [[ ! -s "$KEY_FILE" ]]; then
  echo
  echo "NEXT STEP: drop your DeepSeek API key into:"
  echo "  $KEY_FILE"
  echo "Then chmod 600 it. After that, verify with:"
  echo "  $DEST/claude-deepseek --check"
  exit 0
fi

echo
echo "Running health check..."
"$DEST/claude-deepseek" --check
echo "Install OK."
