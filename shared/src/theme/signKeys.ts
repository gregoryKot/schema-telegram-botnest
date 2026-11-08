// Словарь языка бумаги для таблицы вида сущностей (entityLook.ts): допустимые оттенки
// бумаги и ключи знаков. Ключи — строки: shared не импортирует webapp; рисунок по ключу
// отдаёт webapp/src/components/art/SignArt.tsx (сверка «у каждого ключа есть рисунок» —
// его тест). Новый ключ — сначала строка в docs/design/PAPER_2026-11.md, потом рисунок.

/** Бумага: допустимые оттенки (oklch(0.915 0.03 h) у .pp-paper). Соседние — шаг ~45°. */
export const PAPER_HUE = {
  rose: 25,
  clay: 28,
  peach: 45,
  straw: 70,
  sage: 135,
  moss: 145,
  teal: 195,
  sky: 240,
  lilac: 290,
  plum: 310,
} as const;
export type PaperHue = (typeof PAPER_HUE)[keyof typeof PAPER_HUE];

/** Ключи знаков реестра SignArt. Порядок — по файлам рисунков. */
export const SIGN_KEYS = [
  // PaperArt.tsx, PaperArtSigns.tsx — мотивы кабинета
  'strokes',
  'ribbon',
  'pebbles',
  'cup',
  'breath',
  'sheets',
  'layers',
  'cluster',
  'leaf',
  'talk',
  'beads',
  'check',
  'heart',
  'wheel',
  // NeedArt.tsx (limits — рамка: и потребность «границы», и раздел «рамка метода»)
  'need_attachment',
  'need_autonomy',
  'need_expression',
  'need_play',
  'need_limits',
  'limits',
  // DomainArt.tsx — домены по id из DOMAIN_HUE
  'domain_rejection',
  'domain_autonomy',
  'domain_limits',
  'domain_other_directed',
  'domain_vigilance',
  // GuideSignsModes.tsx — группы режимов
  'child_care',
  'yield',
  'shelter',
  'shield',
  'looming',
  'together',
  // GuideSignsTechniques.tsx, GuideSignsPractice.tsx — техники и «Для терапевта»
  'pattern_steps',
  'rescript',
  'horizon',
  'talk_past',
  'flashcard',
  'heart_frame',
  'scales',
  'spotlight',
  'grown',
  'chatter',
  'flare',
  // AppSigns.tsx — практики «здесь и сейчас», безопасное место, «тот же человек»
  'grounded',
  'pause',
  'haven',
  'join',
] as const;
export type SignKey = (typeof SIGN_KEYS)[number];
