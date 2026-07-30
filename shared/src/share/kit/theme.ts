// Тема share-карточек: резолв CSS-переменных фронтенда в конкретные цвета
// (canvas не понимает var()). Единственная копия для обоих фронтендов
// (правило №3) — визуал строится на --bg/--sheet-bg/--fg-rgb/--accent и
// адаптируется к светлой теме сайта и тёмной теме мини-аппа.

export const CARD_W = 400;
export const CARD_PAD = 30;
/** Плотность растра: 3× — карточка остаётся резкой на ретине и в предпросмотре. */
export const DPR = 3;

export const cardFont = (size: number, weight?: 'bold') =>
  `${weight ? 'bold ' : ''}${size}px -apple-system, BlinkMacSystemFont, sans-serif`;

export interface CardTheme {
  bg: string;
  sheetBg: string;
  accent: string;
  /** Светлая тема сайта — свечения и заливки идут слабее, чем на тёмной. */
  isLight: boolean;
  fg: (alpha: number) => string;
  /** 'var(--accent-red)' или '#hex' → конкретный цвет для canvas */
  color: (value: string) => string;
}

/** '#rrggbb' + alpha → 'rgba(r,g,b,a)'. Принимает и уже готовые rgb/rgba. */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (m) {
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    const [r, g, b] = short[1].split('').map((ch) => parseInt(ch + ch, 16));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(hex);
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').map((v) => parseFloat(v));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex;
}

/** Воспринимаемая яркость цвета 0..1 — по ней отличаем светлую тему. */
export function luminance(color: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return (
    (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) /
    255
  );
}

/** Источник CSS-переменной: DOM во фронтендах, пусто — на сервере. */
type VarSource = (name: string) => string;

/**
 * Тема из источника переменных. Вынесена из resolveCardTheme, потому что
 * карточку теперь рисует и бэкенд (пин фразы для Pinterest): там нет DOM, но
 * визуал обязан остаться тем же — значения по умолчанию здесь и есть тёмная
 * тема мини-аппа, на которой карточки и рисовались.
 */
function buildTheme(read: VarSource): CardTheme {
  // Рекурсивная подстановка: '--sheet-bg: var(--bg-elev)' → '#hex'
  const get = (name: string, fallback: string, depth = 0): string => {
    if (depth > 4) return fallback;
    const raw = read(name).trim();
    if (!raw) return fallback;
    const m = /^var\((--[\w-]+)\)$/.exec(raw);
    return m ? get(m[1], fallback, depth + 1) : raw;
  };
  const fgRgb = get('--fg-rgb', '255, 255, 255');
  const color = (value: string): string => {
    const m = /^var\((--[\w-]+)\)$/.exec(value.trim());
    return m ? get(m[1], '#888') : value;
  };
  const bg = get('--bg', '#191b25');
  return {
    bg,
    sheetBg: get('--sheet-bg', '#23252f'),
    accent: get('--accent', '#8f86ff'),
    isLight: luminance(bg) > 0.5,
    fg: (alpha) => `rgba(${fgRgb},${alpha})`,
    color,
  };
}

export function resolveCardTheme(): CardTheme {
  // Без DOM (бэкенд рисует карточку для пина) берём дефолты buildTheme.
  if (typeof document === 'undefined') return buildTheme(() => '');
  const cs = getComputedStyle(document.documentElement);
  return buildTheme((name) => cs.getPropertyValue(name));
}
