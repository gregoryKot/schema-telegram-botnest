// @vitest-environment node
// Шкала интенсивности чувства в дневнике схем (.sd-int-step, SchemaEmotionsStep) была 26px по высоте —
// мимо зоны 44 (docs/open/frontend-ux.md). Приём .sd-tick: зона 44 через min-height, отрицательный
// margin держит в раскладке прежние 26, видимая полоска — ::before. CSS в jsdom не исполняется —
// сверяем исходник.
import { describe, it, expect } from 'vitest';
import { parseRules, type Rule } from './cssRules.test-helpers';
import { cssBundle } from './cssBundle.test-helpers';

// sheet-diary.css — сборник (раскрой 2026-11): шкала живёт в diary-wizard.css, читаем вместе с частями.
const rules = parseRules(cssBundle('sheet-diary.css'));
const body = (sel: string, list: Rule[] = rules) =>
  list.filter((r) => r.media === '' && r.selectors.includes(sel)).map((r) => r.body).join(';');
const px = (decls: string, prop: string) => {
  const m = decls.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*(-?\\d+)px`));
  return m ? Number(m[1]) : NaN;
};

// Ревью g3 r2: полоски 6–10px и 10–24px по высоте читались индикатором загрузки — толщина мотива Strokes (≥10)
// и рост до 36; старшая ступень задаёт высоту строки в раскладке.
describe('.sd-int-step — зона 44, видимая полоска до 36', () => {
  it('зона нажатия: min-height 44 и отрицательный margin, раскладка — высота старшей ступени', () => {
    const step = body('.sd-int-step');
    expect(px(step, 'min-height')).toBe(44);
    const margin = px(step, 'margin-block');
    expect(44 + 2 * margin).toBe(px(body('.sd-int-step::before'), 'height'));
    expect(step).not.toMatch(/(^|[;\s])height:/);
    expect(step).not.toMatch(/background:/);
  });

  it('видимая полоска — ::before толщиной ≥10 и высотой 36, ступени растут; «включённая» красится там же', () => {
    expect(px(body('.sd-int-step::before'), 'height')).toBe(36);
    expect(body('.sd-int-step::before')).toMatch(/width: min\(100%, 1[0-9]px\)/);
    const hs = [1, 2, 3, 4].map((n) => px(body(`.sd-int-step:nth-child(${n})::before`), 'height'));
    expect(hs[0]).toBeGreaterThanOrEqual(14);
    expect([...hs, 36]).toEqual([...hs, 36].slice().sort((a, b) => a - b));
    expect(body('.sd-int-step::before')).toMatch(/background: var\(--paper-sunk\)/);
    expect(body('.sd-int-step.is-on::before')).toMatch(/background:/);
  });

  // Ревью g3: пустой шаг на бумаге страницы — 1.1:1, не видно, что шагов пять. Кромка тона записи (≥3:1, WCAG 1.4.11).
  it('пустой шаг — гнездо с кромкой тона записи, у включённого кромки нет', () => {
    expect(body('.sd-int-step::before')).toMatch(/box-shadow: inset 0 0 0 1\.5px oklch\(0\.62 0\.07 var\(--h\)\)/);
    expect(body('.sd-int-step.is-on::before')).toMatch(/box-shadow: none/);
  });

  it('нет медиа-правил, которые вернули бы шагу высоту', () => {
    const bad = rules.filter((r) => r.selectors.some((s) => s.startsWith('.sd-int-step')) && /(^|[;\s])height:\s*\d/.test(r.body)
      && !r.selectors.some((s) => s.endsWith('::before')));
    expect(bad).toEqual([]);
  });
});
