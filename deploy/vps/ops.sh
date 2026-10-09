#!/bin/bash
# Фиксированные операции над сервером. Запускается на VPS из GitHub Actions
# (deploy-vps.yml и vps.yml) через ssh: `bash /opt/schemehappens/ops.sh <op>`.
# Произвольного шелла здесь нет: список операций закрыт `case` внизу.
#
# ЛОГИ ACTIONS ПУБЛИЧНЫ (репозиторий открытый). Поэтому скрипт печатает только
# статусы, числа, sha коммитов и имена миграций: ни env, ни логов приложения,
# ни строк из таблиц. `set -x` не использовать.
#
# Состояние сервера (файлы в /opt/schemehappens):
#   image, release, release.prev   образ и sha текущего/предыдущего релиза
#   HOLD_APP                       пока файл есть, app не стартует (идёт перенос БД)
#   TRANSFER_OPEN                  порт Postgres открыт наружу (см. dc.sh)
set -Eeuo pipefail

BASE="${SCHEMEHAPPENS_DIR:-/opt/schemehappens}"
cd "$BASE"

log() { echo "[ops] $*"; }
die() { echo "[ops] ОШИБКА: $*" >&2; exit 1; }
dc() { bash ./dc.sh "$@"; }
short() { cut -c1-12; }

# Изменяющие операции не перемешиваются (деплой по пушу и ручной запуск).
lock() {
  exec 9> .ops.lock
  flock -w 900 9 || die "другая операция держит блокировку больше 15 минут"
}

health_body() {
  timeout 15 bash ./dc.sh exec -T app node -e \
    "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(t=>process.stdout.write(t)).catch(()=>process.exit(1))" \
    2>/dev/null || true
}

# Ждёт {"status":"ok"} от приложения. Страница техработ тоже отвечает 200, но
# такого маркера в ней нет, поэтому смотрим на тело, а не на код.
health_wait() {
  # OPS_HEALTH_LIMIT/OPS_HEALTH_POLL — только для теста (src/infra/vps-ops.spec.ts).
  local limit=${OPS_HEALTH_LIMIT:-$1} poll=${OPS_HEALTH_POLL:-5} waited=0 body
  while [ "$waited" -lt "$limit" ]; do
    body=$(health_body)
    if [[ "$body" == *'"status":"ok"'* ]]; then
      log "приложение здорово: $(printf '%s' "$body" | cut -c1-300)"
      return 0
    fi
    if [ $((waited % 30)) -eq 0 ] && [ "$poll" -ge 5 ]; then log "жду здоровья приложения (${waited}с из ${limit}с)"; fi
    sleep "$poll"
    waited=$((waited + poll))
  done
  log "приложение не стало здоровым за ${limit}с"
  return 1
}

start_app() {
  dc up -d --remove-orphans db caddy app
  health_wait 300
}

# Возвращает release.prev. После отката prev стирается: повторный rollback не
# должен вернуть только что откатанный релиз.
rollback_release() {
  [ -s release.prev ] || { log "откатываться некуда: нет release.prev"; return 1; }
  local bad
  bad=$(cat release)
  cat release.prev > release
  rm -f release.prev
  log "ОТКАТ: $(echo "$bad" | short) -> $(short < release)"
  dc up -d app || { log "образ предыдущего релиза не поднялся (нет на диске?)"; return 1; }
  health_wait 180
}

# Оставляем образы текущего и предыдущего релиза, остальные чистим: диск не
# резиновый, а откат без образа на диске требует входа в ghcr.
prune_images() {
  local keep ref
  keep=" $(cat release) $(cat release.prev 2>/dev/null || true) "
  while read -r ref; do
    [[ "$keep" == *" ${ref##*:} "* ]] || docker rmi "$ref" > /dev/null 2>&1 || true
  done < <(docker images --format '{{.Repository}}:{{.Tag}}' "$(cat image)")
  docker image prune -f > /dev/null 2>&1 || true
}

require_ready() {
  [ -f db.env ] || die "нет db.env: сначала op=bootstrap"
  [ -f .env ] || die "нет .env: его пишет deploy-vps.yml из секрета PROD_ENV"
  [ -f docker-compose.yml ] || die "нет docker-compose.yml"
}

cmd_deploy() {
  local image=${1:?image} sha=${2:?sha} actor=${3:?actor} token
  [[ "$image" =~ ^ghcr\.io/[a-z0-9._/-]+$ ]] || die "странное имя образа"
  [[ "$sha" =~ ^[0-9a-f]{7,40}$ ]] || die "странный sha"
  IFS= read -r token || true
  [ -n "$token" ] || die "токен ghcr не передан на stdin"
  lock
  require_ready

  # Вход в ghcr живёт во временном DOCKER_CONFIG и стирается сразу после pull.
  DOCKER_CONFIG=$(mktemp -d)
  export DOCKER_CONFIG
  trap 'rm -rf "${DOCKER_CONFIG:-/nonexistent}"' EXIT
  printf '%s' "$token" | docker login ghcr.io -u "$actor" --password-stdin > /dev/null 2>&1 \
    || die "вход в ghcr не удался"
  APP_IMAGE="$image:$sha" dc pull --quiet app || die "образ $sha не скачался"
  docker logout ghcr.io > /dev/null 2>&1 || true
  rm -rf "$DOCKER_CONFIG"
  unset DOCKER_CONFIG

  local cur=""
  [ -s release ] && cur=$(cat release)
  if [ -n "$cur" ] && [ "$cur" != "$sha" ]; then cp release release.prev; fi
  printf '%s' "$sha" > release
  printf '%s' "$image" > image
  log "релиз: $(echo "$sha" | short) (предыдущий: $(short 2> /dev/null < release.prev || echo нет))"

  if [ -e HOLD_APP ]; then
    dc up -d --remove-orphans db caddy
    log "HOLD_APP: приложение намеренно не запущено (перенос данных не закончен); релиз записан, op=release-hold его поднимет"
    prune_images
    return 0
  fi
  if start_app; then
    prune_images
    return 0
  fi
  rollback_release || true
  die "деплой не удался, джоба красная"
}

cmd_write_env() {
  umask 077
  local tmp bad total kept
  tmp=$(mktemp .env.XXXXXX)
  # Строки базы и переноса из старого окружения отбрасываем: адрес базы задаёт
  # docker-compose.yml, а RECOVER_CMD/TRANSFER_TARGET_URL запустили бы перенос
  # на новом сервере. Пустые строки и комментарии тоже убираем.
  tr -d '\r' | grep -Ev '^[[:space:]]*(#|$)' > "$tmp" || true
  bad=$(grep -nEv '^[A-Za-z_][A-Za-z0-9_]*=' "$tmp" | cut -d: -f1 | tr '\n' ' ' || true)
  [ -z "$bad" ] || { rm -f "$tmp"; die "в PROD_ENV строки не вида KEY=value (номера строк после чистки: $bad)"; }
  total=$(wc -l < "$tmp")
  grep -Ev '^(DATABASE_URL|RECOVER_CMD|TRANSFER_TARGET_URL)=' "$tmp" > "$tmp.f" || true
  mv -f "$tmp.f" "$tmp"
  rm -f "$tmp.f"
  kept=$(wc -l < "$tmp")
  [ "$kept" -gt 0 ] || { rm -f "$tmp"; die "PROD_ENV пуст"; }
  chmod 600 "$tmp"
  mv -f "$tmp" .env
  log ".env записан: переменных $kept, отброшено $((total - kept)) (DATABASE_URL/RECOVER_CMD/TRANSFER_TARGET_URL)"
}

cmd_status() {
  log "release: $(short 2> /dev/null < release || echo нет), prev: $(short 2> /dev/null < release.prev || echo нет)"
  log "HOLD_APP: $([ -e HOLD_APP ] && echo есть || echo нет), TRANSFER_OPEN: $([ -e TRANSFER_OPEN ] && echo есть || echo нет)"
  dc ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}' || true
  uptime
  free -m
  df -h /
  local body
  body=$(health_body)
  if [ -n "$body" ]; then log "health: $(printf '%s' "$body" | cut -c1-300)"; else log "health: приложение не отвечает"; fi
}

cmd_restart_app() {
  lock
  [ ! -e HOLD_APP ] || die "HOLD_APP: приложение не должно работать до конца переноса"
  dc restart app
  health_wait 300 || die "приложение не поднялось после перезапуска"
}

# После переключения DNS Caddy мог уже раз-другой не выпустить сертификат (хост
# ещё смотрел на старый сервер) и ждёт следующей попытки: перезапуск начинает
# выпуск заново, не дожидаясь паузы.
cmd_restart_caddy() {
  lock
  dc restart caddy
  log "caddy перезапущен: выпуск сертификатов для хостов, чей DNS уже на этом сервере, пойдёт заново"
}

cmd_rollback() {
  lock
  [ ! -e HOLD_APP ] || die "HOLD_APP: приложение не должно работать до конца переноса"
  rollback_release || die "откат не удался"
}

wait_db() {
  for _ in $(seq 1 30); do
    if dc exec -T db pg_isready -U postgres -d schemehappens > /dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

cmd_transfer_open() {
  lock
  touch HOLD_APP TRANSFER_OPEN
  dc stop app > /dev/null 2>&1 || true
  dc up -d db
  wait_db || die "Postgres не поднялся"
  log "HOLD_APP поставлен, порт 5432 открыт наружу по TLS. Пароль — в db.env на сервере. Закрыть: op=transfer-close"
}

cmd_transfer_close() {
  lock
  rm -f TRANSFER_OPEN
  dc up -d db
  wait_db || die "Postgres не поднялся"
  if dc port db 5432 > /dev/null 2>&1; then die "порт 5432 всё ещё опубликован"; fi
  log "порт 5432 снаружи закрыт"
}

cmd_transfer_check() {
  q() { dc exec -T db psql -U postgres -d schemehappens -X -q -t -A -c "$1" 2> /dev/null || echo "нет данных (таблицы нет?)"; }
  log "строк в _prisma_migrations: $(q 'SELECT count(*) FROM _prisma_migrations')"
  log "строк в \"User\": $(q 'SELECT count(*) FROM "User"')"
  log "последние миграции:"
  q 'SELECT migration_name FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3'
}

cmd_release_hold() {
  lock
  require_ready
  [ -s release ] || die "релиза нет: сначала деплой (push в main или deploy-vps.yml)"
  rm -f HOLD_APP
  log "HOLD_APP снят"
  if start_app; then prune_images; return 0; fi
  rollback_release || true
  die "приложение не поднялось"
}

case "${1:-}" in
  deploy) shift; cmd_deploy "$@" ;;
  write-env) cmd_write_env ;;
  status) cmd_status ;;
  restart-app) cmd_restart_app ;;
  restart-caddy) cmd_restart_caddy ;;
  rollback) cmd_rollback ;;
  transfer-open) cmd_transfer_open ;;
  transfer-close) cmd_transfer_close ;;
  transfer-check) cmd_transfer_check ;;
  release-hold) cmd_release_hold ;;
  *) die "неизвестная операция" ;;
esac
