#!/bin/bash
# Общая часть работы с S3-совместимым хранилищем бэкапов (Yandex Object Storage) через
# curl, без CLI: подписанный запрос и список файлов. Подключается `source`-ом из
# scripts/backup-upload.sh (загрузка и чистка старых) и
# scripts/backup-fetch-latest.sh (скачивание при аварии), чтобы вход в
# хранилище жил в одном месте.
#
# Подпись — AWS Signature V4, считает её Node: deploy/s3-sign.cjs, та же
# реализация, что у пробы самопроверки (src/infra/s3-sigv4.ts — её
# типизированный вход). curl получает готовые заголовки и шлёт адрес как есть.
# Встроенный `curl --aws-sigv4` не годится: curl сам каноникализирует строку
# запроса, и curl 8.18 (Ubuntu 26.04) подписывал `%2B` в курсоре листинга как
# `%20` — S3-хранилище отвечало 403 SignatureDoesNotMatch на второй странице списка.
# Что подпись сходится с тем, что реально ушло по сети, проверяет поддельный
# S3 спеков (src/test-support/fake-s3.ts): он пересчитывает её по запросу,
# который пришёл от curl.
#
# Что нужно от вызывающего:
#   переменные BACKUP_S3_ENDPOINT (https://storage.yandexcloud.net),
#   BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY;
#   необязательная BACKUP_S3_REGION (по умолчанию ru-central1 — единственный регион Yandex Object Storage).
# Адреса path-style: <endpoint>/<бакет>/<ключ>.
#
# Ключ доступа и секрет уходят подписи через stdin, а заголовки с подписью —
# curl-у через stdin (-K -), а не аргументами: в командной строке процессов и
# в логах их нет. Параметры списка кодируются строго (`+` → `%2B`): именно эту
# строку видят и подпись, и хранилище.
# shellcheck disable=SC2034  # EMPTY_SHA256 читают вызывающие скрипты

S3_REGION="${BACKUP_S3_REGION:-ru-central1}"
S3_BASE="${BACKUP_S3_ENDPOINT%/}/${BACKUP_S3_BUCKET:-}"
S3_MAX_PAGES="${S3_MAX_PAGES:-100}"
CURL_OPTS=(-sS --fail-with-body --max-time 120)
EMPTY_SHA256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

S3_SIGN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../deploy/s3-sign.cjs"

# s3_curl <метод> <хвост адреса после бакета: /ключ или ?параметры> <sha256 тела> [аргументы curl…]
# Сбой подписи → код 1: причина от s3-sign.cjs — в stderr, короткая метка — в
# stdout (его вызывающие печатают вместо тела ответа S3).
s3_curl() {
  local method=$1 url="$S3_BASE$2" sha=$3 signed
  shift 3
  signed=$(printf '%s\n%s\n' "$BACKUP_S3_ACCESS_KEY_ID" "$BACKUP_S3_SECRET_ACCESS_KEY" |
    node "$S3_SIGN" "$method" "$url" "$sha" "$S3_REGION") ||
    { echo "запрос не подписан (deploy/s3-sign.cjs)"; return 1; }
  printf '%s\n' "$signed" | curl "${CURL_OPTS[@]}" -K - -X "$method" "$@" "$url"
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
