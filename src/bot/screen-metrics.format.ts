// Блок «Настройка экранов «Профиль»/«Паттерны»» для /stats (правило №8).
// Чистый форматтер, покрыт тестом (включая пустую БД). Язык — простой:
// «открывали», «скрывают», без терминов и внутренних id.

export interface ScreenMetrics {
  /** За месяц: сколько раз открыли «Настроить экран», по экранам. */
  opensByScreen: Array<{ screen: string; count: number }>;
  /** За месяц: что прячут (hidden=true), по (экран, блок), по убыванию. */
  hiddenByScreenBlock: Array<{ screen: string; block: string; count: number }>;
  /**
   * За месяц: сколько раз переставляли блоки местами (screen_block_move), по
   * экранам (правило №8: перестановки «Сегодня» не должны утонуть в общем
   * счётчике с «Профилем»/«Паттернами»).
   */
  movesByScreen: Array<{ screen: string; count: number }>;
  /** Всего: сколько юзеров хоть раз сохранили серверное зеркало настроек. */
  syncedUsers: number;
}

// Человеческие подписи экранов и блоков — в отчёте не должно быть id.
// Сверка — в спеке форматтера (новый экран/блок без подписи вылезет голым
// ключом).
export const SCREEN_LABELS: Record<string, string> = {
  profile: 'Профиль',
  patterns: 'Паттерны',
  today: 'Сегодня',
};

export const SCREEN_BLOCK_LABELS: Record<string, string> = {
  journey: 'Мой путь',
  streak: 'Серия',
  heatmap: 'Календарь активности',
  achievements: 'Достижения',
  insights: 'Наблюдения',
  heroes: 'Подсказки сверху',
  ysq_status: 'Карточка теста схем',
  focus: 'Фокус дня',
  phrase: 'Фраза взрослого',
  secondary: 'Что ещё сегодня',
  therapist_banner: 'Баннер терапевта',
};

// Порядок строк — как в настройке, а не по убыванию счёта (та же логика,
// что у TODAY_BLOCKS.filter в product-metrics.format.ts).
const SCREENS_ORDER = ['profile', 'patterns', 'today'];

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
  const movesByScreen = new Map(
    m.movesByScreen.map((r) => [r.screen, r.count]),
  );

  const knownScreens = new Set(SCREENS_ORDER);
  const extraScreens = [
    ...opensByScreen.keys(),
    ...hiddenByScreen.keys(),
    ...movesByScreen.keys(),
  ]
    .filter((s) => !knownScreens.has(s))
    .filter((s, i, arr) => arr.indexOf(s) === i);
  const allScreens = [...SCREENS_ORDER, ...extraScreens];

  const lines = allScreens
    .map((screen) =>
      formatScreenLine(
        screen,
        opensByScreen.get(screen) ?? 0,
        hiddenByScreen.get(screen) ?? [],
      ),
    )
    .filter((l): l is string => l !== null);

  const out =
    lines.length === 0
      ? ['🧩 Настройку экранов пока не трогали.']
      : [`🧩 <b>Настройка экранов</b> (за месяц)`, ...lines];
  // Переставляли блоки местами — по экранам (правило №8: перестановки
  // «Сегодня» не должны утонуть в общем счётчике с «Профилем»/«Паттернами»).
  // Экраны без перестановок за месяц не показываются; нет ни одной — строки
  // нет вовсе (пустое состояние блока не меняем).
  const moveParts = allScreens
    .map((screen) => {
      const count = movesByScreen.get(screen) ?? 0;
      return count > 0 ? `${SCREEN_LABELS[screen] ?? screen} — ${count}` : null;
    })
    .filter((p): p is string => p !== null);
  if (moveParts.length > 0) {
    out.push(`Переставляют блоки: ${moveParts.join(' · ')}`);
  }
  // Отдельная строка-состояние (не событие за период) — печатаем только при
  // ненулевом счётчике, чтобы на чистой БД («настройку не трогали») в блоке
  // не появлялось «0 человек».
  if (m.syncedUsers > 0) {
    out.push(`Настройки синхронизированы: ${m.syncedUsers} человек`);
  }
  return out.join('\n');
}
