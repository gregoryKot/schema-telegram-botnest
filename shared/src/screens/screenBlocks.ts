// Блоки экранов «Профиль»/«Паттерны» — generic-контракт с бэком, один и тот же
// механизм на все экраны (правило №3). SCREEN_BLOCK_IDS парсит sync-спека
// бэка регулярным выражением — держи ровно этот формат массива, по одному id
// на строке.
import type { SignKey } from '../theme/entityLook';

export const SCREEN_BLOCK_IDS = [
  'journey',
  'streak',
  'heatmap',
  'achievements',
  'insights',
  'heroes',
  'ysq_status',
  'portrait',
  'warm_words',
] as const;

export type ScreenBlockId = (typeof SCREEN_BLOCK_IDS)[number];
export type CustomizableScreen = 'profile' | 'patterns';
/** Экраны со скрытием блоков — те же, что настраиваемые (имя держит старые импорты). */
export type HiddenCustomizableScreen = CustomizableScreen;

/** Ключ localStorage с порядком блоков — по экрану. */
export const SCREEN_ORDER_KEYS: Record<CustomizableScreen, string> = {
  profile: 'screen_order_profile',
  patterns: 'screen_order_patterns',
};

/** Ключ localStorage (per-device) — один на экран. */
export const SCREEN_HIDDEN_KEYS: Record<HiddenCustomizableScreen, string> = {
  profile: 'screen_hidden_profile',
  patterns: 'screen_hidden_patterns',
};

export interface ScreenBlockMeta {
  label: string;
  sub: string;
  /** Знак строки в листе «Настроить экран» (CustomizeRow) — ключ SignArt по смыслу блока
   *  (docs/design/PAPER_2026-11.md, «Мотив → смысл»); в одном экране знаки не повторяются. */
  sign: SignKey;
}

/** Порядок строк в листе «Настроить экран», по экранам. */
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
};

/** Описания блоков для строк листа. Названия — нейтральные, вилка обращения не нужна. */
export const BLOCK_META: Partial<Record<ScreenBlockId, ScreenBlockMeta>> = {
  journey: {
    label: 'Мой путь',
    sub: 'архив дневников, практик и тестов',
    sign: 'sheets',
  },
  streak: {
    label: 'Серия дней',
    sub: 'дни подряд без пропуска и лучший результат',
    sign: 'check',
  },
  heatmap: {
    label: 'Календарь активности',
    sub: 'карта заходов за последние недели',
    sign: 'pebbles',
  },
  achievements: {
    label: 'Достижения',
    sub: 'значки за пройденный путь',
    sign: 'leaf',
  },
  insights: {
    label: 'Паттерны',
    sub: 'какие потребности растут, а какие проседают',
    sign: 'layers',
  },
  heroes: {
    label: 'Подсказка сверху',
    sub: 'вводная карточка над списком на вкладках «Схемы» и «Режимы»',
    sign: 'cluster',
  },
  ysq_status: {
    label: 'Тест на схемы',
    sub: 'карточка статуса теста на вкладке «Схемы»',
    sign: 'layers',
  },
  portrait: {
    label: 'Мой портрет',
    sub: 'схемы и режимы по доменам, итог теста; списки схем/режимов — внутри',
    sign: 'strokes',
  },
  warm_words: {
    label: 'Тёплые слова',
    sub: 'поддерживающие фразы из карточек и дневников',
    sign: 'child_care',
  },
};
