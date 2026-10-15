#!/bin/bash
# Общая часть работы с S3-совместимым хранилищем бэкапов (Cloudflare R2) через
# curl, без CLI: подписанный запрос и список файлов. Подключается `source`-ом из
# scripts/backup-upload.sh (загрузка и чистка старых) и
# scripts/backup-fetch-latest.sh (скачивание при аварии), чтобы вход в
# хранилище жил в одном месте.
#
# Подпись — AWS Signature V4, встроенная в curl (`--aws-sigv4`, curl ≥ 7.75; в
# образе node:22-slim/bookworm — 7.88). Проба самопроверки подписывает тем же
# алгоритмом в Node (src/infra/s3-sigv4.ts); что подписи совпадают, проверяет
# поддельный S3 спеков (src/test-support/fake-s3.ts), пересчитывая подпись curl.
#
# Что нужно от вызывающего:
#   переменные BACKUP_S3_ENDPOINT (https://<id аккаунта>.r2.cloudflarestorage.com),
#   BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY;
#   необязательная BACKUP_S3_REGION (по умолчанию auto — так требует R2).
# Адреса path-style: <endpoint>/<бакет>/<ключ>.
#
# Ключ доступа и секрет уходят curl-у через stdin (-K -), а не аргументами: в
# командной строке процесса и в логах их нет. Заголовок x-amz-content-sha256
# ставится явно (SHA-256 тела): S3 требует его у каждого запроса, а старые curl
# сами его не добавляют. Параметры списка идут уже в каноническом порядке и
# строгом кодировании — подпись не зависит от того, как их нормализует curl.
# shellcheck disable=SC2034  # EMPTY_SHA256 читают вызывающие скрипты

S3_REGION="${BACKUP_S3_REGION:-auto}"
S3_BASE="${BACKUP_S3_ENDPOINT%/}/${BACKUP_S3_BUCKET:-}"
S3_MAX_PAGES="${S3_MAX_PAGES:-100}"
CURL_OPTS=(-sS --fail-with-body --max-time 120)
EMPTY_SHA256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

# Значение для конфига curl (-K): в кавычках, \ и " экранированы.
curl_quote() {
  local v=${1//\\/\\\\}
  printf '"%s"' "${v//\"/\\\"}"
}

# s3_curl <метод> <хвост адреса после бакета: /ключ или ?параметры> <sha256 тела> [аргументы curl…]
s3_curl() {
  local method=$1 tail=$2 sha=$3
  shift 3
  printf 'user = %s\n' "$(curl_quote "$BACKUP_S3_ACCESS_KEY_ID:$BACKUP_S3_SECRET_ACCESS_KEY")" |
    curl "${CURL_OPTS[@]}" -K - --aws-sigv4 "aws:amz:$S3_REGION:s3" -X "$method" \
      -H "x-amz-content-sha256: $sha" "$@" "$S3_BASE$tail"
}

# Разбор страницы ListObjectsV2 (XML). Первая строка вывода — курсор следующей
# страницы, уже закодированный для адреса (пусто — страниц больше нет); дальше
# по строке на файл: «ключ⇥размер⇥etag». Тот же формат разбирает
# src/infra/s3-list-objects.ts; оба разбора сверяются с ответами из
# документации AWS (test/fixtures/recorded/s3-list-objects-v2-*.xml).
# read -d '' вместо $(cat <<…): в bash 3.2 кавычки внутри heredoc ломают разбор $( ).
IFS= read -r -d '' S3_LIST_JS << 'JS' || true
let d = "";
process.stdin.on("data", (c) => (d += c)).on("end", () => {
  const un = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const tag = (s, n) => { const m = new RegExp("<" + n + ">([\\s\\S]*?)</" + n + ">").exec(s); return m ? un(m[1]) : ""; };
  const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  if (!/<ListBucketResult[\s>]/.test(d)) process.exit(1);
  const truncated = tag(d, "IsTruncated") === "true";
  const next = truncated ? tag(d, "NextContinuationToken") : "";
  if (truncated && !next) process.exit(1);
  const out = [enc(next)];
  for (const [, c] of d.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    out.push([tag(c, "Key"), tag(c, "Size"), tag(c, "ETag").replace(/"/g, "")].join("\t"));
  }
  console.log(out.join("\n"));
});
JS

# s3_list <префикс> <файл> — все файлы бакета с префиксом, строками
# «ключ⇥размер⇥etag» в <файл>. Сбой → код 1, причина в S3_ERR (без секретов:
# тело ошибки S3 — короткий XML с кодом). Список, не дочитанный за
# S3_MAX_PAGES страниц, — тоже сбой: «самый свежий» по обрезанному ненадёжен.
s3_list() {
  local prefix=$1 out=$2 token="" resp parsed pages=0 query first line
  : > "$out"
  while [ "$pages" -lt "$S3_MAX_PAGES" ]; do
    pages=$((pages + 1))
    query="list-type=2&prefix=$prefix"
    [ -z "$token" ] || query="continuation-token=$token&$query"
    if ! resp=$(s3_curl GET "?$query" "$EMPTY_SHA256"); then
      S3_ERR="S3: список файлов не получен: ${resp:0:200}"
      return 1
    fi
    if ! parsed=$(printf '%s' "$resp" | node -e "$S3_LIST_JS"); then
      S3_ERR="S3: ответ со списком файлов не разобрать"
      return 1
    fi
    first=1
    while IFS= read -r line; do
      if [ "$first" = 1 ]; then first=0; token=$line; continue; fi
      [ -z "$line" ] || printf '%s\n' "$line" >> "$out"
    done <<< "$parsed"
    [ -n "$token" ] || return 0
  done
  S3_ERR="S3: в бакете больше $S3_MAX_PAGES страниц файлов с префиксом $prefix, список не дочитан"
  return 1
}
