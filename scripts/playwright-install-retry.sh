#!/usr/bin/env bash
# Ставит браузеры Playwright с потолком времени на попытку и одной повторной попыткой:
# зависшая установка (apt или скачивание) не съедает таймаут всей джобы.
# Использование: scripts/playwright-install-retry.sh chromium webkit
set -uo pipefail

ATTEMPT_SECONDS="${PLAYWRIGHT_INSTALL_ATTEMPT_SECONDS:-180}"

attempt() {
  timeout -k 10 "$ATTEMPT_SECONDS" npx playwright install --with-deps "$@"
}

if attempt "$@"; then
  exit 0
fi
echo "::warning::playwright install не уложился в ${ATTEMPT_SECONDS} с или упал — повторная попытка"
# Осиротевший apt держит замок dpkg и уронил бы вторую попытку.
sudo pkill -x apt-get 2>/dev/null || true
sudo dpkg --configure -a 2>/dev/null || true
attempt "$@"
