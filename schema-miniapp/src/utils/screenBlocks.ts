// Скрываемые блоки экранов «Профиль»/«Паттерны» — generic-контракт с бэком:
// сначала «Профиль» (эта задача), затем «Паттерны» тем же механизмом (другой
// агент). SCREEN_BLOCK_IDS парсит sync-спека бэка регулярным выражением —
// держи ровно этот формат массива, по одному id на строке.
export const SCREEN_BLOCK_IDS = [
  'journey',
  'streak',
  'heatmap',
  'achievements',
  'insights',
  'heroes',
  'ysq_status',
] as const;

export type ScreenBlockId = (typeof SCREEN_BLOCK_IDS)[number];
export type CustomizableScreen = 'profile' | 'patterns';

/** Ключ localStorage (per-device, как today_hidden_*) — один на экран. */
export const SCREEN_HIDDEN_KEYS: Record<CustomizableScreen, string> = {
  profile: 'screen_hidden_profile',
  patterns: 'screen_hidden_patterns',
};

export interface ScreenBlockMeta {
  emoji: string;
  label: string;
  sub: string;
}

/** Порядок строк в листе «Настроить экран», по экранам. «Паттерны» заполнит
 * следующая задача (heroes/ysq_status) — реестр уже готов их принять. */
export const SCREEN_BLOCK_ORDER: Record<CustomizableScreen, ScreenBlockId[]> = {
  profile: ['journey', 'streak', 'heatmap', 'achievements', 'insights'],
  patterns: [],
};

/** Описания блоков для строк листа. Названия — нейтральные (без «ты/вы»).
 * Профильные блоки — эта задача; heroes/ysq_status добавит задача «Паттернов». */
export const BLOCK_META: Partial<Record<ScreenBlockId, ScreenBlockMeta>> = {
  journey: {
    emoji: '🧭',
    label: 'Мой путь',
    sub: 'архив дневников, практик и тестов',
  },
  streak: {
    emoji: '🔥',
    label: 'Серия дней',
    sub: 'дни подряд без пропуска и лучший результат',
  },
  heatmap: {
    emoji: '📅',
    label: 'Календарь активности',
    sub: 'карта заходов за последние недели',
  },
  achievements: {
    emoji: '🏆',
    label: 'Достижения',
    sub: 'значки за пройденный путь',
  },
  insights: {
    emoji: '📈',
    label: 'Паттерны',
    sub: 'какие потребности растут, а какие проседают',
  },
};
