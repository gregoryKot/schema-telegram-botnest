#!/bin/bash
# Восстановление зашифрованного бэкапа Postgres — обратная операция к
# scripts/backup-to-b2.sh.
#
# Аудит тестовых практик 2026-08 («репетиция restore», см. CLAUDE.md):
# «бэкап без проверенного restore — не бэкап». Инструкция раньше жила только
# в хвостовом комментарии backup-to-b2.sh и была НЕВЕРНА — encrypt-сторона
# кладёт IV как 16 СЫРЫХ БАЙТ (`echo -n "$IV" | xxd -r -p`), а старый
# комментарий читал `head -c 32` как «32 hex-символа» и резал `tail -c +33`.
# По задокументированной процедуре restore отдал бы мусор — воспроизведено
# в src/infra/backup-restore.spec.ts (round-trip + негативные пробы) и в
# nightly.yml (джоба backup-restore, репетиция на настоящем Postgres).
#
# Формат файла (см. scripts/backup-to-b2.sh):
#   [16 сырых байт IV][ciphertext: gzip(dump.sql), зашифрован AES-256-CBC]
#
# Использование:
#   ENCRYPTION_KEY=<64-hex> bash scripts/restore-backup.sh <file.sql.gz.enc> [DATABASE_URL]
#
# Без DATABASE_URL — только раскладывает файл в <file>.sql рядом с исходным.
# С DATABASE_URL — дополнительно заливает восстановленный SQL в указанную БД
# (psql, ON_ERROR_STOP=1 — первая же ошибка SQL останавливает заливку, а не
# молча доезжает до конца с половиной данных).

set -euo pipefail

: "${ENCRYPTION_KEY:?ENCRYPTION_KEY required (тот же 64-hex ключ, которым шифровали бэкап)}"

ENC_FILE="${1:?Usage: restore-backup.sh <file.sql.gz.enc> [DATABASE_URL]}"
TARGET_URL="${2:-}"

if [ ! -f "$ENC_FILE" ]; then
  echo "[restore] ERROR: файл не найден: $ENC_FILE" >&2
  exit 1
fi

FILESIZE=$(wc -c < "$ENC_FILE")
if [ "$FILESIZE" -le 16 ]; then
  echo "[restore] ERROR: файл короче 16 байт IV — не похоже на валидный зашифрованный бэкап ($FILESIZE байт)" >&2
  exit 1
fi

case "$ENC_FILE" in
  *.sql.gz.enc) OUT_SQL="${ENC_FILE%.sql.gz.enc}.sql" ;;
  *) OUT_SQL="$ENC_FILE.restored.sql" ;;
esac

echo "[restore] читаю IV (первые 16 сырых байт файла)..."
# openssl -iv ждёт IV как hex-строку, а на диске (симметрично encrypt-
# стороне) он лежит как 16 СЫРЫХ байт — переводим их в hex через `xxd -p`
# (без -r: -r у xxd означает «hex → raw», здесь нужно обратное). Именно
# смешение этих двух направлений и было багом старой инструкции: там `head
# -c 32` читал 32 БАЙТА (16 IV + 16 начала шифртекста) и выдавал их ЗА
# hex-текст, вместо того чтобы взять 16 байт и перекодировать.
IV=$(head -c 16 "$ENC_FILE" | xxd -p | tr -d '\n')
if [ "${#IV}" -ne 32 ]; then
  echo "[restore] ERROR: не удалось прочитать IV корректно (получено ${#IV} hex-символов, ожидалось 32)" >&2
  exit 1
fi

echo "[restore] расшифровываю и распаковываю..."
if ! tail -c +17 "$ENC_FILE" \
  | openssl enc -d -aes-256-cbc -K "$ENCRYPTION_KEY" -iv "$IV" \
  | gunzip > "$OUT_SQL"; then
  echo "[restore] ERROR: расшифровка/распаковка упала — неверный ENCRYPTION_KEY или повреждённый файл" >&2
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
  echo "[restore] заливаю в $TARGET_URL..."
  psql "$TARGET_URL" -v ON_ERROR_STOP=1 -f "$OUT_SQL"
  echo "[restore] готово — БД заполнена из $OUT_SQL"
fi
