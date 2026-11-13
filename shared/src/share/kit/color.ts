// Цветовая арифметика share-карточек: альфа к готовому цвету и яркость.
// Вынесено из theme.ts, чтобы тема не пухла (правило №10).

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

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

/** Оттенок oklch цвета '#rrggbb' в градусах 0..360; не hex или серый — null. */
export function oklchHue(color: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;
  if (Math.hypot(A, B) < 0.02) return null;
  const deg = (Math.atan2(B, A) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

/** Ближайший оттенок из списка по кругу (цвет сущности → бумага). */
export function nearestHue(h: number, hues: readonly number[]): number {
  const dist = (x: number) => Math.min(Math.abs(x - h), 360 - Math.abs(x - h));
  return hues.reduce((best, x) => (dist(x) < dist(best) ? x : best), hues[0]);
}
