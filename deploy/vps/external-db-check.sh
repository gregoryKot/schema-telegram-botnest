#!/bin/bash
# Проверка «достучится ли приложение с Amvera до базы на VPS» — те же три пути,
# которыми ходит прод, с той же строкой подключения. Запускается ВНУТРИ образа
# приложения (docker run --network host из `ops.sh external-db-check`), а не на
# сервере: нужны prisma CLI, node_modules/pg и psql из образа. Адрес базы и
# пароль приходят в DATABASE_URL (из окружения контейнера, не аргументом).
#
# Три проверки:
#   1. `prisma migrate status`: так приложение мигрирует базу на старте
#      (Rust-движку нужен sslaccept). Непримененные миграции — не ошибка, а
#      состояние: старт приложения их применит;
#   2. node-pg `select 1`: так ходит само приложение (@prisma/adapter-pg → pg);
#   3. psql через deploy/pg-url-env.cjs: так ходит бэкап (PGSSLMODE=require).
#
# ЛОГИ ACTIONS ПУБЛИЧНЫ: по каждой проверке печатается «ok» или «ОШИБКА» и первая
# строка ошибки, из которой вычищены пароль, адрес сервера и любые URL; вывод
# `migrate status` фильтруется до статуса и имён миграций. Код выхода 1, если
# хоть одна проверка не прошла.
# APP_DIR — каталог приложения (по умолчанию /app); меняется только в тесте
# (src/infra/vps-external-db-check.spec.ts).
set -u

cd "${APP_DIR:-/app}" || exit 1
[ -n "${DATABASE_URL:-}" ] || { echo "[db-check] ОШИБКА: нет DATABASE_URL" >&2; exit 1; }
export NO_COLOR=1
FAILED=0

# Пароль и адрес достаются из строки подключения, чтобы вычистить их из ошибок.
REST=${DATABASE_URL#*://}
CREDS=${REST%%@*}
PW=${CREDS#*:}
HOST=${REST#*@}
HOST=${HOST%%[:/?]*}

# Первая непустая строка stdin без пароля, адреса и URL, не длиннее 160 знаков.
first_line() {
  local s
  s=$(grep -m1 -v '^[[:space:]]*$' || true)
  if [ -n "$PW" ]; then s=${s//"$PW"/<пароль>}; fi
  if [ -n "$HOST" ]; then s=${s//"$HOST"/<адрес>}; fi
  printf '%s' "$s" | sed -E 's#[a-z]+://[^[:space:]]*#<url>#g' | cut -c1-160
}

report() { # report <номер> <название> <ok|fail> <пояснение>
  if [ "$3" = ok ]; then
    echo "[db-check] $1/3 $2: ok $4"
  else
    echo "[db-check] $1/3 $2: ОШИБКА: $4"
    FAILED=1
  fi
}

# 1. migrate status
out=$(npx --no-install prisma migrate status 2>&1)
if grep -q 'Database schema is up to date' <<< "$out"; then
  report 1 'prisma migrate status' ok 'схема актуальна'
elif grep -q 'have not yet been applied' <<< "$out"; then
  report 1 'prisma migrate status' ok 'соединение есть, есть непримененные миграции (применит старт приложения):'
  grep -E '^[[:space:]]*[0-9]{14}_[A-Za-z0-9_]+[[:space:]]*$' <<< "$out" | head -20 | sed 's/^[[:space:]]*/[db-check]   /'
else
  msg=$(grep -m1 -E 'Error|error|P[0-9]{4}' <<< "$out" | first_line)
  [ -n "$msg" ] || msg=$(first_line <<< "$out")
  report 1 'prisma migrate status' fail "${msg:-нет вывода}"
fi

# 2. node-pg
NODE_CHECK='
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  await c.connect();
  await c.query("select 1");
  const r = await c.query("select ssl from pg_stat_ssl where pid = pg_backend_pid()");
  await c.end();
  console.log(r.rows[0] && r.rows[0].ssl ? "соединение по TLS" : "соединение БЕЗ TLS");
})().catch((e) => { console.error(e.message || String(e)); process.exit(1); });'
if out=$(node -e "$NODE_CHECK" 2>&1); then
  report 2 'node-pg select 1' ok "$(first_line <<< "$out")"
else
  report 2 'node-pg select 1' fail "$(first_line <<< "$out")"
fi

# 3. psql (путь бэкапа)
if env_lines=$(node deploy/pg-url-env.cjs 2>&1); then
  out=$( (eval "$env_lines"; export PGCONNECT_TIMEOUT=15; psql -X -q -t -A -c 'select 1') 2>&1) && res=ok || res=fail
  if [ "$res" = ok ] && [ "$(tr -d '[:space:]' <<< "$out")" = 1 ]; then
    report 3 'psql select 1 (путь бэкапа)' ok ''
  else
    report 3 'psql select 1 (путь бэкапа)' fail "$(first_line <<< "$out")"
  fi
else
  report 3 'psql select 1 (путь бэкапа)' fail 'DATABASE_URL не разобрать'
fi

exit "$FAILED"
