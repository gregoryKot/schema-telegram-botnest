// Цвет данных пяти потребностей (NEED_DATA_PAPER, paper.ts; решение 7 в
// docs/design/APP_2026-11.md): полоска и столбик — данные, к бумаге каждого из десяти
// оттенков (oklch(0.915 0.03 h), .pp-paper) нужен контраст ≥3:1 (WCAG 1.4.11). Значения
// токенов берём из светлой темы index.css: кабинет рисуется только в светлой
// (webapp/src/utils/theme.ts, решение редизайна 2026-10), тёмные значения бумаге кабинета не
// встречаются. Токен поменяли — тест пересчитает; бумагу поменяли — тоже.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEED_DATA_PAPER } from './paper';
import { PAPER_HUE } from '../../../../shared/src/theme/signKeys';

const css = readFileSync(join(__dirname, '../../index.css'), 'utf8');
const light = css.slice(0, css.indexOf('html[data-theme="dark"]'));

/** Hex светлого значения токена; токен-ссылка var(--x) разворачивается. */
function tokenHex(name: string): string {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(light);
  if (!m) throw new Error(`нет токена ${name}`);
  const v = m[1].trim();
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(v);
  return ref ? tokenHex(ref[1]) : v;
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function hexLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Яркость oklch(L C h): та же формула, что toneHex в shared/src/theme/entityHue.ts. */
function oklchLuminance(L: number, C: number, h: number): number {
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

const contrast = (y1: number, y2: number) => (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05);

describe('цвет данных потребностей на бумаге', () => {
  it('каждый из пяти цветов — ≥3:1 к бумаге каждого из десяти оттенков (светлая тема кабинета)', () => {
    for (const value of NEED_DATA_PAPER) {
      const token = /^var\((--[a-z0-9-]+)\)$/.exec(value)![1];
      const y = hexLuminance(tokenHex(token));
      for (const h of Object.values(PAPER_HUE)) {
        expect(contrast(y, oklchLuminance(0.915, 0.03, h)), `${token} на бумаге ${h}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('контрольный образец: светлый --c-amber на бумаге соломы не проходит (поэтому взят --c-amber-strong)', () => {
    expect(contrast(hexLuminance(tokenHex('--c-amber')), oklchLuminance(0.915, 0.03, 70))).toBeLessThan(3);
  });
});
