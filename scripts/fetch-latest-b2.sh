#!/bin/bash
# Скачивает из Backblaze B2 самый свежий зашифрованный бэкап Postgres и его
# контрольную сумму — первая половина аварийного восстановления: вторая,
# scripts/restore-backup.sh, расшифровывает и заливает файл в базу. Нужен, когда
# основная база недоступна и поднимать прод приходится из ночного бэкапа
# (scripts/backup-to-b2.sh кладёт его в бакет): docs/MIGRATION_VPS.md, «План Б».
#
# Использование:
#   B2_KEY_ID=… B2_APP_KEY=… B2_BUCKET=… bash scripts/fetch-latest-b2.sh <каталог>
#
# Что делает:
#   1. авторизуется в B2 так же, как backup-to-b2.sh (общий scripts/b2-api.sh);
#   2. листает бакет по префиксу schemehappens- (с пагинацией) и выбирает самый
#      свежий schemehappens-YYYY-MM-DD.sql.gz.enc ПО ДАТЕ В ИМЕНИ, у которого
#      есть парный .sha256: файл без суммы (оборвавшаяся пара загрузок) не берём,
#      restore не смог бы проверить его целостность;
#   3. скачивает оба файла в <каталог> и сверяет размер и SHA1, который B2
#      посчитал сам при загрузке.
#
# Права ключа B2: помимо listBuckets/listFiles нужно readFiles. Ключ, созданный
# только под загрузку, листинг пройдёт, а скачивание отдаст 401 — в сообщении об
# ошибке на это указано.
#
# ЛОГИ ACTIONS ПУБЛИЧНЫ: печатаются только имя файла, дата, размер и числа.
# Ключ приложения и токены идут curl-у через stdin (-K -) и в вывод не попадают.
#
# Результат: последняя строка stdout — `[fetch-b2] ok <файл> размер <N> байт, дата <день>`;
# при сбое stderr содержит `[fetch-b2] FAILED <причина>`, код выхода ≠ 0.
# Необязательная B2_AUTH_URL — адрес b2_authorize_account, только для теста.

set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFIX="schemehappens-"
MAX_PAGES=100

fail() {
  echo "[fetch-b2] FAILED $*" >&2
  exit 1
}
trap 'echo "[fetch-b2] FAILED команда на строке $LINENO завершилась с кодом $?" >&2' ERR

need() { [ -n "${!1:-}" ] || fail "не задана переменная $1"; }

OUT_DIR="${1:-}"
[ -n "$OUT_DIR" ] || fail "не указан каталог для файлов (Usage: fetch-latest-b2.sh <каталог>)"
need B2_KEY_ID
need B2_APP_KEY
need B2_BUCKET
command -v curl > /dev/null 2>&1 || fail "нет curl — скачать из B2 нечем"

# shellcheck source=scripts/b2-api.sh
source "$HERE/b2-api.sh"

# Все бэкапы бакета: строки «имя⇥размер⇥sha1». Страницы по 1000 имён, курсор —
# nextFileName. Имена вне формата бэкапа отбрасываются здесь же.
b2_list_backups() {
  local next_json='""' body resp parsed pages=0 first name line out=""
  while [ "$pages" -lt "$MAX_PAGES" ]; do
    pages=$((pages + 1))
    body="{\"bucketId\":\"$BUCKET_ID\",\"prefix\":\"$PREFIX\",\"maxFileCount\":1000"
    if [ "$next_json" != '""' ]; then body="$body,\"startFileName\":$next_json"; fi
    resp=$(b2_post b2_list_file_names "$body}") || fail "B2: список файлов не получен: ${resp:0:200}"
    parsed=$(printf '%s' "$resp" | PREFIX="$PREFIX" node -e '
      let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
        const r=JSON.parse(d);
        const re=new RegExp("^"+process.env.PREFIX+"\\d{4}-\\d{2}-\\d{2}[-_T0-9]*\\.sql\\.gz\\.enc(\\.sha256)?$");
        const out=[JSON.stringify(r.nextFileName||"")];
        for(const f of r.files||[]){
          if(f.action&&f.action!=="upload")continue;
          if(re.test(f.fileName))out.push([f.fileName,f.contentLength,f.contentSha1||""].join("\t"))
        }
        console.log(out.join("\n"))})') || fail "B2: ответ со списком файлов не разобрать"
    first=1
    while IFS= read -r line; do
      if [ "$first" = 1 ]; then first=0; next_json=$line; continue; fi
      out+="$line"$'\n'
    done <<< "$parsed"
    [ "$next_json" != '""' ] || break
  done
  # Страницы не кончились за MAX_PAGES — список обрезан, «самый свежий» ненадёжен.
  [ "$next_json" = '""' ] || fail "B2: в бакете больше $((MAX_PAGES * 1000)) файлов с префиксом $PREFIX, список не дочитан"
  name=$out
  printf '%s' "$name"
}

b2_download() { # b2_download <имя в бакете> <ожидаемый размер> <ожидаемый sha1 или пусто>
  local name=$1 size=$2 sha1=$3 dest="$OUT_DIR/$1" got
  printf 'header = "Authorization: %s"\n' "$TOKEN" |
    curl "${CURL_OPTS[@]}" --max-time 1800 -K - -o "$dest" "$DOWNLOAD_URL/file/$B2_BUCKET/$name" ||
    {
      # Тело ошибки B2 — короткий JSON без секретов; в файле лежит оно, а не данные.
      local why
      why=$(head -c 200 "$dest" 2> /dev/null || true)
      rm -f "$dest"
      fail "B2: скачивание $name не удалось (у ключа есть право readFiles?): $why"
    }
  got=$(wc -c < "$dest")
  [ "$got" = "$size" ] || fail "B2: размер скачанного $name $got байт, в бакете $size"
  if [[ "$sha1" =~ ^[0-9a-f]{40}$ ]]; then
    [ "$(sha1sum "$dest" | cut -d' ' -f1)" = "$sha1" ] || fail "B2: SHA1 скачанного $name не совпал с посчитанным B2"
  fi
}

b2_authorize
[ -n "$DOWNLOAD_URL" ] || fail "B2: в ответе авторизации нет адреса скачивания"

LISTING=$(b2_list_backups)
NAMES=$(printf '%s' "$LISTING" | cut -f1)
mapfile -t ENCS < <(printf '%s\n' "$NAMES" | grep -E '\.sql\.gz\.enc$' | LC_ALL=C sort || true)
[ "${#ENCS[@]}" -gt 0 ] || fail "в бакете $B2_BUCKET нет бэкапов ${PREFIX}*.sql.gz.enc"

CHOSEN=""
SKIPPED=0
for ((i = ${#ENCS[@]} - 1; i >= 0; i--)); do
  if printf '%s\n' "$NAMES" | grep -qxF "${ENCS[i]}.sha256"; then
    CHOSEN=${ENCS[i]}
    break
  fi
  SKIPPED=$((SKIPPED + 1))
done
[ -n "$CHOSEN" ] || fail "в бакете $B2_BUCKET есть ${#ENCS[@]} бэкапов, но ни у одного нет парного .sha256"
echo "[fetch-b2] бэкапов в бакете: ${#ENCS[@]}, пропущено новее без .sha256: $SKIPPED, берём $CHOSEN"

row() { printf '%s\n' "$LISTING" | awk -F'\t' -v n="$1" '$1 == n { print $2 "\t" $3; exit }'; }
mkdir -p "$OUT_DIR"
IFS=$'\t' read -r ENC_SIZE ENC_SHA1 <<< "$(row "$CHOSEN")"
IFS=$'\t' read -r SUM_SIZE SUM_SHA1 <<< "$(row "$CHOSEN.sha256")"
b2_download "$CHOSEN.sha256" "$SUM_SIZE" "$SUM_SHA1"
b2_download "$CHOSEN" "$ENC_SIZE" "$ENC_SHA1"

DAY=${CHOSEN#"$PREFIX"}
DAY=${DAY:0:10}
echo "[fetch-b2] ok $CHOSEN размер $ENC_SIZE байт, дата $DAY"
