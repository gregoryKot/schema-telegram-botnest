#!/bin/bash
# Скачивает из хранилища бэкапов (Cloudflare R2, S3-API) самый свежий
# зашифрованный бэкап Postgres и его контрольную сумму — первая половина
# аварийного восстановления: вторая, scripts/restore-backup.sh, расшифровывает
# и заливает файл в базу. Нужен, когда основная база недоступна и поднимать
# прод приходится из ночного бэкапа (scripts/backup-upload.sh кладёт его в
# бакет): docs/MIGRATION_VPS.md, «План Б».
#
# Использование:
#   BACKUP_S3_ENDPOINT=… BACKUP_S3_BUCKET=… BACKUP_S3_ACCESS_KEY_ID=… \
#   BACKUP_S3_SECRET_ACCESS_KEY=… bash scripts/backup-fetch-latest.sh <каталог>
#
# Что делает:
#   1. листает бакет по префиксу schemehappens- (ListObjectsV2 с пагинацией,
#      общий scripts/s3-api.sh) и выбирает самый свежий
#      schemehappens-YYYY-MM-DD.sql.gz.enc ПО ДАТЕ В ИМЕНИ, у которого есть
#      парный .sha256: файл без суммы (оборвавшаяся пара загрузок) не берём,
#      restore не смог бы проверить его целостность;
#   2. скачивает оба файла в <каталог> и сверяет размер и MD5, который
#      хранилище отдало в списке (ETag обычной загрузки).
#
# Права токена: Object Read & Write на бакет. Токен только на запись
# листинг и скачивание не пройдёт — в сообщении об ошибке на это указано.
#
# ЛОГИ ACTIONS ПУБЛИЧНЫ: печатаются только имя файла, дата, размер и числа.
# Ключи идут curl-у через stdin (-K -) и в вывод не попадают.
#
# Результат: последняя строка stdout — `[fetch-backup] ok <файл> размер <N> байт, дата <день>`;
# при сбое stderr содержит `[fetch-backup] FAILED <причина>`, код выхода ≠ 0.

set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFIX="schemehappens-"

fail() {
  echo "[fetch-backup] FAILED $*" >&2
  exit 1
}
trap 'echo "[fetch-backup] FAILED команда на строке $LINENO завершилась с кодом $?" >&2' ERR

need() { [ -n "${!1:-}" ] || fail "не задана переменная $1"; }

OUT_DIR="${1:-}"
[ -n "$OUT_DIR" ] || fail "не указан каталог для файлов (Usage: backup-fetch-latest.sh <каталог>)"
need BACKUP_S3_ENDPOINT
need BACKUP_S3_BUCKET
need BACKUP_S3_ACCESS_KEY_ID
need BACKUP_S3_SECRET_ACCESS_KEY
command -v curl > /dev/null 2>&1 || fail "нет curl — скачать из хранилища нечем"

# shellcheck source=scripts/s3-api.sh
source "$HERE/s3-api.sh"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

s3_download() { # s3_download <ключ> <ожидаемый размер> <ожидаемый etag или пусто>
  local key=$1 size=$2 etag=$3 dest="$OUT_DIR/$1" got
  s3_curl GET "/$key" "$EMPTY_SHA256" --max-time 1800 -o "$dest" ||
    {
      # Тело ошибки S3 — короткий XML с кодом, без секретов; в файле лежит оно, а не данные.
      local why
      why=$(head -c 200 "$dest" 2> /dev/null || true)
      rm -f "$dest"
      fail "S3: скачивание $key не удалось (у токена есть право на чтение?): $why"
    }
  got=$(($(wc -c < "$dest")))
  [ "$got" = "$size" ] || fail "S3: размер скачанного $key $got байт, в бакете $size"
  # ETag multipart-загрузки — не MD5 (с суффиксом -N): тогда остаётся размер и .sha256.
  if [[ "$etag" =~ ^[0-9a-f]{32}$ ]]; then
    [ "$(openssl dgst -md5 -r "$dest" | cut -d' ' -f1)" = "$etag" ] ||
      fail "S3: MD5 скачанного $key не совпал с ETag хранилища"
  fi
}

LISTING="$TMP_DIR/list"
s3_list "$PREFIX" "$LISTING" || fail "$S3_ERR"
NAMES=$(cut -f1 < "$LISTING")
ENCS=()
while IFS= read -r line; do ENCS+=("$line"); done < <(printf '%s\n' "$NAMES" |
  grep -E "^${PREFIX}[0-9]{4}-[0-9]{2}-[0-9]{2}[-_T0-9]*\.sql\.gz\.enc$" | LC_ALL=C sort || true)
[ "${#ENCS[@]}" -gt 0 ] || fail "в бакете $BACKUP_S3_BUCKET нет бэкапов ${PREFIX}*.sql.gz.enc"

CHOSEN=""
SKIPPED=0
for ((i = ${#ENCS[@]} - 1; i >= 0; i--)); do
  if printf '%s\n' "$NAMES" | grep -qxF "${ENCS[i]}.sha256"; then
    CHOSEN=${ENCS[i]}
    break
  fi
  SKIPPED=$((SKIPPED + 1))
done
[ -n "$CHOSEN" ] || fail "в бакете $BACKUP_S3_BUCKET есть ${#ENCS[@]} бэкапов, но ни у одного нет парного .sha256"
echo "[fetch-backup] бэкапов в бакете: ${#ENCS[@]}, пропущено новее без .sha256: $SKIPPED, берём $CHOSEN"

row() { awk -F'\t' -v n="$1" '$1 == n { print $2 "\t" $3; exit }' "$LISTING"; }
mkdir -p "$OUT_DIR"
IFS=$'\t' read -r ENC_SIZE ENC_ETAG <<< "$(row "$CHOSEN")"
IFS=$'\t' read -r SUM_SIZE SUM_ETAG <<< "$(row "$CHOSEN.sha256")"
s3_download "$CHOSEN.sha256" "$SUM_SIZE" "$SUM_ETAG"
s3_download "$CHOSEN" "$ENC_SIZE" "$ENC_ETAG"

DAY=${CHOSEN#"$PREFIX"}
DAY=${DAY:0:10}
echo "[fetch-backup] ok $CHOSEN размер $ENC_SIZE байт, дата $DAY"
