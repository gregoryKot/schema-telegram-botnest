// @vitest-environment node
// Клавиатурные подсказки («⌘K», «Esc», «⌘ + Enter — сохранить») прячутся на
// устройстве без наведения одним классом .kbd-hint (QA 2026-11, T-14). CSS в
// jsdom не исполняется, поэтому сверяем исходники: правило есть, а каждая
// плашка .kbd в компонентах несёт этот класс.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return tsxFiles(p);
    return p.endsWith('.tsx') && !p.endsWith('.test.tsx') ? [p] : [];
  });
}

describe('.kbd-hint', () => {
  it('на (hover: none) скрыт правилом в index.css', () => {
    const css = readFileSync(join(SRC, 'index.css'), 'utf8');
    expect(css).toMatch(/@media \(hover: none\)\s*\{\s*\.kbd-hint\s*\{\s*display: none/);
  });

  it('каждая плашка className="kbd …" помечена kbd-hint', () => {
    const bad = tsxFiles(SRC).filter((f) => /className="kbd(?![\w-])(?!.*kbd-hint)[^"]*"/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('подсказка «⌘ + Enter» и «⌘K» в разметке помечены', () => {
    const all = tsxFiles(SRC).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(all).toContain('className="tb-hint kbd-hint">⌘ + Enter');
    expect(all).toContain('className="kbd kbd-hint">⌘K');
  });
});
