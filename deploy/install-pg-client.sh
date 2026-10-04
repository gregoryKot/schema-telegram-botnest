#!/bin/sh
# Клиент Postgres 16 (pg_dump/psql) + curl для зашифрованных бэкапов в B2
# (scripts/backup-to-b2.sh, deploy/backup-scheduler.cjs). Ставится только в
# runtime-стадии образа.
#
# Версия обязана быть 16: pg_dump отказывается снимать дамп с сервера новее
# себя, а Postgres у нас 16. В Debian bookworm свой пакет — 15, поэтому
# репозиторий PGDG (официальный apt.postgresql.org). Ключ репозитория — .asc
# в signed-by (apt в bookworm читает ASCII-armored ключ напрямую, gnupg не нужен).
#
# Сеть билдера Amvera до зарубежных хостов отваливается (08.08.2026 — отказ
# deb.debian.org уронил сборку, см. install-openssl.sh): три попытки, со
# второй — российские зеркала (Debian и PGDG на mirror.yandex.ru). В конце
# обязательная проверка `pg_dump --version` / `psql --version` — образ без
# клиента не должен уехать молча: бэкапы без него не запустятся.
#
# Пути и адреса берутся из переменных: так скрипт проверяется тестом
# (`src/security/install-pg-client.spec.ts`) без настоящего apt.
set -u

MIRROR=${APT_MIRROR:-http://mirror.yandex.ru}
SOURCES=${APT_SOURCES:-"/etc/apt/sources.list /etc/apt/sources.list.d/debian.sources"}
LISTS=${APT_LISTS:-/var/lib/apt/lists}
ATTEMPTS=${APT_ATTEMPTS:-3}
PGDG_URL=${PGDG_URL:-https://apt.postgresql.org/pub/repos/apt}
PGDG_MIRROR_URL=${PGDG_MIRROR_URL:-https://mirror.yandex.ru/mirrors/postgresql/pub/repos/apt}
PGDG_LIST=${PGDG_LIST:-/etc/apt/sources.list.d/pgdg.list}
PGDG_KEY=${PGDG_KEY:-/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc}
OS_RELEASE=${OS_RELEASE:-/etc/os-release}
PG_MAJOR=16

CODENAME=$(. "$OS_RELEASE" && echo "${VERSION_CODENAME:-}")
if [ -z "$CODENAME" ]; then
  echo "install-pg-client: не удалось определить кодовое имя Debian ($OS_RELEASE)" >&2
  exit 1
fi

pgdg_base=$PGDG_URL

use_mirror() {
  for f in $SOURCES; do
    if [ -f "$f" ]; then
      sed -i "s|http://deb.debian.org|$MIRROR|g" "$f"
    fi
  done
  pgdg_base=$PGDG_MIRROR_URL
  return 0
}

# Один заход: curl+ca-certificates → ключ PGDG → список репозитория → клиент.
try_install() {
  apt-get update -y &&
    apt-get install -y --no-install-recommends ca-certificates curl &&
    mkdir -p "$(dirname "$PGDG_KEY")" &&
    curl -fsSL --retry 2 --max-time 60 -o "$PGDG_KEY" "$pgdg_base/ACCC4CF8.asc" &&
    echo "deb [signed-by=$PGDG_KEY] $pgdg_base $CODENAME-pgdg main" > "$PGDG_LIST" &&
    apt-get update -y &&
    apt-get install -y --no-install-recommends "postgresql-client-$PG_MAJOR"
}

installed=''
i=1
while [ "$i" -le "$ATTEMPTS" ]; do
  if try_install; then
    installed=yes
    break
  fi
  echo "install-pg-client: попытка $i не удалась, переключаюсь на зеркала ($MIRROR, $PGDG_MIRROR_URL)"
  use_mirror
  i=$((i + 1))
  sleep 5
done

if [ -z "$installed" ]; then
  echo "install-pg-client: клиент Postgres $PG_MAJOR не поставлен, сборка остановлена" >&2
  exit 1
fi

# Проверяем, а не верим коду возврата: нужна именно 16-я версия обоих клиентов
# и работающий curl (им бэкап ходит в B2).
pg_dump --version | grep -q " $PG_MAJOR[. ]" || { echo "install-pg-client: pg_dump не $PG_MAJOR-й версии" >&2; exit 1; }
psql --version | grep -q " $PG_MAJOR[. ]" || { echo "install-pg-client: psql не $PG_MAJOR-й версии" >&2; exit 1; }
curl --version >/dev/null || exit 1

rm -rf "$LISTS"/*
