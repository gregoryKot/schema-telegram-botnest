#!/bin/sh
# OpenSSL для движка Prisma: node:*-slim идёт без libssl, и без него клиент не
# стартует. Ставится в обеих стадиях образа — build и runtime.
#
# Почему не одна строка `apt-get install`: билдер Amvera периодически теряет
# сеть до deb.debian.org (08.08.2026 — «Cannot initiate the connection …
# Network is unreachable», сборка упала с exit 100, и срочный фикс входа в
# мини-апп не доехал до пользователей). Чужая сеть не должна ронять деплой с
# первой попытки: три попытки, со второй — российское зеркало (билдер стоит в
# Москве), в конце обязательная проверка `openssl version` — чтобы образ не
# уехал молча без библиотеки.
#
# Пути и адреса берутся из переменных: так скрипт проверяется тестом
# (`src/security/install-openssl.spec.ts`) без настоящего apt и без правки
# системных файлов.
set -u

MIRROR=${APT_MIRROR:-http://mirror.yandex.ru}
SOURCES=${APT_SOURCES:-"/etc/apt/sources.list /etc/apt/sources.list.d/debian.sources"}
LISTS=${APT_LISTS:-/var/lib/apt/lists}
ATTEMPTS=${APT_ATTEMPTS:-3}

use_mirror() {
  for f in $SOURCES; do
    if [ -f "$f" ]; then
      sed -i "s|http://deb.debian.org|$MIRROR|g" "$f"
    fi
  done
  return 0
}

installed=''
i=1
while [ "$i" -le "$ATTEMPTS" ]; do
  if apt-get update -y && apt-get install -y --no-install-recommends openssl; then
    installed=yes
    break
  fi
  echo "install-openssl: попытка $i не удалась, переключаюсь на зеркало $MIRROR"
  use_mirror
  i=$((i + 1))
  sleep 5
done

if [ -z "$installed" ]; then
  echo "install-openssl: openssl не поставлен, сборка остановлена" >&2
  exit 1
fi

# Проверяем, а не верим коду возврата: пакет мог «установиться» из протухшего
# индекса. Молча собранный образ без libssl падает уже на проде.
openssl version || exit 1

rm -rf "$LISTS"/*
