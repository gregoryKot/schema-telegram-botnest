// Правила разбора для check-recorded-fixtures.mjs — вынесено из движка,
// чтобы гейт не рос вместе со списком путей (правило №10 CLAUDE.md: гейт,
// упёршийся в потолок, дробится на движок + модуль правил).
//
// Явные классы парсеров внешнего формата (по задаче: CalDAV iCloud,
// initData любой площадки, OAuth-провайдеры входа, адаптеры канала
// «Здоровый Взрослый»). Регэкспы проверяются на repo-relative POSIX-путь
// (`src/...`), *.spec.ts/*.test.ts уже отфильтрованы вызывающей стороной.
export const PARSER_PATH_PATTERNS = [
  /^src\/booking\/caldav-[^/]+\.ts$/,
  /^src\/auth\/[^/]*init-data[^/]*\.ts$/,
  /^src\/auth\/providers\/(?!types\.ts$|registry\.ts$)[^/]+\.ts$/,
  /^src\/channel\/targets\/[^/]+\.ts$/,
  /\/[^/]*webhook[^/]*\.ts$/,
  // Точечные добавления: парсеры, которых сигналы содержимого (fetch(/.json()/
  // createHmac()) не видят по форме кода:
  // - robokassa.service.ts: подпись md5(outSum:invId:pass), не HMAC и не JSON;
  // - channel-http.ts: fetch адаптеров канала идёт через переменную (`send(`);
  // - s3-list-objects.ts: XML ListObjectsV2 разбирается регэкспом, fetch —
  //   параметром (`fetchFn(`);
  // - telegram-rate-limit.ts: ответ 429 (parameters.retry_after) приходит уже
  //   разобранным telegraf-ом в TelegramError.response.
  /^src\/booking\/robokassa\.service\.ts$/,
  /^src\/channel\/channel-http\.ts$/,
  /^src\/infra\/s3-list-objects\.ts$/,
  /^src\/telegram\/telegram-rate-limit\.ts$/,
];

