#!/bin/bash
# Первичная настройка чистого VPS (Ubuntu 24.04, любой провайдер). Запускается
# под root: op=bootstrap в vps.yml, либо руками. Идемпотентен: повторный запуск
# ничего не ломает и ничего не пересоздаёт, что уже есть (пароль БД и TLS-ключ
# остаются прежними).
#
# Делает:
#   1. docker + compose plugin из официального репозитория Docker;
#   2. ufw: открыты 22 (и порт sshd, если он другой), 80, 443; 5432 НЕ открыт;
#   3. unattended-upgrades (автоматические обновления безопасности);
#   4. каталог /opt/schemehappens, TLS-сертификат Postgres, db.env с паролем БД;
#   5. на свежем сервере ставит HOLD_APP: приложение не стартует, пока владелец
#      не перенесёт данные (иначе оно прогнало бы migrate deploy на пустой базе,
#      и перенос отказал бы). Снимается op=release-hold.
#
# Лог Actions публичный: печатаем только статусы, секретов (пароль БД) в выводе нет.
set -Eeuo pipefail

# Корни переопределяются только в тесте (src/infra/vps-bootstrap.spec.ts): на
# сервере обе переменные не заданы, и пути такие, как были.
BASE="${SCHEMEHAPPENS_DIR:-/opt/schemehappens}"
ETC="${BOOTSTRAP_ETC:-/etc}"
export DEBIAN_FRONTEND=noninteractive

log() { echo "[bootstrap] $*"; }
die() { echo "[bootstrap] ОШИБКА: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "нужен root"
# shellcheck disable=SC1090,SC1091
[ -r "$ETC/os-release" ] && . "$ETC/os-release"
[ "${ID:-}" = "ubuntu" ] || die "рассчитано на Ubuntu 24.04, а тут «${ID:-?}»"

# ── 1. Пакеты и Docker ───────────────────────────────────────────────────────
log "apt: базовые пакеты"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg openssl ufw unattended-upgrades util-linux > /dev/null

if ! docker compose version > /dev/null 2>&1; then
  log "Docker: официальный репозиторий"
  install -m 0755 -d "$ETC/apt/keyrings"
  curl -fsSL --retry 3 https://download.docker.com/linux/ubuntu/gpg -o "$ETC/apt/keyrings/docker.asc" \
    || die "download.docker.com недоступен с этого сервера (провайдер блокирует?); поставьте Docker с compose-плагином 2.30+ вручную и повторите"
  chmod a+r "$ETC/apt/keyrings/docker.asc"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=$ETC/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > "$ETC/apt/sources.list.d/docker.list"
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null
fi
systemctl enable --now docker > /dev/null 2>&1 || true

# Зеркало Docker Hub: из РФ прямые запросы к registry-1.docker.io бывают
# нестабильны. Зеркало подстраховывает (при его отказе Docker идёт в сам Hub).
# Файл не трогаем, если он уже есть: там могут быть настройки владельца.
if [ ! -f "$ETC/docker/daemon.json" ]; then
  log "Docker: зеркало Docker Hub (mirror.gcr.io)"
  echo '{ "registry-mirrors": ["https://mirror.gcr.io"] }' > "$ETC/docker/daemon.json"
  systemctl restart docker
fi

# docker-compose.yml использует `env_file: format: raw` (Compose 2.30+).
COMPOSE_VERSION=$(docker compose version --short | sed 's/^v//')
if [ "$(printf '%s\n2.30.0\n' "$COMPOSE_VERSION" | sort -V | head -n1)" != "2.30.0" ]; then
  die "Compose $COMPOSE_VERSION старше 2.30: обновите docker-compose-plugin"
fi
log "Docker $(docker --version | cut -d' ' -f3 | tr -d ,), Compose $COMPOSE_VERSION"

# ── 2. Фаервол ───────────────────────────────────────────────────────────────
# Порты, опубликованные Docker'ом, ufw обходит. 5432 защищён тем, что
# docker-compose.yml его не публикует (только override на время переноса).
log "ufw"
SSH_PORTS=$( (sshd -T 2> /dev/null | awk '$1 == "port" { print $2 }') || true)
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
for p in 22 ${SSH_PORTS}; do ufw limit "${p}/tcp" > /dev/null; done
ufw allow 80/tcp > /dev/null
ufw allow 443 > /dev/null
ufw --force enable > /dev/null
ufw status | head -n1

# ── 3. Автоматические обновления безопасности ────────────────────────────────
log "unattended-upgrades"
cat > "$ETC/apt/apt.conf.d/20auto-upgrades" <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

# ── 4. Каталог, TLS Postgres, пароль БД ──────────────────────────────────────
install -d -m 755 "$BASE"
install -d -m 755 "$BASE/pg-tls"

if [ ! -s "$BASE/pg-tls/server.key" ] || [ ! -s "$BASE/pg-tls/server.crt" ]; then
  log "TLS Postgres: самоподписанный сертификат на 10 лет"
  openssl req -x509 -nodes -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
    -days 3650 -subj "/CN=schemehappens-db" \
    -keyout "$BASE/pg-tls/server.key" -out "$BASE/pg-tls/server.crt" 2> /dev/null
fi
# postgres в образе работает под uid 999 и отказывается читать ключ с правами
# шире 0600 или чужого владельца.
chown 999:999 "$BASE/pg-tls/server.key" "$BASE/pg-tls/server.crt"
chmod 600 "$BASE/pg-tls/server.key"
chmod 644 "$BASE/pg-tls/server.crt"

if [ ! -s "$BASE/db.env" ]; then
  log "db.env: новый пароль БД (в лог не печатается)"
  umask 077
  printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > "$BASE/db.env"
fi
chmod 600 "$BASE/db.env"

# Свежий сервер: данных ещё нет, приложение держим до release-hold.
if [ ! -s "$BASE/release" ] && [ ! -e "$BASE/HOLD_APP" ]; then
  touch "$BASE/HOLD_APP"
  log "HOLD_APP поставлен: приложение не стартует до op=release-hold"
fi

log "готово"
