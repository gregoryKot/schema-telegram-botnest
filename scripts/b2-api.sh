#!/bin/bash
# Общая часть работы с Backblaze B2 через родной API (curl + node, без CLI):
# авторизация и POST-вызов. Подключается `source`-ом из scripts/backup-to-b2.sh
# (загрузка) и scripts/fetch-latest-b2.sh (скачивание), чтобы вход в B2 жил в
# одном месте, а не в двух копиях.
#
# Что нужно от вызывающего:
#   fail <текст>                       функция: напечатать причину и выйти с кодом ≠ 0
#   B2_KEY_ID, B2_APP_KEY, B2_BUCKET   переменные окружения
#   B2_AUTH_URL (необязательно)        адрес b2_authorize_account — чтобы тест подставил поддельный B2
# После b2_authorize заданы: TOKEN, ACCOUNT_ID, API_URL, DOWNLOAD_URL, BUCKET_ID.
#
# Заголовки и логин уходят curl-у через stdin (-K -), а не аргументами: токен и
# ключ приложения не видны в командной строке процесса и в логах.
# shellcheck disable=SC2034  # TOKEN/API_URL/DOWNLOAD_URL/BUCKET_ID читает вызывающий скрипт

B2_AUTH_URL="${B2_AUTH_URL:-https://api.backblazeb2.com/b2api/v3/b2_authorize_account}"
CURL_OPTS=(-sS --fail-with-body --max-time 120)

# Значение по пути из JSON со stdin: json_get apiInfo.storageApi.apiUrl
json_get() {
  node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{let v;try{v=JSON.parse(d);for(const k of process.argv[1].split("."))v=v==null?v:v[k]}catch{process.exit(1)}process.stdout.write(v==null?"":String(v))})' "$1"
}

b2_authorize() {
  local resp
  resp=$(printf 'user = "%s:%s"\n' "$B2_KEY_ID" "$B2_APP_KEY" |
    curl "${CURL_OPTS[@]}" -K - "$B2_AUTH_URL") || fail "B2: авторизация не удалась (ключ или сеть): ${resp:0:200}"
  TOKEN=$(printf '%s' "$resp" | json_get authorizationToken)
  ACCOUNT_ID=$(printf '%s' "$resp" | json_get accountId)
  API_URL=$(printf '%s' "$resp" | json_get apiInfo.storageApi.apiUrl)
  [ -n "$API_URL" ] || API_URL=$(printf '%s' "$resp" | json_get apiUrl)
  [ -n "$TOKEN" ] && [ -n "$API_URL" ] || fail "B2: в ответе авторизации нет токена или адреса API"
  DOWNLOAD_URL=$(printf '%s' "$resp" | json_get apiInfo.storageApi.downloadUrl)
  [ -n "$DOWNLOAD_URL" ] || DOWNLOAD_URL=$(printf '%s' "$resp" | json_get downloadUrl)
  BUCKET_ID=$(printf '%s' "$resp" | json_get apiInfo.storageApi.bucketId)
  [ -n "$BUCKET_ID" ] || BUCKET_ID=$(printf '%s' "$resp" | json_get allowed.bucketId)
  if [ -z "$BUCKET_ID" ]; then
    local list
    list=$(b2_post b2_list_buckets "{\"accountId\":\"$ACCOUNT_ID\",\"bucketName\":\"$B2_BUCKET\"}") ||
      fail "B2: не удалось найти бакет $B2_BUCKET: ${list:0:200}"
    BUCKET_ID=$(printf '%s' "$list" | json_get buckets.0.bucketId)
  fi
  [ -n "$BUCKET_ID" ] || fail "B2: бакет $B2_BUCKET не найден"
}

b2_post() { # b2_post <метод> <JSON-тело>
  printf 'header = "Authorization: %s"\n' "$TOKEN" |
    curl "${CURL_OPTS[@]}" -K - -X POST -H 'Content-Type: application/json' -d "$2" "$API_URL/b2api/v3/$1"
}
