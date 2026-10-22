#!/bin/bash
# Ежесуточный зашифрованный бэкап Postgres → Cloudflare R2 (S3-совместимое
# хранилище).
#
# Запускает планировщик deploy/backup-scheduler.cjs (его поднимает
# deploy/entrypoint.mjs после миграций): раз в сутки после 03:00 UTC, на
# каждом деплое при необходимости, под арендой CronLease 'db-backup'. Руками:
#   bash scripts/backup-upload.sh        (с теми же переменными окружения)
#
# Обязательные переменные (Amvera → переменные окружения, см. docs/ENV.md):
#   DATABASE_URL            postgresql://… (та же, что у приложения)
#   BACKUP_ENCRYPTION_KEY   ≥ 32 символов, ОТДЕЛЬНЫЙ от ENCRYPTION_KEY: утечка
#                           ключа бэкапов не должна открывать поля в живой БД
#                           и наоборот. Подстановки ENCRYPTION_KEY нет и не будет.
#                           ХРАНИТЬ ЕЩЁ И ВНЕ AMVERA (менеджер паролей): без
#                           ключа бэкап не расшифровать — а Amvera при аварии
#                           может не отдать и env.
#   BACKUP_S3_ENDPOINT      https://<id аккаунта>.r2.cloudflarestorage.com
#   BACKUP_S3_BUCKET        имя приватного бакета
#   BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY
#                           API-токен R2 с правом Object Read & Write только на
#                           этот бакет (чтение нужно чистке и скачиванию при
#                           аварии, scripts/backup-fetch-latest.sh)
# Необязательные:
#   BACKUP_RETENTION_DAYS   сколько дней хранить (по умолчанию и не больше 30,
#                           минимум 7)
#   BACKUP_S3_REGION        регион подписи (по умолчанию auto — так требует R2)
#   SKIP_UPLOAD=1           режим репетиции restore (nightly.yml, джоба
#                           backup-restore, и src/infra/backup-restore.spec.ts):
#                           переменные хранилища не нужны, файл кладётся в
#                           $BACKUP_OUT_DIR (по умолчанию — текущая директория)
#
# Результат в бакете:
#   schemehappens-YYYY-MM-DD.sql.gz.enc          зашифрованный дамп
#   schemehappens-YYYY-MM-DD.sql.gz.enc.sha256   контрольная сумма (для restore)
# Формат файла: стандартный `openssl enc -aes-256-cbc -pbkdf2 -iter 200000
# -salt` («Salted__» + 8 байт соли + шифртекст gzip(дамп)). Ключ передаётся
# через `-pass env:` и в командной строке процесса не появляется; пароль БД
# тоже — соединение идёт через PG*-переменные (deploy/pg-url-env.cjs).
# Незашифрованный дамп на диск не пишется: pg_dump | gzip | openssl.
#
# Хранение: после успешной загрузки удаляются файлы schemehappens-* возрастом
# BACKUP_RETENTION_DAYS дней и старше (по дате в имени) — право на удаление
# данных доезжает до бэкапов, а не копится вечно. Потолок 30 дней — обещание
# политики конфиденциальности (глава 6): данные, удалённые из базы, исчезают из
# копий за 30 дней. Версионирования у бакета R2 нет: удалённый файл удалён
# целиком.
#
# Вывод: последняя строка stdout — `[backup] ok <файл>`; при сбое stderr
# содержит `[backup] FAILED <причина>` и код выхода ≠ 0.
# Восстановление — scripts/restore-backup.sh; свежий файл из бакета скачивает
# scripts/backup-fetch-latest.sh (общая часть работы с S3 — scripts/s3-api.sh).

set -Eeuo pipefail

SKIP_UPLOAD="${SKIP_UPLOAD:-0}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFIX="schemehappens-"
ITER=200000

fail() {
  echo "[backup] FAILED $*" >&2
  exit 1
}
# Неожиданное падение любой команды — тоже строкой FAILED, чтобы планировщик
# и /stats видели причину, а не голый код выхода.
trap 'echo "[backup] FAILED команда на строке $LINENO завершилась с кодом $?" >&2' ERR

need() { [ -n "${!1:-}" ] || fail "не задана переменная $1"; }

need DATABASE_URL
need BACKUP_ENCRYPTION_KEY
[ "${#BACKUP_ENCRYPTION_KEY}" -ge 32 ] || fail "BACKUP_ENCRYPTION_KEY короче 32 символов"
if [ -n "${ENCRYPTION_KEY:-}" ] && [ "$BACKUP_ENCRYPTION_KEY" = "$ENCRYPTION_KEY" ]; then
  fail "BACKUP_ENCRYPTION_KEY совпадает с ENCRYPTION_KEY — ключ бэкапов обязан быть отдельным"
fi
if [ "$SKIP_UPLOAD" != "1" ]; then
  need BACKUP_S3_ENDPOINT
  need BACKUP_S3_BUCKET
  need BACKUP_S3_ACCESS_KEY_ID
  need BACKUP_S3_SECRET_ACCESS_KEY
fi
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
if ! { [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [ "$RETENTION_DAYS" -ge 7 ]; }; then
  fail "BACKUP_RETENTION_DAYS должно быть целым числом не меньше 7"
fi
# Больше потолка — не отказ (бэкап важнее), а 30 дней и WARN; checkEnv на
# старте тоже назовёт неверный формат.
if [ "$RETENTION_DAYS" -gt 30 ]; then
  echo "[backup] WARN: BACKUP_RETENTION_DAYS=$RETENTION_DAYS больше 30 — храню 30 (обещание политики конфиденциальности)" >&2
  RETENTION_DAYS=30
fi

DATE=$(date -u +%Y-%m-%d)
NAME="$PREFIX$DATE.sql.gz.enc"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
ENC_FILE="$TMP_DIR/$NAME"

# Соединение с БД — через PG*-переменные, а не аргументом pg_dump: пароль не
# попадает в командную строку процесса.
PG_EXPORTS=$(node "$HERE/../deploy/pg-url-env.cjs") || fail "DATABASE_URL не разобрать"
eval "$PG_EXPORTS"

echo "[backup] дамп → gzip → шифрование (AES-256-CBC, PBKDF2 $ITER)..."
pg_dump --no-owner --no-privileges --format=plain |
  gzip -c |
  openssl enc -aes-256-cbc -pbkdf2 -iter "$ITER" -salt -pass env:BACKUP_ENCRYPTION_KEY \
    > "$ENC_FILE"

# Проверка «прочитается ли»: расшифровать, распаковать, убедиться, что внутри
# не пусто. Бэкап, который не открывается, хуже его отсутствия — он успокаивает.
PLAIN_BYTES=$(openssl enc -d -aes-256-cbc -pbkdf2 -iter "$ITER" -pass env:BACKUP_ENCRYPTION_KEY \
  < "$ENC_FILE" | gunzip | wc -c) || fail "созданный бэкап не расшифровывается"
[ "$PLAIN_BYTES" -gt 0 ] || fail "дамп пустой"

sha256_of() { openssl dgst -sha256 -r "$1" | cut -d' ' -f1; }
SHA256=$(sha256_of "$ENC_FILE")
echo "$SHA256  $NAME" > "$ENC_FILE.sha256"

if [ "$SKIP_UPLOAD" = "1" ]; then
  OUT_DIR="${BACKUP_OUT_DIR:-.}"
  mkdir -p "$OUT_DIR"
  cp "$ENC_FILE" "$ENC_FILE.sha256" "$OUT_DIR/"
  echo "[backup] SKIP_UPLOAD=1 — загрузка в хранилище пропущена, файл сохранён локально: $OUT_DIR/$NAME"
  echo "[backup] ok $NAME"
  exit 0
fi

command -v curl > /dev/null 2>&1 || fail "нет curl — загрузить в хранилище нечем"
# Подписанный запрос и список файлов — общие с backup-fetch-latest.sh.
# shellcheck source=scripts/s3-api.sh
source "$HERE/s3-api.sh"

# PutObject. Хранилище само сверяет тело с x-amz-content-sha256 (SHA-256
# файла); сверх того сверяем ETag ответа — MD5 принятого тела.
s3_upload() { # s3_upload <файл> <ключ>
  local file=$1 key=$2 resp etag md5
  md5=$(openssl dgst -md5 -r "$file" | cut -d' ' -f1)
  resp=$(s3_curl PUT "/$key" "$(sha256_of "$file")" --max-time 1800 \
    -H 'Content-Type: application/octet-stream' --data-binary "@$file" \
    -D "$TMP_DIR/put-headers") || fail "S3: загрузка $key не удалась: ${resp:0:200}"
  etag=$(tr -d '\r"' < "$TMP_DIR/put-headers" | awk 'tolower($1) == "etag:" { print $2 }' | tail -n 1)
  [ "$etag" = "$md5" ] || fail "S3: контрольная сумма загруженного $key не совпала (ETag ${etag:-нет})"
}

# Удаляет файлы бэкапов возрастом от срока хранения (по дате в имени): при
# сроке 30 файл живёт не дольше 30 дней.
# Явные `|| return 1` вместо set -e: внутри функции под `||` errexit молчит.
s3_prune() {
  local cutoff key deleted=0 list="$TMP_DIR/list"
  cutoff=$(RETENTION_DAYS="$RETENTION_DAYS" node -e \
    'console.log(new Date(Date.now() - process.env.RETENTION_DAYS * 864e5).toISOString().slice(0, 10))') || return 1
  s3_list "$PREFIX" "$list" || { echo "$S3_ERR" >&2; return 1; }
  while IFS=$'\t' read -r key _; do
    [[ "$key" =~ ^${PREFIX}([0-9]{4}-[0-9]{2}-[0-9]{2})\.sql\.gz\.enc(\.sha256)?$ ]] || continue
    [[ ! "${BASH_REMATCH[1]}" > "$cutoff" ]] || continue
    s3_curl DELETE "/$key" "$EMPTY_SHA256" > /dev/null || return 1
    deleted=$((deleted + 1))
  done < "$list"
  echo "[backup] хранение: удалено файлов возрастом от $RETENTION_DAYS дн. (по $cutoff включительно): $deleted"
}

echo "[backup] загрузка в хранилище (бакет $BACKUP_S3_BUCKET)..."
s3_upload "$ENC_FILE" "$NAME"
s3_upload "$ENC_FILE.sha256" "$NAME.sha256"

# Загрузка уже удалась — сбой хранения не должен делать бэкап «проваленным»
# (иначе планировщик повторял бы его каждый час), но и молчать не должен.
s3_prune || echo "[backup] WARN: чистка старых бэкапов не удалась — повторится в следующий прогон" >&2

echo "[backup] ok $NAME"
