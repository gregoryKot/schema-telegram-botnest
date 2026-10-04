#!/bin/bash
# Восстановление зашифрованного бэкапа Postgres — обратная операция к
# scripts/backup-to-b2.sh.
#
# «Бэкап без проверенного restore — не бэкап» (аудит тестовых практик
# 2026-08): этот скрипт гоняет nightly.yml (джоба backup-restore, настоящий
# Postgres) и src/infra/backup-restore.spec.ts (round-trip и негативные пробы).
#
# Формат файла (см. backup-to-b2.sh) — стандартный openssl:
#   `openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt`
#   = «Salted__» + 8 байт соли + шифртекст gzip(дамп). Ручками то же самое:
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_ENCRYPTION_KEY \
#     < schemehappens-2026-10-04.sql.gz.enc | gunzip > dump.sql
#
# Использование:
#   BACKUP_ENCRYPTION_KEY=<ключ бэкапов> bash scripts/restore-backup.sh \
#     <file.sql.gz.enc> [DATABASE_URL]
#
# Рядом с файлом лежит <file>.sha256 (скачай его из бакета вместе с бэкапом) —
# если он есть, сумма сверяется ДО расшифровки: повреждённая при скачивании
# копия отсекается с понятной ошибкой, а не мусором из gunzip.
#
# Без DATABASE_URL — только раскладывает файл в <file>.sql рядом с исходным.
# С DATABASE_URL — дополнительно заливает SQL в указанную БД (psql,
# ON_ERROR_STOP=1 — первая же ошибка останавливает заливку, а не доезжает до
# конца с половиной данных). Пароль БД идёт через PG*-переменные, не аргументом.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ITER=200000

: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY required (ключ, которым шифровали бэкап; не ENCRYPTION_KEY)}"

ENC_FILE="${1:?Usage: restore-backup.sh <file.sql.gz.enc> [DATABASE_URL]}"
TARGET_URL="${2:-}"

if [ ! -f "$ENC_FILE" ]; then
  echo "[restore] ERROR: файл не найден: $ENC_FILE" >&2
  exit 1
fi

# «Salted__» + 8 байт соли = 16 байт заголовка; без шифртекста файл бессмыслен.
FILESIZE=$(wc -c < "$ENC_FILE")
if [ "$FILESIZE" -le 16 ]; then
  echo "[restore] ERROR: файл короче заголовка openssl — не похоже на зашифрованный бэкап ($FILESIZE байт)" >&2
  exit 1
fi

if [ -f "$ENC_FILE.sha256" ]; then
  EXPECTED=$(cut -d' ' -f1 < "$ENC_FILE.sha256")
  ACTUAL=$(sha256sum "$ENC_FILE" | cut -d' ' -f1)
  if [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "[restore] ERROR: контрольная сумма не совпала с $ENC_FILE.sha256 — файл повреждён или подменён" >&2
    exit 1
  fi
  echo "[restore] контрольная сумма сошлась"
else
  echo "[restore] WARN: $ENC_FILE.sha256 не найден — целостность файла не проверена" >&2
fi

case "$ENC_FILE" in
  *.sql.gz.enc) OUT_SQL="${ENC_FILE%.sql.gz.enc}.sql" ;;
  *) OUT_SQL="$ENC_FILE.restored.sql" ;;
esac

echo "[restore] расшифровываю и распаковываю..."
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter "$ITER" -pass env:BACKUP_ENCRYPTION_KEY < "$ENC_FILE" \
  | gunzip > "$OUT_SQL"; then
  echo "[restore] ERROR: расшифровка/распаковка упала — неверный BACKUP_ENCRYPTION_KEY или повреждённый файл" >&2
  rm -f "$OUT_SQL"
  exit 1
fi

if [ ! -s "$OUT_SQL" ]; then
  echo "[restore] ERROR: результат восстановления пустой — неверный ключ или повреждённый файл" >&2
  rm -f "$OUT_SQL"
  exit 1
fi

echo "[restore] дамп восстановлен: $OUT_SQL"

if [ -n "$TARGET_URL" ]; then
  PG_EXPORTS=$(DATABASE_URL="$TARGET_URL" node "$HERE/../deploy/pg-url-env.cjs") || exit 1
  eval "$PG_EXPORTS"
  echo "[restore] заливаю в целевую БД..."
  psql -v ON_ERROR_STOP=1 -f "$OUT_SQL"
  echo "[restore] готово — БД заполнена из $OUT_SQL"
fi
