import { describe, it, expect } from 'vitest';
import { buildAnchorPools } from './anchorPools';
import { buildNeedData } from './needData';
import { NEED_ORDER } from './types';
import { ANCHOR_STEPS } from './content/anchors/types';

const STEPS = ANCHOR_STEPS;
// Три опоры шкалы: их первая строка — из ranges потребности.
const RANGE_STEPS = ['low', 'mid', 'high'] as const;
// «Мало» и «В основном да» — в одну строку телефона 360 (замер в e2e-browser/tracker-fit.spec.ts).
const SHORT_STEPS = ['little', 'mostly'] as const;
const SHORT_MAX = 34;
const both = (ty: string, vy: string) => `${ty}|${vy}`;

describe('anchorPools — подписи под ответами шкалы', () => {
  const pools = buildAnchorPools(both);

  it('у каждого из пяти ответов каждой потребности пул от 10 строк, без повторов — и внутри потребности тоже', () => {
    for (const id of NEED_ORDER) {
      const all = STEPS.flatMap((s) => pools[id][s]);
      expect(new Set(all).size).toBe(all.length);
      for (const s of STEPS)
        expect(pools[id][s].length).toBeGreaterThanOrEqual(10);
    }
  });

  it('первая строка пула — та же, что в ranges потребности (лист «Подробнее» и шкала не расходятся)', () => {
    for (const tr of [(ty: string) => ty, (_: string, vy: string) => vy]) {
      const p = buildAnchorPools(tr);
      const data = buildNeedData(tr);
      for (const id of NEED_ORDER) {
        RANGE_STEPS.forEach((s, i) =>
          expect(p[id][s][0]).toBe(data[id].ranges[i].description),
        );
      }
    }
  });

  it('строки не повторяются между потребностями, нет слова «сегодня» (подпись видна и при дооценке)', () => {
    const all = NEED_ORDER.flatMap((id) => STEPS.flatMap((s) => pools[id][s]));
    expect(new Set(all).size).toBe(all.length);
    for (const line of all) expect(line).not.toMatch(/сегодня/i);
  });

  it('новая подпись — до 100 знаков (пять ответов на телефоне 360×640) и в форме «вы» не содержит «ты»', () => {
    for (const id of NEED_ORDER) {
      for (const s of RANGE_STEPS) {
        pools[id][s].forEach((line, i) => {
          for (const form of line.split('|'))
            expect(form.length).toBeLessThanOrEqual(i === 0 ? 110 : 100);
          const vy = line.includes('|') ? line.split('|')[1] : line;
          expect(vy.replace(/«[^»]*»/g, '')).not.toMatch(
            /(^|[^а-яё])(ты|тебя|тебе|тобой|твой|твоя|твоё|твои)([^а-яё]|$)/i,
          );
        });
      }
    }
  });

  it(`подписи «Мало» и «В основном да» — до ${SHORT_MAX} знаков и без обращения (одна форма на ты и вы)`, () => {
    for (const id of NEED_ORDER) {
      for (const s of SHORT_STEPS) {
        for (const line of pools[id][s]) {
          expect(line).not.toContain('|');
          expect(line.length, line).toBeLessThanOrEqual(SHORT_MAX);
        }
      }
    }
  });
});
