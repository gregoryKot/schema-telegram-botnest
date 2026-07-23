// Палитра продуктового бренда «Всё по схеме» (тёмный «ночной» холст +
// аврора-градиенты). Общая для маркетинговых страниц app-домена:
// ProductLandingPage и публичных мини-тестов (/tests). Намеренно не зависит
// от app-темы — это отдельная айдентика (см. шапку ProductLandingPage).
export const CANVAS = '#0b0817';
export const INK = '#f3f1fb';
export const SUB = 'rgba(243,241,251,.62)';
export const FAINT = 'rgba(243,241,251,.40)';
export const GLASS = 'rgba(255,255,255,.045)';
export const GLASS_BORDER = 'rgba(255,255,255,.10)';
export const VIOLET = '#a78bfa';
export const PINK = '#f472b6';
export const CYAN = '#38e0d0';
export const AMBER = '#fbbf24';
export const EMERALD = '#34d399';
export const ROSE = '#fb7185';
export const AURORA =
  'linear-gradient(115deg, #a78bfa 0%, #f472b6 52%, #fb923c 100%)';
export const glow = (c: string, a = 0.5) =>
  `color-mix(in srgb, ${c} ${a * 100}%, transparent)`;

/** Базовая гласс-карточка бренда (react-refresh: константы живут вне tsx). */
export const GLASS_CARD: import('react').CSSProperties = {
  background: GLASS,
  border: `1px solid ${GLASS_BORDER}`,
  borderRadius: 22,
};
