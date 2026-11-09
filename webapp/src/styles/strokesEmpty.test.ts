// @vitest-environment node
// Пустое место полосок дня (Strokes values) — одно правило на главную, карточку дня в меню и силуэт «Сегодня»
// (ревью g1 r2: правило висело на .ct-strokes, и меню с силуэтом рисовали серый PAPER.hollow — два вида
// одного знака по одним данным). Правило с заливкой [data-rated="no"] живёт только в paper.css.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const files = [...readdirSync(__dirname).filter((f) => f.endsWith('.css')).map((f) => join(__dirname, f)), join(__dirname, '..', 'index.css')];
const fillsEmpty = (css: string) => [...strip(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => /\[data-rated="no"\]/.test(m[1]) && /(^|;)\s*(fill|stroke)\s*:/.test(m[2])).map((m) => m[1].trim());

describe('пустое место полосок дня — одно правило', () => {
  it('заливка и кромка [data-rated="no"] — только в paper.css, на .pp-strokes-values', () => {
    const where = files.flatMap((f) => fillsEmpty(readFileSync(f, 'utf8')).map((sel) => `${f.split('/').pop()}: ${sel}`));
    expect(where).toEqual(['paper.css: .pp-strokes-values > [data-rated="no"]']);
  });
  it('кромка — цветом бумаги: на .pp-paper её бумага, без бумаги — фон страницы', () => {
    const paper = strip(readFileSync(join(__dirname, 'paper.css'), 'utf8'));
    expect(paper).toMatch(/:root\s*\{\s*--strokes-edge:\s*var\(--bg\);/);
    expect(paper).toMatch(/\.pp-paper\s*\{\s*--strokes-edge:\s*oklch\(0\.915 0\.03 var\(--h\)\);/);
  });
  it('гейт ловит правило пустого места вне paper.css', () => {
    expect(fillsEmpty('.ct-strokes [data-rated="no"] { fill: red; }')).toEqual(['.ct-strokes [data-rated="no"]']);
    expect(fillsEmpty('.ct-strokes [data-rated="no"] { visibility: hidden; }')).toEqual([]);
  });
});
