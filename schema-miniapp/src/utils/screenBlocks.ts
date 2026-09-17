// Блоки экранов «Профиль»/«Паттерны»/«Сегодня» — generic-контракт с бэком,
// один и тот же механизм на все экраны. SCREEN_BLOCK_IDS парсит sync-спека
// бэка регулярным выражением — держи ровно этот формат массива, по одному id
// на строке. focus/phrase/secondary/therapist_banner — блоки «Сегодня»
// (streak переиспользуется): у них только порядок (screen_order_today),
// видимость там регулируют исторические today_*-ключи.
export const SCREEN_BLOCK_IDS = [
  'journey',
  'streak',
  'heatmap',
  'achievements',
  'insights',
  'heroes',
  'ysq_status',
  'focus',
  'phrase',
  'secondary',
  'therapist_banner',
  'portrait',
  'warm_words',
] as const;

export type ScreenBlockId = (typeof SCREEN_BLOCK_IDS)[number];
export type CustomizableScreen = 'profile' | 'patterns' | 'today';
/** Экраны, где скрытие тоже generic (у «Сегодня» оно легаси-ключами). */
export type HiddenCustomizableScreen = 'profile' | 'patterns';

/** Ключ localStorage (per-device, как today_hidden_*) — один на экран. */
export const SCREEN_HIDDEN_KEYS: Record<HiddenCustomizableScreen, string> = {
  profile: 'screen_hidden_profile',
  patterns: 'screen_hidden_patterns',
};

export interface ScreenBlockMeta {
  label: string;
  sub: string;
}

/** Порядок строк в листе «Настроить экран», по экранам. Для «Сегодня» это
 * и есть band переставляемых блоков (закреплённые вне band: виджет обучения
 * сверху, предложение значка снизу — см. TodaySection). */
export const SCREEN_BLOCK_ORDER: Record<CustomizableScreen, ScreenBlockId[]> = {
  profile: [
    'portrait',
    'warm_words',
    'journey',
    'streak',
    'heatmap',
    'achievements',
    'insights',
  ],
  patterns: ['heroes', 'ysq_status'],
  today: ['therapist_banner', 'streak', 'focus', 'phrase', 'secondary'],
};

/** Описания блоков для строк листа. Названия — нейтральные, вилка обращения не нужна. */
export const BLOCK_META: Partial<Record<ScreenBlockId, ScreenBlockMeta>> = {
  journey: {
    label: 'Мой путь',
    sub: 'архив дневников, практик и тестов',
  },
  streak: {
    label: 'Серия дней',
    sub: 'дни подряд без пропуска и лучший результат',
  },
  heatmap: {
    label: 'Календарь активности',
    sub: 'карта заходов за последние недели',
  },
  achievements: {
    label: 'Достижения',
    sub: 'значки за пройденный путь',
  },
  insights: {
    label: 'Паттерны',
    sub: 'какие потребности растут, а какие проседают',
  },
  heroes: {
    label: 'Подсказка сверху',
    sub: 'вводная карточка над списком на вкладках «Схемы» и «Режимы»',
  },
  ysq_status: {
    label: 'Тест на схемы',
    sub: 'карточка статуса теста на вкладке «Схемы»',
  },
  portrait: {
    label: 'Мой портрет',
    sub: 'схемы и режимы по доменам, итог теста; списки схем/режимов — внутри',
  },
  warm_words: {
    label: 'Тёплые слова',
    sub: 'поддерживающие фразы из карточек и дневников',
  },
};
