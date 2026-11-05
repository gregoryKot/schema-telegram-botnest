// @vitest-environment node
// Фокус с клавиатуры в сайдбаре кабинета не был виден: `.sb-item:focus-visible,
// .sb-account:focus-visible { outline: none; }`, а фон строки меняется только по
// :hover (WCAG 2.4.7, инцидент компьютерной версии 2026-11-04). CSS в jsdom не
// исполняется — пиним правило исходника.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Объявления всех правил, в списке селекторов которых есть `sel`. */
function declsFor(sel: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    if (m[1].split(',').some((s) => s.trim() === sel)) out.push(m[2]);
  }
  return out;
}

describe('сайдбар: фокус с клавиатуры виден', () => {
  it.each(['.sb-item:focus-visible', '.sb-account:focus-visible'])('%s рисует кольцо, а не гасит его', (sel) => {
    const decls = declsFor(sel).join(';');
    expect(decls).toMatch(/outline:\s*2px solid var\(--[\w-]+\)/);
    expect(decls).not.toMatch(/outline:\s*none/);
  });
});
