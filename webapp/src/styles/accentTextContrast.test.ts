// Инцидент 2026-11-05 (скрин владельца, «текст сливается»): подпись «Здоровый
// Взрослый отвечает» (.ps-adult-title, 12px) красилась --accent-green =
// --c-moss #6b8156 — 3.84:1 к бумаге при норме 4.5:1 для мелкого текста.
// Класс: палитровые токены --c-* — оттенки для заливок и графиков, а как цвет
// мелкого текста на бумаге часть из них AA не проходит (прецедент —
// --c-rose → --c-rose-strong). Тест обходит ВСЕ правила index.css и styles/*.css,
// где текст красится акцентным или палитровым токеном, и считает контраст
// разрешённого значения к бумаге (--bg, --surface) в обеих темах.
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, extractBlock, parseColor, resolveToken } from '../test-support/cssContrast';
import { allCssRules, indexCssRules, type Rule } from './cssRules.test-helpers';

const INDEX_CSS = readFileSync(join(__dirname, '..', 'index.css'), 'utf8');
const THEMES = {
  light: extractBlock(INDEX_CSS, ':root, html[data-theme="light"]'),
  dark: extractBlock(INDEX_CSS, 'html[data-theme="dark"]'),
} as const;

// Токены контракта shared/src/theme/tokens.css (--accent, --accent-hi,
// --accent-hot, --accent-soft, …) тест пропускает: это бренд-акцент, его
// тёмные значения объявлены там, а не в блоках index.css (здесь разрешить
// нельзя), и его пары держат check-token-contract.mjs и
// index.css.contrast.test.ts (--on-accent на --accent).
const SHARED_TOKENS = new Set(
  [...readFileSync(join(__dirname, '..', '..', '..', 'shared', 'src', 'theme', 'tokens.css'), 'utf8').matchAll(/(--[a-z-]+):/g)].map((m) => m[1]),
);

const TEXT_TOKEN = /^color\s*:\s*var\((--(?:accent|c)-[a-z-]+)\)$/;
const SOLID_FILL = /(?:^|;)\s*background(?:-color)?\s*:\s*var\(--(?:accent|c)-[a-z-]+\)\s*(?:;|$)/;
const PAPER = ['--bg', '--surface'] as const;

/** Последнее объявление `color: var(--accent-X|--c-X)` правила (позднее в теле побеждает). */
function accentTextToken(body: string): string | null {
  const decls = body.split(';').map((d) => d.trim());
  const hit = decls.filter((d) => TEXT_TOKEN.test(d)).pop();
  return hit ? hit.match(TEXT_TOKEN)![1] : null;
}

/** Порог AA: 3:1 только для крупного текста (≥24px или ≥18.66px при насыщенности ≥700); нет размера — текст мелкий. */
function aaThreshold(body: string): number {
  const size = Number(body.match(/font-size\s*:\s*([\d.]+)px/)?.[1] ?? 0);
  const weightRaw = body.match(/font-weight\s*:\s*(\d+|bold)/)?.[1];
  const weight = weightRaw === 'bold' ? 700 : Number(weightRaw ?? 400);
  return size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
}

type Case = { file: string; selector: string; token: string; threshold: number };

function collectCases(): Case[] {
  const rules: Rule[] = [...indexCssRules().map((r) => ({ ...r, f: 'index.css' })), ...allCssRules().map((r) => ({ ...r, f: `styles/${r.f}` }))];
  const out: Case[] = [];
  for (const r of rules) {
    const token = accentTextToken(r.body);
    if (!token || SHARED_TOKENS.has(token)) continue;
    if (SOLID_FILL.test(r.body)) continue; // текст на сплошной акцентной заливке, не на бумаге
    out.push({ file: r.f!, selector: r.selectors.join(', '), token, threshold: aaThreshold(r.body) });
  }
  return out;
}

const CASES = collectCases();

describe('a11y: текст акцентным или палитровым токеном читается на бумаге (WCAG AA)', () => {
  it('скан находит правила с акцентным текстом (иначе проверка пуста)', () => {
    expect(CASES.map((c) => c.selector)).toContain('.ps-adult-title');
    expect(CASES.length).toBeGreaterThanOrEqual(10);
  });

  it.each(Object.keys(THEMES) as (keyof typeof THEMES)[])('тема %s', (theme) => {
    const block = THEMES[theme];
    const paper = PAPER.map((name) => ({ name, rgb: parseColor(resolveToken(block, name)).rgb }));
    const bad: string[] = [];
    for (const c of CASES) {
      let value: string;
      try {
        value = resolveToken(block, c.token);
      } catch (e) {
        bad.push(`${c.file} ${c.selector}: ${c.token} — ${(e as Error).message} (${theme})`);
        continue;
      }
      const fg = parseColor(value);
      if (fg.alpha < 1) {
        bad.push(`${c.file} ${c.selector}: ${c.token} = ${value} полупрозрачный — текст красится непрозрачным (${theme})`);
        continue;
      }
      for (const p of paper) {
        const ratio = contrastRatio(fg.rgb, p.rgb);
        if (ratio < c.threshold) {
          bad.push(
            `${c.file} ${c.selector}: color ${c.token} = ${value} на ${p.name} — ${ratio.toFixed(2)}:1 при норме ${c.threshold}:1 (${theme}). ` +
              `Палитровый --c-* — оттенок для заливок; текст красится --accent-*/--c-*-strong (index.css, образец --c-rose-strong).`,
          );
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('порог AA по размеру правила', () => {
  it.each([
    ['', 4.5],
    ['font-size: 12px; font-weight: 700', 4.5],
    ['font-size: 18px; font-weight: 700', 4.5],
    ['font-size: 19px; font-weight: bold', 3],
    ['font-size: 24px', 3],
  ])('«%s» → %s', (body, threshold) => {
    expect(aaThreshold(body)).toBe(threshold);
  });

  it('заливка тем же акцентом — текст не на бумаге, правило пропускается; color-mix — нет', () => {
    expect(SOLID_FILL.test('color: var(--accent-red); background: var(--accent-red)')).toBe(true);
    expect(SOLID_FILL.test('background: color-mix(in srgb, var(--accent-green) 8%, transparent); color: var(--accent-green)')).toBe(false);
    expect(accentTextToken('border-color: var(--c-moss); background-color: var(--c-moss)')).toBeNull();
    expect(accentTextToken('color: var(--text); color: var(--c-moss)')).toBe('--c-moss');
  });
});
