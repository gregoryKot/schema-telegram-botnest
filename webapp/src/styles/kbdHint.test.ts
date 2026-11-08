// @vitest-environment node
// Клавиатурные подсказки («⌘K», «Esc», «⌘ + Enter — сохранить») прячутся на
// устройстве без наведения одним классом .kbd-hint (QA 2026-11, T-14). CSS в
// jsdom не исполняется, поэтому сверяем исходники: правило есть, а каждая
// плашка клавиши в компонентах несёт этот класс.
// Вид плашки клавиши — один класс .ds-kbd (cabinet.css) на топбар «Перейти к… ⌘K» и
// палитру команд «⌘ 1»: до 2026-11 топбар рисовал моноширинный .kbd из index.css, а
// палитра — обычный ds-sub (docs/open/frontend-ux.md).
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

const all = tsxFiles(SRC).map((f) => readFileSync(f, 'utf8')).join('\n');
const cabinet = readFileSync(join(__dirname, 'cabinet.css'), 'utf8');
const index = readFileSync(join(SRC, 'index.css'), 'utf8');

describe('.kbd-hint', () => {
  it('на (hover: none) скрыт правилом в index.css', () => {
    expect(index).toMatch(/@media \(hover: none\)\s*\{\s*\.kbd-hint\s*\{\s*display: none/);
  });

  it('каждая плашка ds-kbd помечена kbd-hint', () => {
    const bad = tsxFiles(SRC).filter((f) => /['"]ds-kbd(?![\w-])(?![^'"]*kbd-hint)[^'"]*['"]/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('подсказка «⌘ + Enter» помечена', () => {
    expect(all).toContain('className="tb-hint kbd-hint">⌘ + Enter');
  });
});

describe('.ds-kbd — одна плашка клавиши на топбар и палитру', () => {
  it('топбар «⌘K» и хоткеи палитры — ds-kbd', () => {
    expect(all).toContain('className="ds-kbd kbd-hint">⌘K');
    const palette = readFileSync(join(SRC, 'components', 'CommandPalette.tsx'), 'utf8');
    expect(palette).toMatch(/row\.hint\.startsWith\('⌘'\) \? 'ds-kbd kbd-hint'/);
  });

  it('объявлена в cabinet.css токенами, без моноширинного шрифта; старой .kbd нет', () => {
    const m = cabinet.match(/\n\.ds-kbd \{([^}]*)\}/);
    expect(m?.[1]).toBeTruthy();
    expect(m![1]).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|monospace/i);
    expect(index).not.toMatch(/\n\.kbd \{/);
    expect(all).not.toMatch(/className="kbd[ "]/);
  });
});
