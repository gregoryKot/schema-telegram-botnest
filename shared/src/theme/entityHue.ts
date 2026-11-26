// Таблица hue сущностей — одна на сайт и мини-апп (редизайн 2026-10, #906).
// Сайт кладёт число в `--h` и красит классами .tone-* (styles/cabinet.css).
// Где нужен готовый цвет — холст схемы, IdentityDot, canvas шаринга (withAlpha
// понимает только hex/rgb, hexToRgb мини-аппа) — берут toneHex.
import type { NeedId } from '../needs/types';

/** Домены схем → hue (порядок SCHEMA_DOMAINS, D1…D5). */
export const DOMAIN_HUE: Record<string, number> = {
  rejection: 28,
  autonomy: 70,
  limits: 135,
  other_directed: 240,
  vigilance: 310,
};

/** Группы режимов (id из MODE_GROUPS). Три копинговые — один «копинговый» тон. */
export const MODE_GROUP_HUE: Record<string, number> = {
  child: 28,
  critic: 310,
  coping_surrender: 240,
  coping_avoidance: 240,
  coping_overcompensation: 240,
  healthy: 145,
};

/** Потребность → hue домена, который она питает. */
export const NEED_HUE: Record<NeedId, number> = {
  attachment: 28,
  autonomy: 70,
  limits: 135,
  expression: 240,
  play: 310,
};

const gamma = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
};

/** '#rrggbb' для oklch(l c h) — sRGB-значение того же цвета, что даёт CSS (canvas шаринга и
 *  старые webview не понимают oklch() в fillStyle). Вне охвата sRGB канал обрезается. */
export function oklchHex(lightness: number, chroma: number, h: number): string {
  const rad = (h * Math.PI) / 180;
  const a = chroma * Math.cos(rad);
  const b = chroma * Math.sin(rad);
  const L = lightness;
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(gamma(v) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** '#rrggbb' для oklch(0.58 0.12 h) — тот же цвет, что у .tone-fill. */
export function toneHex(h: number): string {
  return oklchHex(0.58, 0.12, h);
}
