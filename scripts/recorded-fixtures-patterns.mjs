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
  // Точечные добавления: реальные парсеры внешнего формата, которые общие
  // сигналы ниже (fetch(/.json()/createHmac() и т.п.) не ловят по форме кода,
  // а не потому что они не парсеры.
  // - robokassa.service.ts: подпись Robokassa — md5(outSum:invId:pass), не
  //   HMAC и не JSON-тело; content-эвристика на createHmac её не видит.
  // - channel-http.ts: общий fetch/JSON-клиент адаптеров канала — вызов
  //   пробрасывается через переменную (`const send = ...; send(url, ...)`),
  //   поэтому литерал `fetch(` не совпадает с ним напрямую.
  /^src\/booking\/robokassa\.service\.ts$/,
  /^src\/channel\/channel-http\.ts$/,
];

