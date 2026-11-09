// @vitest-environment node
// Шкала интенсивности чувства в дневнике схем (.sd-int-step, SchemaEmotionsStep) была 26px по высоте —
// мимо зоны 44 (docs/open/frontend-ux.md). Приём .sd-tick: зона 44 через min-height, отрицательный
// margin держит в раскладке прежние 26, видимая полоска — ::before. CSS в jsdom не исполняется —
// сверяем исходник.
import { describe, it, expect } from 'vitest';
import { readCss, type Rule } from './cssRules.test-helpers';

const rules = readCss('sheet-diary.css');
const body = (sel: string, list: Rule[] = rules) =>
  list.filter((r) => r.media === '' && r.selectors.includes(sel)).map((r) => r.body).join(';');
const px = (decls: string, prop: string) => {
  const m = decls.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*(-?\\d+)px`));
  return m ? Number(m[1]) : NaN;
};

describe('.sd-int-step — зона 44, видимая полоска 26', () => {
  it('зона нажатия: min-height 44 и отрицательный margin, раскладка остаётся 26', () => {
    const step = body('.sd-int-step');
    expect(px(step, 'min-height')).toBe(44);
    const margin = px(step, 'margin-block');
    expect(44 + 2 * margin).toBe(26);
    expect(step).not.toMatch(/(^|[;\s])height:/);
    expect(step).not.toMatch(/background:/);
  });

  it('видимая полоска — ::before высотой 26, «включённая» красится там же', () => {
    expect(px(body('.sd-int-step::before'), 'height')).toBe(26);
    expect(body('.sd-int-step::before')).toMatch(/background: var\(--paper-sunk\)/);
    expect(body('.sd-int-step.is-on::before')).toMatch(/background:/);
  });

  it('нет медиа-правил, которые вернули бы шагу высоту', () => {
    const bad = rules.filter((r) => r.selectors.some((s) => s.startsWith('.sd-int-step')) && /(^|[;\s])height:\s*\d/.test(r.body)
      && !r.selectors.some((s) => s.endsWith('::before')));
    expect(bad).toEqual([]);
  });
});
