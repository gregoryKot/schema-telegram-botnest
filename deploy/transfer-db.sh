#!/bin/bash
# Разовый перенос боевой БД со старого хостинга (Amvera) на VPS.
#
# Зачем скрипт, а не pg_dump руками: у БД на Amvera нет внешнего доступа, туда
# можно попасть только изнутри контейнера приложения. Владелец ставит в env
# Amvera:
#   RECOVER_CMD=bash deploy/transfer-db.sh
#   TRANSFER_TARGET_URL=postgresql://postgres:<пароль>@<ip VPS>:5432/schemehappens?sslmode=require
# и перезапускает приложение. deploy/entrypoint.mjs после wait-for-db (по
# DATABASE_URL — это источник) исполняет RECOVER_CMD через `sh -c`, ДО
# migrate deploy и до старта приложения. Пошаговый ранбук — docs/MIGRATION_VPS.md.
#
# Источник — DATABASE_URL (так его видит приложение), приёмник —
# TRANSFER_TARGET_URL (Postgres на VPS, открытый наружу по TLS на время
# переноса: `op=transfer-open` в vps.yml). Пароли идут через PG*-переменные
# (deploy/pg-url-env.cjs), не аргументами: в `ps` их нет.
#
# Что делает:
#   1. отказывается, если в приёмнике уже есть ТАБЛИЦЫ (в первую очередь
#      _prisma_migrations): заливка поверх живых данных — необратимая порча;
#   2. pg_dump --no-owner --no-privileges | psql --single-transaction
#      (ON_ERROR_STOP=1 — первая же ошибка останавливает заливку);
#   3. сверяет число строк в _prisma_migrations и "User" у источника и
#      приёмника. В лог идут только числа, содержимого строк в логе нет.
#
# ПОСЛЕ ЛЮБОГО ИСХОДА ПРОЦЕСС НЕ ЗАВЕРШАЕТСЯ. entrypoint игнорирует код выхода
# RECOVER_CMD и идёт дальше: migrate deploy и старт приложения. Если бы скрипт
# вышел (даже нулём), старый хостинг поднял бы бота, и два long-polling'а —
# старый и новый — начали бы выбивать друг друга (409 Conflict), а migrate
# deploy и крон-задачи ушли бы в старую, уже не главную базу. Поэтому и успех,
# и ошибка заканчиваются `sleep`-циклом с понятной строкой в логе. Страницу
# техработ в это время отдаёт front (порт 3000 занят им с первой секунды).
# Повторный запуск безопасен: приёмник уже не пуст → отказ (шаг 1) → снова ждём.
#
# Переменные:
#   DATABASE_URL, TRANSFER_TARGET_URL   обязательны
#   TRANSFER_HOLD=0                     не держать процесс, а выйти с кодом
#                                       (только для теста: src/infra/transfer-db.spec.ts)
#   TRANSFER_ALLOW_NO_TLS=1             разрешить приёмник без TLS (только для теста:
#                                       у Postgres в CI нет сертификата)
# Коды выхода при TRANSFER_HOLD=0: 0 — перенесено и сверено, 1 — ошибка,
# 2 — приёмник не пуст (ничего не тронуто), 3 — неверная конфигурация.

set -Eu -o pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERR_DIR=""

log() { echo "[transfer] $*"; }

cleanup() { [ -z "$ERR_DIR" ] || rm -rf "$ERR_DIR"; return 0; }

# Конец работы при любом исходе. Без TRANSFER_HOLD=0 не возвращается.
finish() {
  local code=$1
  trap - ERR
  cleanup
  if [ "${TRANSFER_HOLD:-1}" = "0" ]; then exit "$code"; fi
  if [ "$code" -eq 0 ]; then
    log "перенос завершён, приложение на этом хостинге намеренно не стартует (бот живёт на новом сервере)"
  else
    log "ПЕРЕНОС НЕ ВЫПОЛНЕН (код $code), приложение на этом хостинге намеренно не стартует; причина в строках выше"
  fi
  # Ребёнка-sleep гасим вместе с собой: иначе он держит открытыми потоки
  # вывода, и тот, кто нас запустил, не дождётся их закрытия.
  local sleeper=""
  trap '[ -z "$sleeper" ] || kill "$sleeper" 2>/dev/null; exit 0' TERM INT
  while :; do sleep 3600 & sleeper=$!; wait "$sleeper"; done
}

die() { local code=$1; shift; log "ОШИБКА: $*" >&2; finish "$code"; }

trap 'log "ОШИБКА: непредвиденный сбой на строке $LINENO" >&2; finish 1' ERR

[ -n "${DATABASE_URL:-}" ] || die 3 "не задана DATABASE_URL (источник)"
[ -n "${TRANSFER_TARGET_URL:-}" ] || die 3 "не задана TRANSFER_TARGET_URL (приёмник)"

SRC_ENV=$(DATABASE_URL="$DATABASE_URL" node "$HERE/pg-url-env.cjs") || die 3 "DATABASE_URL не разобрать"
DST_ENV=$(DATABASE_URL="$TRANSFER_TARGET_URL" node "$HERE/pg-url-env.cjs") || die 3 "TRANSFER_TARGET_URL не разобрать"

# Свои PG*-переменные из окружения процесса не должны подмешиваться к чужому
# соединению: сбрасываем и берём только то, что вытащено из URL.
pg_clean() { unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSSLMODE PGCONNECT_TIMEOUT PGSERVICE PGOPTIONS; }
src() { ( pg_clean; eval "$SRC_ENV"; "$@" ); }
dst() { ( pg_clean; eval "$DST_ENV"; export PGSSLMODE="${PGSSLMODE:-require}" PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}"; "$@" ); }
sql() { psql -X -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }

# Приёмник по сети — только с TLS. Самоподписанного сертификата хватает
# (require шифрует, но не проверяет цепочку).
DST_SSLMODE=$(dst printenv PGSSLMODE)
case "$DST_SSLMODE" in
  require|verify-ca|verify-full) ;;
  *) [ "${TRANSFER_ALLOW_NO_TLS:-0}" = "1" ] || die 3 "TRANSFER_TARGET_URL: sslmode обязан быть require (или строже), сейчас «$DST_SSLMODE»" ;;
esac

# Шаг 1: приёмник должен быть пуст.
DST_STATE=$(dst sql "SELECT count(*) || ' ' || count(*) FILTER (WHERE table_name = '_prisma_migrations') FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')") \
  || die 1 "приёмник недоступен (адрес, пароль, TLS, порт 5432 на VPS открыт ли через transfer-open)"
read -r DST_TABLES DST_HAS_MIG <<< "$DST_STATE"
if [ "$DST_TABLES" != "0" ]; then
  log "ОТКАЗ: в приёмнике уже есть таблицы (всего $DST_TABLES, из них _prisma_migrations: $DST_HAS_MIG) — заливку не начинаю, ничего не изменено" >&2
  finish 2
fi

counts() { # $1 = src|dst → «миграций пользователей»
  "$1" sql "SELECT (SELECT count(*) FROM _prisma_migrations) || ' ' || (SELECT count(*) FROM \"User\")"
}

counts src > /dev/null || die 1 "источник не похож на базу приложения: нет _prisma_migrations или \"User\" (или нет доступа)"

# Шаг 2: дамп и заливка одной транзакцией.
ERR_DIR=$(mktemp -d)
log "заливаю дамп в приёмник..."
STATUS=(0 0)
src pg_dump --no-owner --no-privileges 2> "$ERR_DIR/dump" \
  | dst psql -X -q -v ON_ERROR_STOP=1 --single-transaction -o /dev/null 2> "$ERR_DIR/psql" \
  || STATUS=("${PIPESTATUS[@]}")
if [ "${STATUS[0]}" -ne 0 ] || [ "${STATUS[1]}" -ne 0 ]; then
  # В лог идут только строки с ошибкой, обрезанные: DETAIL/CONTEXT могут нести значения из таблиц.
  { grep -h -E '(error|ERROR|FATAL)' "$ERR_DIR/dump" "$ERR_DIR/psql" | cut -c1-200 | head -5; } >&2 || true
  # pg_dump мог оборваться посреди потока, а psql на EOF фиксирует то, что успел
  # получить. Приёмник до заливки был пуст (шаг 1) — убираем только свой огрызок.
  log "pg_dump=${STATUS[0]} psql=${STATUS[1]}; сбрасываю неполную заливку в приёмнике" >&2
  dst sql "DROP SCHEMA public CASCADE; CREATE SCHEMA public" > /dev/null \
    || log "не удалось сбросить неполную заливку: перед повтором очистите базу в приёмнике вручную" >&2
  die 1 "дамп или заливка не прошли"
fi

# Шаг 3: сверка чисел.
SRC_COUNTS=$(counts src) || die 1 "не прочитать числа из источника после дампа"
DST_COUNTS=$(counts dst) || die 1 "не прочитать числа из приёмника после заливки"
log "источник: миграций/пользователей = ${SRC_COUNTS/ //}"
log "приёмник: миграций/пользователей = ${DST_COUNTS/ //}"
[ "$SRC_COUNTS" = "$DST_COUNTS" ] || die 1 "числа не сошлись (источник «$SRC_COUNTS», приёмник «$DST_COUNTS»)"

log "сверка сошлась"
finish 0
