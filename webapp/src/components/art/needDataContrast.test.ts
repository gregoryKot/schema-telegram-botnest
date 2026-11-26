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
import { oklchLuminance } from '../../test-support/cssContrast';

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
