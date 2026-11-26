// Чернила и бумага share-карточки — значениями, а не var(): canvas не читает CSS-переменные,
// а карточка всегда светлая «бумажная» и не зависит от темы приложения (её отправляют в чужой
// мессенджер, где тёмной темы сайта нет). Значения — светлая тема `webapp/src/index.css`
// (блок `:root, html[data-theme="light"], .light-lock`); сверка — ink.test.ts (правило №4).
// Имена бумаги знаков (PAPER_INK) — те же, что PAPER в `webapp/src/components/art/paper.ts`
// (сверка — `webapp/src/share/signsCanvas.test.ts`).

/** CSS-переменная светлой темы → значение. Ключ — имя переменной целиком. */
export const INK_VARS: Readonly<Record<string, string>> = {
  '--bg': '#f6f2eb',
  '--surface': '#fffdf9',
  '--text': '#1f1b17',
  '--text-sub': '#4a433b',
  '--text-muted': '#6b6258',
  '--accent': '#8a3a2b',
  '--c-rose': '#c46b6b',
  '--c-amber': '#c2862a',
  '--c-ochre': '#a17f1f',
  '--c-moss': '#6b8156',
  '--c-teal': '#4f8285',
  '--c-slate': '#5d6d8a',
  '--c-plum': '#8a5a85',
  '--c-clay': '#b06f4a',
  '--c-rose-strong': '#ad4545',
  '--c-moss-strong': '#5a6e48',
  '--c-amber-strong': '#8c601e',
  '--c-clay-strong': '#8f5b3c',
  '--accent-blue': '#5d6d8a',
  '--accent-green': '#5a6e48',
  '--accent-yellow': '#8c601e',
  '--accent-red': '#ad4545',
  '--accent-orange': '#8f5b3c',
  '--accent-pink': '#8a5a85',
};

/** Чернила карточки: текст, подписи, тихие линии. */
export const INK = {
  page: INK_VARS['--bg'],
  surface: INK_VARS['--surface'],
  text: INK_VARS['--text'],
  sub: INK_VARS['--text-sub'],
  muted: INK_VARS['--text-muted'],
  accent: INK_VARS['--accent'],
  /** rgb чернил для полупрозрачных линий и пазов. */
  rgb: '31, 27, 23',
} as const;

/** Бумага знаков (PAPER в art/paper.ts): имя → CSS-переменная, которой знак красится на сайте. */
export const PAPER_VARS = {
  moss: '--c-moss',
  brown: '--text-sub',
  clay: '--c-clay',
  slate: '--c-slate',
  amber: '--c-amber',
  plum: '--c-plum',
  surface: '--surface',
} as const;

/** Бумага знаков значением; sage — --c-moss 55 % на --bg, hollow — --text 10 % (как в PAPER). */
export const PAPER_INK = {
  moss: INK_VARS['--c-moss'],
  sage: '#aab499',
  brown: INK_VARS['--text-sub'],
  clay: INK_VARS['--c-clay'],
  slate: INK_VARS['--c-slate'],
  amber: INK_VARS['--c-amber'],
  plum: INK_VARS['--c-plum'],
  hollow: `rgba(${INK.rgb}, 0.1)`,
  surface: INK_VARS['--surface'],
} as const;
export type PaperName = keyof typeof PAPER_INK;

/** Порядок потребностей карточек — NEED_COLOR_ORDER (needs/needColors.ts). */
export const NEED_INK_ORDER = [
  'attachment',
  'autonomy',
  'expression',
  'play',
  'limits',
] as const;
/** Цвет данных потребности (NEED_DATA_PAPER, решение 7) — столбик, полоска. */
export const NEED_DATA_VARS = [
  '--c-clay',
  '--c-amber-strong',
  '--c-slate',
  '--c-plum',
  '--c-moss',
] as const;
/** Число текстом — читаемый токен того же оттенка (history/needInk.ts). */
export const NEED_TEXT_VARS = [
  '--c-clay-strong',
  '--c-amber-strong',
  '--accent-blue',
  '--accent-pink',
  '--c-moss-strong',
] as const;

const needIndex = (id: string) =>
  (NEED_INK_ORDER as readonly string[]).indexOf(id);

/** Цвет данных потребности значением; неизвестная — null (без выдуманного цвета). */
export function needDataInk(id: string): string | null {
  const i = needIndex(id);
  return i < 0 ? null : INK_VARS[NEED_DATA_VARS[i]];
}

/** Цвет числа потребности; неизвестная — подпись текста. */
export function needTextInk(id: string): string {
  const i = needIndex(id);
  return i < 0 ? INK.sub : INK_VARS[NEED_TEXT_VARS[i]];
}

/** 'var(--x)' → значение светлой темы; hex и rgb — как есть; незнакомая переменная — подпись. */
export function inkOf(value: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(value.trim());
  if (!m) return value;
  return INK_VARS[m[1]] ?? INK.sub;
}

/** Чернила с прозрачностью: линии, пазы, пустые места. */
export const inkAlpha = (alpha: number) => `rgba(${INK.rgb}, ${alpha})`;
