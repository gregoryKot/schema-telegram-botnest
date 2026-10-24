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
