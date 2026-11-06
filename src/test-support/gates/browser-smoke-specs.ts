// Правила для спеков браузерного смока (e2e-browser/*.spec.ts). `test` берётся
// из общего e2e-browser/support/test.ts — там стаб API формы сервера и падение
// теста на экране ошибки, — а не из '@playwright/test', и своего перехвата
// `/api` в спеке нет. Причина — ci-alarm #903: свои перехваты с ответом `{}` в
// public-pages и asset-recovery дали два ложно-зелёных экрана падения
// (/articles, /subscribe), а общий стаб чинили отдельно от них.

const TEST_FROM_SUPPORT =
  /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*['"]\.\/support\/test['"]/;
const TEST_FROM_PLAYWRIGHT =
  /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*['"]@playwright\/test['"]/;
// Перехват всего API строкой-маской; перехват файлов сборки (asset-recovery,
// функция-предикат по пути) законен — это не ответы бэкенда.
const OWN_API_ROUTE = /\.route\(\s*['"`][^'"`]*\/api\/\*\*['"`]/;

/** Нарушения в тексте одного спека; пусто — спек идёт через общий `test`. */
export function smokeSpecViolations(source: string): string[] {
  const out: string[] = [];
  if (!TEST_FROM_SUPPORT.test(source)) {
    out.push(
      '`test` не из ./support/test — стаб API и проверка на падение не подключены',
    );
  }
  if (TEST_FROM_PLAYWRIGHT.test(source)) {
    out.push(
      "`test` из '@playwright/test' — в обход общего стаба и проверки на падение",
    );
  }
  if (OWN_API_ROUTE.test(source)) {
    out.push(
      'свой перехват `/api` — ответы формы сервера даёт support/stubApi.ts',
    );
  }
  return out;
}

/**
 * Спеки каталога, которых нет в `testMatch` playwright.config.ts: `npx playwright
 * test` их молча пропускает — спек лежит, ничего не защищая (тот же класс, что
 * спек-сирота в `test/`, check-e2e-in-ci). Сверка по имени файла в кавычках.
 */
export function specsMissingFromConfig(
  configSource: string,
  specs: string[],
): string[] {
  return specs.filter(
    (f) => !configSource.includes(`'${f}'`) && !configSource.includes(`"${f}"`),
  );
}
