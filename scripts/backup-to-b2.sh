#!/bin/bash
# Ежесуточный зашифрованный бэкап Postgres → Backblaze B2.
#
# Запускает планировщик deploy/backup-scheduler.cjs (его поднимает
# deploy/entrypoint.mjs после миграций): раз в сутки после 03:00 UTC, на
# каждом деплое при необходимости, под арендой CronLease 'backup-b2'. Руками:
#   bash scripts/backup-to-b2.sh        (с теми же переменными окружения)
#
# Обязательные переменные (Amvera → переменные окружения, см. docs/ENV.md):
#   DATABASE_URL            postgresql://… (та же, что у приложения)
#   BACKUP_ENCRYPTION_KEY   ≥ 32 символов, ОТДЕЛЬНЫЙ от ENCRYPTION_KEY: утечка
#                           ключа бэкапов не должна открывать поля в живой БД
#                           и наоборот. Подстановки ENCRYPTION_KEY нет и не будет.
#                           ХРАНИТЬ ЕЩЁ И ВНЕ AMVERA (менеджер паролей): без
#                           ключа бэкап не расшифровать — а Amvera при аварии
#                           может не отдать и env.
#   B2_KEY_ID, B2_APP_KEY   Backblaze → Application Keys (ключ только на этот
#                           бакет, права: listBuckets, listFiles, writeFiles,
#                           deleteFiles; для скачивания при аварии
#                           scripts/fetch-latest-b2.sh нужно ещё readFiles)
#   B2_BUCKET               имя приватного бакета
# Необязательные:
#   BACKUP_RETENTION_DAYS   сколько дней хранить (по умолчанию 90, минимум 7)
#   SKIP_UPLOAD=1           режим репетиции restore (nightly.yml, джоба
#                           backup-restore, и src/infra/backup-restore.spec.ts):
#                           B2-переменные не нужны, файл кладётся в
#                           $BACKUP_OUT_DIR (по умолчанию — текущая директория)
#   B2_AUTH_URL             адрес b2_authorize_account — только чтобы тест мог
#                           подставить локальный поддельный B2
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
# Хранение: после успешной загрузки удаляются ВСЕ версии файлов
# schemehappens-* старше BACKUP_RETENTION_DAYS (по дате в имени) — право на
# удаление данных доезжает до бэкапов, а не копится вечно.
#
# Вывод: последняя строка stdout — `[backup] ok <файл>`; при сбое stderr
# содержит `[backup] FAILED <причина>` и код выхода ≠ 0.
# Восстановление — scripts/restore-backup.sh; свежий файл из бакета скачивает
# scripts/fetch-latest-b2.sh (общая часть работы с B2 — scripts/b2-api.sh).

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
  need B2_KEY_ID
  need B2_APP_KEY
  need B2_BUCKET
fi
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-90}"
if ! { [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [ "$RETENTION_DAYS" -ge 7 ]; }; then
  fail "BACKUP_RETENTION_DAYS должно быть целым числом не меньше 7"
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

SHA256=$(sha256sum "$ENC_FILE" | cut -d' ' -f1)
echo "$SHA256  $NAME" > "$ENC_FILE.sha256"

if [ "$SKIP_UPLOAD" = "1" ]; then
  OUT_DIR="${BACKUP_OUT_DIR:-.}"
  mkdir -p "$OUT_DIR"
  cp "$ENC_FILE" "$ENC_FILE.sha256" "$OUT_DIR/"
  echo "[backup] SKIP_UPLOAD=1 — аплоад в B2 пропущен, файл сохранён локально: $OUT_DIR/$NAME"
  echo "[backup] ok $NAME"
  exit 0
fi

# ── B2: родной API через curl (в образе нет ни b2, ни aws CLI) ────────────────
# Авторизация, json_get и b2_post — общие с fetch-latest-b2.sh (scripts/b2-api.sh).
# shellcheck source=scripts/b2-api.sh
source "$HERE/b2-api.sh"

b2_upload() { # b2_upload <файл> <имя в бакете>
  local file=$1 name=$2 up url token sha1 resp
  up=$(b2_post b2_get_upload_url "{\"bucketId\":\"$BUCKET_ID\"}") ||
    fail "B2: нет адреса загрузки: ${up:0:200}"
  url=$(printf '%s' "$up" | json_get uploadUrl)
  token=$(printf '%s' "$up" | json_get authorizationToken)
  sha1=$(sha1sum "$file" | cut -d' ' -f1)
  resp=$(printf 'header = "Authorization: %s"\n' "$token" |
    curl "${CURL_OPTS[@]}" --max-time 1800 -K - -X POST \
      -H "X-Bz-File-Name: $name" -H 'Content-Type: b2/x-auto' -H "X-Bz-Content-Sha1: $sha1" \
      --data-binary "@$file" "$url") || fail "B2: загрузка $name не удалась: ${resp:0:200}"
  [ "$(printf '%s' "$resp" | json_get contentSha1)" = "$sha1" ] ||
    fail "B2: контрольная сумма загруженного $name не совпала"
}

# Удаляет ВСЕ версии файлов бэкапов старше срока хранения (по дате в имени).
# Явные `|| return 1` вместо set -e: внутри функции под `||` errexit молчит.
b2_prune() {
  local cutoff body resp parsed next_name="" next_id="" pages=0 name id first deleted=0
  cutoff=$(date -u -d "$RETENTION_DAYS days ago" +%Y-%m-%d) || return 1
  while [ "$pages" -lt 50 ]; do
    pages=$((pages + 1))
    body="{\"bucketId\":\"$BUCKET_ID\",\"prefix\":\"$PREFIX\",\"maxFileCount\":1000"
    if [ -n "$next_name" ]; then body="$body,\"startFileName\":\"$next_name\",\"startFileId\":\"$next_id\""; fi
    resp=$(b2_post b2_list_file_versions "$body}") || { echo "список файлов: ${resp:0:200}" >&2; return 1; }
    parsed=$(printf '%s' "$resp" | CUTOFF="$cutoff" PREFIX="$PREFIX" node -e '
      let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
        const r=JSON.parse(d);
        const re=new RegExp("^"+process.env.PREFIX+"(\\d{4}-\\d{2}-\\d{2})\\.sql\\.gz\\.enc(\\.sha256)?$");
        const out=[(r.nextFileName||"")+"\t"+(r.nextFileId||"")];
        for(const f of r.files||[]){const m=re.exec(f.fileName);if(m&&m[1]<process.env.CUTOFF)out.push(f.fileName+"\t"+f.fileId)}
        console.log(out.join("\n"))})') || return 1
    first=1
    while IFS=$'\t' read -r name id; do
      if [ "$first" = 1 ]; then first=0; next_name=$name; next_id=$id; continue; fi
      b2_post b2_delete_file_version "{\"fileName\":\"$name\",\"fileId\":\"$id\"}" >/dev/null || return 1
      deleted=$((deleted + 1))
    done <<< "$parsed"
    [ -n "$next_name" ] || break
  done
  echo "[backup] хранение: удалено версий старше $RETENTION_DAYS дн. (до $cutoff): $deleted"
}

echo "[backup] загрузка в B2 (бакет $B2_BUCKET)..."
if command -v curl >/dev/null 2>&1; then
  b2_authorize
  have_api=1
else
  have_api=0
fi

if command -v b2 >/dev/null 2>&1; then
  b2 account authorize "$B2_KEY_ID" "$B2_APP_KEY" >/dev/null
  b2 file upload "$B2_BUCKET" "$ENC_FILE" "$NAME" >/dev/null
  b2 file upload "$B2_BUCKET" "$ENC_FILE.sha256" "$NAME.sha256" >/dev/null
elif [ "$have_api" = 1 ]; then
  b2_upload "$ENC_FILE" "$NAME"
  b2_upload "$ENC_FILE.sha256" "$NAME.sha256"
else
  fail "нет ни curl, ни b2 CLI — загрузить в B2 нечем"
fi

# Загрузка уже удалась — сбой хранения не должен делать бэкап «проваленным»
# (иначе планировщик повторял бы его каждый час), но и молчать не должен.
if [ "$have_api" = 1 ]; then
  b2_prune || echo "[backup] WARN: чистка старых бэкапов не удалась — повторится в следующий прогон" >&2
else
  echo "[backup] WARN: без curl чистка старых бэкапов пропущена" >&2
fi

echo "[backup] ok $NAME"
