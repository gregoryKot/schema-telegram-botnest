// Блок «Настройка экранов «Профиль»/«Паттерны»» для /stats (правило №8).
// Чистый форматтер, покрыт тестом (включая пустую БД). Язык — простой:
// «открывали», «скрывают», без терминов и внутренних id.

export interface ScreenMetrics {
  /** За месяц: сколько раз открыли «Настроить экран», по экранам. */
  opensByScreen: Array<{ screen: string; count: number }>;
  /** За месяц: что прячут (hidden=true), по (экран, блок), по убыванию. */
  hiddenByScreenBlock: Array<{ screen: string; block: string; count: number }>;
}

// Человеческие подписи экранов и блоков — в отчёте не должно быть id.
// Сверка — в спеке форматтера (новый экран/блок без подписи вылезет голым
// ключом).
export const SCREEN_LABELS: Record<string, string> = {
  profile: 'Профиль',
  patterns: 'Паттерны',
};

export const SCREEN_BLOCK_LABELS: Record<string, string> = {
  journey: 'Мой путь',
  streak: 'Серия',
  heatmap: 'Календарь активности',
  achievements: 'Достижения',
  insights: 'Наблюдения',
  heroes: 'Подсказки сверху',
  ysq_status: 'Карточка теста схем',
};

// Порядок строк — как в настройке, а не по убыванию счёта (та же логика,
// что у TODAY_BLOCKS.filter в product-metrics.format.ts).
const SCREENS_ORDER = ['profile', 'patterns'];

function formatScreenLine(
  screen: string,
  opens: number,
  hidden: Array<{ block: string; count: number }>,
): string | null {
  if (opens === 0 && hidden.length === 0) return null;
  const parts: string[] = [];
  if (opens > 0) parts.push(`открывали ${opens} раз`);
  if (hidden.length > 0) {
    const list = hidden
      .map((h) => `${SCREEN_BLOCK_LABELS[h.block] ?? h.block} — ${h.count}`)
      .join(' · ');
    parts.push(`скрывают: ${list}`);
  }
  return `${SCREEN_LABELS[screen] ?? screen}: ${parts.join('; ')}`;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatScreenMetrics(m: ScreenMetrics): string {
  const opensByScreen = new Map(
    m.opensByScreen.map((r) => [r.screen, r.count]),
  );
  const hiddenByScreen = new Map<
    string,
    Array<{ block: string; count: number }>
  >();
  for (const row of m.hiddenByScreenBlock) {
    const list = hiddenByScreen.get(row.screen) ?? [];
    list.push({ block: row.block, count: row.count });
    hiddenByScreen.set(row.screen, list);
  }

  const knownScreens = new Set(SCREENS_ORDER);
  const extraScreens = [...opensByScreen.keys(), ...hiddenByScreen.keys()]
    .filter((s) => !knownScreens.has(s))
    .filter((s, i, arr) => arr.indexOf(s) === i);

  const lines = [...SCREENS_ORDER, ...extraScreens]
    .map((screen) =>
      formatScreenLine(
        screen,
        opensByScreen.get(screen) ?? 0,
        hiddenByScreen.get(screen) ?? [],
      ),
    )
    .filter((l): l is string => l !== null);

  if (lines.length === 0) {
    return '🧩 Настройку экранов пока не трогали.';
  }
  return [`🧩 <b>Настройка экранов</b> (за месяц)`, ...lines].join('\n');
}
