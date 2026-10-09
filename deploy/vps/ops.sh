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

# Запрос к базе в db-контейнере; при сбое печатает заглушку, а не падает.
q() { dc exec -T db psql -U postgres -d schemehappens -X -q -t -A -c "$1" 2> /dev/null || echo "нет данных (таблицы нет?)"; }

print_counts() {
  log "строк в _prisma_migrations: $(q 'SELECT count(*) FROM _prisma_migrations')"
  log "строк в \"User\": $(q 'SELECT count(*) FROM "User"')"
}

cmd_transfer_check() {
  print_counts
  log "последние миграции:"
  q 'SELECT migration_name FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3'
}

# Скрипт для контейнера app: скачать свежий бэкап из B2 и залить в базу. Ошибки
# psql фильтруются до строк с ERROR/FATAL (CONTEXT/DETAIL несут значения из
# таблиц, а логи Actions публичны); весь остальной вывод заливки уходит в файл.
# shellcheck disable=SC2016  # переменные раскрывает bash внутри контейнера, не здесь
RESTORE_B2_INNER='set -Eeuo pipefail
d=$(mktemp -d)
bash scripts/fetch-latest-b2.sh "$d"
f=$(ls "$d"/*.sql.gz.enc)
if ! bash scripts/restore-backup.sh "$f" "$DATABASE_URL" > "$d/out" 2> "$d/err"; then
  grep -hE "ERROR|FATAL" "$d/err" | cut -c1-200 | head -5 >&2 || true
  echo "[restore-b2] заливка не прошла" >&2
  exit 1
fi
grep -hE "^\[restore\] (контрольная|готово)" "$d/out" || true
echo "[restore-b2] восстановлен файл: $(basename "$f")"'

# План Б (docs/MIGRATION_VPS.md): основная база недоступна, поднимаем из
# ночного бэкапа в B2. Только в пустую базу и только пока приложение держит
# HOLD_APP; после успеха флаг остаётся (приложение поднимает release-hold).
cmd_restore_b2() {
  lock
  require_ready
  [ -e HOLD_APP ] || die "нужен HOLD_APP (op=transfer-open или свежий bootstrap): восстанавливать можно только при остановленном приложении"
  { [ -s image ] && [ -s release ]; } || die "релиза нет: сначала деплой (push в main или deploy-vps.yml), контейнеру восстановления нужен образ приложения"
  dc up -d db
  wait_db || die "Postgres не поднялся"
  local tables
  tables=$(dc exec -T db psql -U postgres -d schemehappens -X -q -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')") \
    || die "не прочитать список таблиц в базе"
  [ "$tables" = "0" ] || die "ОТКАЗ: в базе уже есть таблицы (всего $tables), заливку не начинаю, ничего не изменено"
  log "база пуста, качаю свежий бэкап из B2 и заливаю"
  # -T: у ssh из Actions нет tty; --entrypoint обходит CMD образа (entrypoint.mjs
  # поднял бы приложение); --no-deps: db уже поднята и проверена.
  if ! dc run --rm --no-deps -T --entrypoint bash app -c "$RESTORE_B2_INNER"; then
    # Приёмник до заливки был пуст (проверено выше): убираем только свой огрызок.
    dc exec -T db psql -U postgres -d schemehappens -X -q -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public' > /dev/null 2>&1 \
      || log "не удалось сбросить неполную заливку: очистите базу вручную перед повтором"
    die "восстановление из B2 не удалось, неполная заливка сброшена; причина в строках выше"
  fi
  print_counts
  local migs
  migs=$(q 'SELECT count(*) FROM _prisma_migrations')
  [[ "$migs" =~ ^[0-9]+$ ]] && [ "$migs" -gt 0 ] || die "после заливки в _prisma_migrations нет строк: бэкап не похож на базу приложения"
  log "восстановлено, HOLD_APP остаётся. Дальше: op=transfer-check, затем op=release-hold (или внешняя база для Amvera: op=external-db-check)"
}

# Строка подключения для приложения на Amvera: те же параметры, что в
# docs/MIGRATION_VPS.md. sslmode=require + uselibpqcompat=true: node-pg иначе
# проверяет сертификат как verify-full и падает на самоподписанном; sslaccept —
# то же для Rust-движка Prisma (migrate deploy).
EXTERNAL_DB_QUERY='sslmode=require&uselibpqcompat=true&sslaccept=accept_invalid_certs'

public_ip() {
  local ip="${OPS_PUBLIC_IP:-}"
  # OPS_PUBLIC_IP — только для теста (src/infra/vps-ops.spec.ts).
  [ -n "$ip" ] || ip=$(curl -fsS --max-time 10 https://api.ipify.org 2> /dev/null || true)
  [[ "$ip" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] \
    || ip=$(ip -4 -o addr show scope global 2> /dev/null | awk '{ sub(/\/.*/, "", $4); print $4; exit }')
  [[ "$ip" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || return 1
  printf '%s' "$ip"
}

# Проверяет ровно ту строку, которую владелец поставит в Amvera, но изнутри
# контейнера приложения на хосте сервера (--network host): дорога до порта
# 5432 та же, что у внешнего клиента, кроме сети провайдера. Пароль и URL не
# печатаются (см. external-db-check.sh).
cmd_external_db_check() {
  require_ready
  { [ -s image ] && [ -s release ]; } || die "релиза нет: сначала деплой, проверке нужен образ приложения"
  [ -e TRANSFER_OPEN ] || die "порт 5432 закрыт: сначала op=transfer-open"
  [ -f external-db-check.sh ] || die "нет external-db-check.sh рядом с ops.sh"
  local ip pw
  ip=$(public_ip) || die "не определить публичный IP сервера"
  pw=$(grep -m1 '^POSTGRES_PASSWORD=' db.env | cut -d= -f2-)
  [[ "$pw" =~ ^[A-Za-z0-9._~-]+$ ]] || die "пароль в db.env пуст или с символами, которые надо кодировать в URL"
  log "проверяю подключение к $ip:5432 так, как будет подключаться Amvera"
  # URL с паролем живёт только в окружении этого процесса: в аргументы docker
  # (а значит, в ps и логи) он не попадает, `-e DATABASE_URL` берёт его отсюда.
  DATABASE_URL="postgresql://postgres:${pw}@${ip}:5432/schemehappens?${EXTERNAL_DB_QUERY}" \
    docker run --rm --network host -e DATABASE_URL \
    -v "$BASE/external-db-check.sh:/tmp/external-db-check.sh:ro" \
    --entrypoint bash "$(cat image):$(cat release)" /tmp/external-db-check.sh \
    || die "проверка внешнего подключения не прошла, причина в строках выше"
  log "внешнее подключение работает"
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
  restore-b2) cmd_restore_b2 ;;
  external-db-check) cmd_external_db_check ;;
  release-hold) cmd_release_hold ;;
  *) die "неизвестная операция" ;;
esac
