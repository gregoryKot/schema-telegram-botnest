// Тема share-карточек: геометрия, шрифты и чернила. Карточка всегда светлая «бумажная»
// (docs/design/APP_2026-11.md, b23a): её отправляют в чужой мессенджер, и тема приложения
// (тёмная, светлая) на неё не влияет — чернила фиксированы значениями (ink.ts).
import { INK, inkAlpha, inkOf } from './ink';

export { withAlpha, luminance } from './color';

export const CARD_W = 400;
/** Внутреннее поле листа: текст и графика не выходят за [CARD_PAD, CARD_W − CARD_PAD]. */
export const CARD_PAD = 34;
/** Плотность растра: 3× — карточка остаётся резкой на ретине и в предпросмотре. */
export const DPR = 3;

/** Текст сайта (--font-sans): Manrope, до загрузки — системный. */
export const SANS =
  "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
/** Заголовки сайта (--serif): Literata, до загрузки — Georgia. */
export const SERIF = "'Literata', Georgia, 'Times New Roman', serif";

/** Шрифт канваса; family — семейство вместо Manrope (SERIF для заголовков и чисел). */
export const cardFont = (size: number, weight?: 'bold', family = SANS) =>
  `${weight ? 'bold ' : ''}${size}px ${family}`;

/** Заголовочный шрифт: Literata обычного начертания, как у героев сайта. */
export const serifFont = (size: number) => `${size}px ${SERIF}`;

export interface CardTheme {
  /** Бумага страницы под листом. */
  bg: string;
  /** Светлый лист внутри карточки (плитка, цитата). */
  sheetBg: string;
  accent: string;
  serif: string;
  /** Карточка всегда светлая — поле оставлено для карточек, ещё не переведённых на лист (b23b). */
  isLight: true;
  /** Чернила с прозрачностью. */
  fg: (alpha: number) => string;
  /** 'var(--accent-red)' или '#hex' → значение светлой темы. */
  color: (value: string) => string;
}

const THEME: CardTheme = {
  bg: INK.page,
  sheetBg: INK.surface,
  accent: INK.accent,
  serif: SERIF,
  isLight: true,
  fg: inkAlpha,
  color: inkOf,
};

/** Тема карточки — одна на любую тему приложения и на сервер без DOM. */
export function resolveCardTheme(): CardTheme {
  return THEME;
}
