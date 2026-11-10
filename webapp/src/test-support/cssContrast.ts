// Сверка контраста по исходнику index.css (CSS в jsdom не исполняется):
// разбор значений токенов внутри блока темы и формула WCAG 2.x. Один
// экземпляр на все тесты контраста (index.css.contrast.test.ts — конкретные
// пары, styles/accentTextContrast.test.ts — все правила с акцентным текстом).

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Разбирает и `#rrggbb`, и `rgba(r,g,b,a)` — оба формата встречаются в index.css. */
export function parseColor(raw: string): { rgb: Rgb; alpha: number } {
  const v = raw.trim();
  const rgbaMatch = v.match(/rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (rgbaMatch) {
    return { rgb: [+rgbaMatch[1], +rgbaMatch[2], +rgbaMatch[3]], alpha: +rgbaMatch[4] };
  }
  if (!/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`цвет «${raw}» не hex и не rgba() — разобрать нельзя`);
  return { rgb: hexToRgb(v), alpha: 1 };
}

/** Значение токена в конкретном блоке темы (`:root, html[data-theme="light"]`
 *  либо `html[data-theme="dark"]`) — берём ПЕРВОЕ совпадение внутри блока,
 *  а не по всему файлу, иначе light/dark значения одного имени перепутаются. */
export function tokenInBlock(blockCss: string, name: string): string {
  const re = new RegExp(`${name}:\\s*([^;]+);`);
  const m = blockCss.match(re);
  if (!m) throw new Error(`токен ${name} не найден в блоке темы`);
  return m[1];
}

/** То же, но разворачивает ссылки `var(--other)` внутри того же блока темы
 *  (`--accent-red: var(--c-rose-strong)` → `var(--c-rose)` → `#d68585`).
 *  Цепочку ограничиваем — циклическая ссылка должна падать, а не висеть. */
export function resolveToken(blockCss: string, name: string, depth = 0): string {
  if (depth > 5) throw new Error(`циклическая ссылка токенов на ${name}`);
  const raw = tokenInBlock(blockCss, name).trim();
  if (!raw.startsWith('var(')) return raw;
  return resolveToken(blockCss, raw.slice(4, -1).trim(), depth + 1);
}

/** Тело первого блока `{…}`, чей селектор начинается с маркера. */
export function extractBlock(css: string, startMarker: string): string {
  const start = css.indexOf(startMarker);
  if (start === -1) throw new Error(`маркер блока «${startMarker}» не найден в index.css`);
  const openBrace = css.indexOf('{', start);
  const closeBrace = css.indexOf('\n}', openBrace);
  return css.slice(openBrace, closeBrace);
}

function srgbToLin(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}
/** Яркость oklch(L C h) — бумаги .pp-paper (oklch(0.915 0.03 h)); формула OKLab → линейный sRGB. */
export function oklchLuminance(L: number, C: number, h: number): number {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const R = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const G = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const B = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
export function contrastRatio(fg: Rgb, bg: Rgb): number {
  const L1 = luminance(fg);
  const L2 = luminance(bg);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
/** Накладывает полупрозрачный цвет на непрозрачную подложку (alpha-composite). */
export function overlay(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [0, 1, 2].map((i) => alpha * fg[i] + (1 - alpha) * bg[i]) as Rgb;
}
