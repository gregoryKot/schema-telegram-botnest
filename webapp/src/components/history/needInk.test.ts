// @vitest-environment node
// Цвет данных потребности в истории (needInk.ts, решение 7 «Палитра данных»): число строки —
// текст на белой строке (≥4.5:1), крупная цифра карточки недели — на бумаге своей потребности
// (крупный текст, ≥3:1); графика — тот же цвет, что полоски Strokes values (NEED_DATA_PAPER).
// Кабинет рисуется в светлой теме (needDataContrast.test.ts) — значения берём из неё.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEED_INK, NEED_TEXT_INK, inkVars } from './needInk';
import { NEED_DATA_PAPER } from '../art/paper';
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import { NEED_HUE } from '../../../../shared/src/theme/entityHue';
import { contrastRatio, extractBlock, hexToRgb, resolveToken, type Rgb } from '../../test-support/cssContrast';

const LIGHT = extractBlock(readFileSync(join(__dirname, '../../index.css'), 'utf8'), ':root, html[data-theme="light"]');
const token = (v: string): Rgb => hexToRgb(resolveToken(LIGHT, /^var\((--[a-z0-9-]+)\)$/.exec(v)![1]));

/** Бумага oklch(0.915 0.03 h) в sRGB 0–255 (формула toneHex, shared/src/theme/entityHue.ts). */
function paper(h: number): Rgb {
  const [a, b] = [0.03 * Math.cos((h * Math.PI) / 180), 0.03 * Math.sin((h * Math.PI) / 180)];
  const l = (0.915 + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (0.915 - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (0.915 - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  const g = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  return lin.map((x) => Math.round(Math.min(1, Math.max(0, g(x))) * 255)) as Rgb;
}

describe('needInk — цвет потребности в истории', () => {
  it('графика — тот же цвет, что полоски дня (NEED_DATA_PAPER по NEED_ORDER)', () => {
    NEED_ORDER.forEach((id, i) => expect(NEED_INK[id]).toBe(NEED_DATA_PAPER[i]));
  });

  it('число: ≥4.5:1 к белой строке и ≥3:1 к бумаге своей потребности', () => {
    const surface = token('var(--surface)');
    for (const id of NEED_ORDER) {
      const ink = token(NEED_TEXT_INK[id]);
      expect(contrastRatio(ink, surface), `${id} на --surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ink, paper(NEED_HUE[id])), `${id} на бумаге ${NEED_HUE[id]}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('контрольный образец: палитровый --c-clay мелким текстом на белой строке не проходит', () => {
    expect(contrastRatio(token('var(--c-clay)'), token('var(--surface)'))).toBeLessThan(4.5);
  });

  it('inkVars: знакомая потребность — её цвета, незнакомая — нейтральный текст', () => {
    expect(inkVars('play')).toEqual({ '--need-ink': NEED_INK.play, '--need-text': NEED_TEXT_INK.play });
    expect(inkVars('unknown')).toEqual({ '--need-ink': 'var(--text-sub)', '--need-text': 'var(--text)' });
  });
});
