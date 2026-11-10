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
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, extractBlock, oklchRgb, parseColor, resolveToken } from '../test-support/cssContrast';
import { allCssRules, indexCssRules, parseRules, type Rule } from './cssRules.test-helpers';
import { PAPER_HUE } from '../../../shared/src/theme/signKeys';

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

/**
 * Инлайн-стили .tsx (сайт и shared): `color: 'var(--c-…)'`, в том числе в тернарнике.
 * Палитровый оттенок текстом стоял в админке, на холсте карты режимов и на лендинге
 * (docs/open/frontend-ux.md, 2026-11) — CSS-скан выше этих мест не видит. Размер в
 * инлайне не разбираем: текст считается мелким (4.5:1).
 */
function tsxPaletteText(src: string): string[] {
  const out: string[] = [];
  for (const [, value] of src.matchAll(/\bcolor:\s*([^,}\n]*)/g)) {
    for (const [, token] of value.matchAll(/'var\((--c-[a-z-]+)\)'/g)) out.push(token);
  }
  return out;
}

function tsxCases(): Case[] {
  const roots = { 'webapp/src': join(__dirname, '..'), 'shared/src': join(__dirname, '..', '..', '..', 'shared', 'src') };
  const out: Case[] = [];
  for (const [name, root] of Object.entries(roots)) {
    for (const f of readdirSync(root, { recursive: true }) as string[]) {
      if (!f.endsWith('.tsx') || f.includes('.test.')) continue;
      for (const token of tsxPaletteText(readFileSync(join(root, f), 'utf8'))) {
        out.push({ file: `${name}/${f}`, selector: 'style={{ color }}', token, threshold: 4.5 });
      }
    }
  }
  return out;
}

const CASES = [...collectCases(), ...tsxCases()];

describe('a11y: текст акцентным или палитровым токеном читается на бумаге (WCAG AA)', () => {
  it('скан находит правила с акцентным текстом (иначе проверка пуста)', () => {
    // Образец — стабильный примитив; правило инцидента (.ps-adult-title) ушло в b15: голос Здорового
    // Взрослого на экране паттерна — общий HealthyVoice, подпись --text-sub.
    expect(CASES.map((c) => c.selector)).toContain('.ds-link--danger');
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

  it('инлайн .tsx: палитровый --c-* в color (и в тернарнике) найден; заливка, рамка и --accent-* — нет', () => {
    expect(tsxPaletteText("<i style={{ color: ok ? 'var(--c-moss)' : 'var(--c-rose)' }} />")).toEqual(['--c-moss', '--c-rose']);
    expect(tsxPaletteText("<i style={{ fontSize: 12, color: 'var(--c-clay)', margin: 0 }} />")).toEqual(['--c-clay']);
    expect(tsxPaletteText("<i style={{ background: 'var(--c-moss)', borderColor: 'var(--c-rose)', color: 'var(--accent-green)' }} />")).toEqual([]);
  });

  it('заливка тем же акцентом — текст не на бумаге, правило пропускается; color-mix — нет', () => {
    expect(SOLID_FILL.test('color: var(--accent-red); background: var(--accent-red)')).toBe(true);
    expect(SOLID_FILL.test('background: color-mix(in srgb, var(--accent-green) 8%, transparent); color: var(--accent-green)')).toBe(false);
    expect(accentTextToken('border-color: var(--c-moss); background-color: var(--c-moss)')).toBeNull();
    expect(accentTextToken('color: var(--text); color: var(--c-moss)')).toBe('--c-moss');
  });
});

// Ревью g5 r2: цифра выбранного ответа теста (.ss-scale-btn.is-active .ss-scale-num, 22px) красилась
// --c-clay-strong на бумаге глины выбранной плитки — 4.33:1 при норме 4.5:1. Скан выше сверяет акцентный текст
// только с --bg и --surface; здесь — с цветной бумагой oklch(0.9… C var(--h)): правило само кладёт её фоном или
// стоит потомком правила, которое её кладёт. Оттенок --h задаёт разметка, поэтому сверка — с худшим из PAPER_HUE.
const PAPER_FILL = /(?:^|;)\s*background(?:-color)?\s*:\s*oklch\((0\.9\d*)\s+([\d.]+)\s+var\(--h\)\)/;
const paperOf = (body: string): [number, number] | null => {
  const m = PAPER_FILL.exec(body);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

function accentOnPaper(rules: Rule[], block: string): string[] {
  const papers = rules.flatMap((r) => {
    const p = paperOf(r.body);
    return p ? r.selectors.map((sel) => ({ sel, p })) : [];
  });
  const bad: string[] = [];
  for (const r of rules) {
    const token = accentTextToken(r.body);
    if (!token || SHARED_TOKENS.has(token)) continue;
    const own = paperOf(r.body);
    const under = r.selectors.flatMap((sel) => papers.filter((x) => sel.startsWith(`${x.sel} `)).map((x) => x.p));
    const fg = parseColor(resolveToken(block, token)).rgb;
    for (const [L, C] of own ? [own] : under) {
      const worst = Math.min(...Object.values(PAPER_HUE).map((h) => contrastRatio(fg, oklchRgb(L, C, h))));
      if (worst < aaThreshold(r.body)) bad.push(`${r.f ?? ''} ${r.selectors.join(', ')}: ${token} на бумаге oklch(${L} ${C} h) — ${worst.toFixed(2)}:1`);
    }
  }
  return bad;
}

describe('a11y: акцентный текст на цветной бумаге oklch(0.9… var(--h)) — по худшему оттенку', () => {
  it('ни одно правило styles/*.css не ставит мелкий акцентный текст на цветную бумагу ниже нормы', () => {
    expect(accentOnPaper(allCssRules(), THEMES.light)).toEqual([]);
  });

  it('контрольный образец: прежняя цифра выбранного ответа краснеет; цифра цветом --text и текст на белом — нет', () => {
    const was = parseRules(
      '.ss-scale-btn.is-active { background: oklch(0.915 0.03 var(--h)); color: var(--text); } .ss-scale-btn.is-active .ss-scale-num { color: var(--c-clay-strong); }',
    ).map((r) => ({ ...r, f: 'schema-library.css' }));
    expect(accentOnPaper(was, THEMES.light)).toHaveLength(1);
    expect(accentOnPaper(parseRules('.a { background: oklch(0.915 0.03 var(--h)); } .a .n { color: var(--text); }'), THEMES.light)).toEqual([]);
    expect(accentOnPaper(parseRules('.a { background: var(--surface); } .a .n { color: var(--c-clay-strong); }'), THEMES.light)).toEqual([]);
  });
});
