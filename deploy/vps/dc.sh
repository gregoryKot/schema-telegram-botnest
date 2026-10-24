#!/bin/bash
# Обёртка docker compose для /opt/schemehappens: единственный способ звать
# compose на сервере (ops.sh, bootstrap.sh и ручной разбор идут через неё).
# Так состояние сервера читается из одних и тех же файлов, а не из памяти
# того, кто последним набрал команду:
#   db.env         POSTGRES_PASSWORD (создаёт bootstrap.sh, права 600)
#   image, release имя образа и sha коммита → APP_IMAGE=<image>:<release>
#   TRANSFER_OPEN  флаг: подключить docker-compose.transfer.yml (порт 5432 наружу)
# Интерполяция идёт только из db.env: файл .env с переменными приложения для неё
# не используется (на нём `$` в паролях был бы раскрыт).
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

[ -f db.env ] || { echo "[dc] нет db.env: сначала op=bootstrap" >&2; exit 1; }

# Пока релиза нет (после bootstrap, до первого деплоя), compose всё равно
# требует APP_IMAGE для разбора файла. Заглушка безопасна: поднять app с ней
# нельзя, а db/caddy образ приложения не нужен.
if [ -z "${APP_IMAGE:-}" ]; then
  if [ -s image ] && [ -s release ]; then
    APP_IMAGE="$(cat image):$(cat release)"
  else
    APP_IMAGE="registry.invalid/schemehappens-app:not-deployed"
  fi
fi
export APP_IMAGE

files=(-f docker-compose.yml)
if [ -e TRANSFER_OPEN ]; then files+=(-f docker-compose.transfer.yml); fi

exec docker compose --env-file db.env "${files[@]}" "$@"
