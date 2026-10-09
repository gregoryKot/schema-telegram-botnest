#!/bin/bash
# Настройка ssh на раннере GitHub Actions: алиас `vps` в ~/.ssh/config. Зовут
# deploy-vps.yml и vps.yml; значения секретов приходят в переменных окружения,
# в вывод не попадают (адрес сервера GitHub дополнительно маскирует сам).
#   DEPLOY_HOST          адрес сервера
#   DEPLOY_SSH_KEY       приватный ключ пользователя root на сервере
#   DEPLOY_KNOWN_HOSTS   (необязательно) строки known_hosts сервера. Нет — отпечаток
#                        берётся ssh-keyscan'ом при каждом запуске, то есть
#                        подмену сервера в сети между раннером и VPS он не поймает.
set -Eeuo pipefail
: "${DEPLOY_HOST:?}" "${DEPLOY_SSH_KEY:?}"

umask 077
mkdir -p ~/.ssh
printf '%s\n' "$DEPLOY_SSH_KEY" > ~/.ssh/id_deploy

if [ -n "${DEPLOY_KNOWN_HOSTS:-}" ]; then
  printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > ~/.ssh/known_hosts
else
  echo "::warning::DEPLOY_KNOWN_HOSTS не задан: отпечаток сервера берётся ssh-keyscan'ом и не защищает от подмены по дороге. Положите в секрет вывод ssh-keyscan, снятый с доверенной сети."
  ssh-keyscan -T 15 -t ed25519,rsa,ecdsa "$DEPLOY_HOST" > ~/.ssh/known_hosts 2>/dev/null
  [ -s ~/.ssh/known_hosts ] || { echo "::error::ssh-keyscan не получил ключ сервера (порт 22 закрыт? сервер выключен?)"; exit 1; }
fi

cat > ~/.ssh/config <<CONF
Host vps
  HostName ${DEPLOY_HOST}
  User root
  IdentityFile ~/.ssh/id_deploy
  IdentitiesOnly yes
  UserKnownHostsFile ~/.ssh/known_hosts
  StrictHostKeyChecking yes
  BatchMode yes
  ServerAliveInterval 20
  ServerAliveCountMax 6
  ConnectTimeout 20
CONF
chmod 600 ~/.ssh/config
